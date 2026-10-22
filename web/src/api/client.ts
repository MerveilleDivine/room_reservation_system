import type { BookingRequest, Reservation } from './contracts';

export class ApiError extends Error {
  readonly code: string;
  constructor(message: string, code = 'REQUEST_FAILED') {
    super(message);
    this.name = 'ApiError';
    this.code = code;
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options?.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error;
    throw new ApiError(
      'Cannot reach the API. Start the ASP.NET server on port 5080.',
      'API_UNAVAILABLE',
    );
  }

  if (!response.ok) {
    const problem: { detail?: string; code?: string } = await response
      .json()
      .catch(() => ({}));
    throw new ApiError(
      problem.detail ??
        (response.status >= 500
          ? 'The API is unavailable. Check that the ASP.NET server is running on port 5080.'
          : `Request failed (${response.status}). Please try again.`),
      problem.code ?? 'REQUEST_FAILED',
    );
  }

  return response.json() as Promise<T>;
}

export function saveReservation(booking: BookingRequest, id?: string) {
  return request<Reservation>(id ? `/reservations/${id}` : '/reservations', {
    method: id ? 'PUT' : 'POST',
    body: JSON.stringify(booking),
  });
}

export function reservationAction(
  id: string,
  action: 'cancel' | 'check-in' | 'end',
) {
  return request<Reservation>(`/reservations/${id}/${action}`, {
    method: 'POST',
  });
}
