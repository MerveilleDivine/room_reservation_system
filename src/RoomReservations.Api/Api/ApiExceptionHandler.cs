using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Mvc;
using RoomReservations.Api.Application;

namespace RoomReservations.Api.Api;

public sealed class ApiExceptionHandler(IProblemDetailsService problems) : IExceptionHandler
{
    public async ValueTask<bool> TryHandleAsync(
        HttpContext context, Exception exception, CancellationToken cancellationToken)
    {
        var (status, code, message) = exception switch
        {
            BookingException booking => (booking.StatusCode, booking.Code, booking.Message),
            BadHttpRequestException => (400, "INVALID_REQUEST", "Check the request fields and date formats."),
            _ => (500, "UNEXPECTED_ERROR", "Something went wrong. Please try again.")
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
