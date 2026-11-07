using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using RoomReservations.Domain;

namespace RoomReservations.Api.Api;

public sealed class ApiExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var (status, code, message) = exception switch
        {
            BookingException booking => (booking.Kind switch
            {
                BookingErrorKind.Conflict => StatusCodes.Status409Conflict,
                BookingErrorKind.NotFound => StatusCodes.Status404NotFound,
                BookingErrorKind.Forbidden => StatusCodes.Status403Forbidden,
                _ => StatusCodes.Status400BadRequest
            }, booking.Code, booking.Message),
            BadHttpRequestException => (StatusCodes.Status400BadRequest, ApiErrorCodes.InvalidRequest, "Check the request fields and date formats."),
            _ => (StatusCodes.Status500InternalServerError, ApiErrorCodes.UnexpectedError, "Something went wrong. Please try again.")
        };

        context.Response.StatusCode = status;
        return await problems.TryWriteAsync(new ProblemDetailsContext
        {
            HttpContext = context,
            Exception = exception,
            ProblemDetails = new ProblemDetails
            {
                Status = status,
                Title = code,
                Detail = message,
                Extensions = { ["code"] = code }
            }
        });
    }
}
