import type { BookingRequest, Reservation } from './contracts';
import { readProfile } from '../lib/profile';

export class ApiError extends Error {
  readonly code: string;
  readonly outcomeUnknown: boolean;
  constructor(
    message: string,
    code = 'REQUEST_FAILED',
    outcomeUnknown = false,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.outcomeUnknown = outcomeUnknown;
  }
}

export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const isWrite =
    options?.method !== undefined &&
    !['GET', 'HEAD'].includes(options.method.toUpperCase());
  const headers = new Headers(options?.headers);
  headers.set('Content-Type', 'application/json');
  if (!headers.has('X-Roomwise-Profile'))
    headers.set('X-Roomwise-Profile', readProfile());
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error;
    throw new ApiError(
      'Cannot reach the booking service. Refresh the page or try again shortly.',
      'API_UNAVAILABLE',
      isWrite,
    );
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => ({}));
    const problem =
      typeof body === 'object' && body !== null
        ? (body as { detail?: string; code?: string })
        : {};
    throw new ApiError(
      problem.detail ??
        (response.status >= 500
          ? 'The booking service is unavailable. Please try again shortly.'
          : `Request failed (${response.status}). Please try again.`),
      problem.code ?? 'REQUEST_FAILED',
      isWrite && response.status >= 500,
    );
  }

  try {
    return (await response.json()) as T;
  } catch {
    throw new ApiError(
      'The booking service returned an unreadable response. Please try again.',
      'INVALID_RESPONSE',
      isWrite,
    );
  }
}

export function saveReservation(
  booking: BookingRequest,
  id?: string,
  submissionKey: string = crypto.randomUUID(),
) {
  return submitBooking(
    id ? `/reservations/${id}` : '/reservations',
    {
      method: id ? 'PUT' : 'POST',
      body: JSON.stringify(booking),
    },
    submissionKey,
  );
}

export function reserveAdditionalTime(
  id: string,
  additionalMinutes: number,
  submissionKey: string,
) {
  return submitBooking(
    `/reservations/${id}/continuations`,
    {
      method: 'POST',
      body: JSON.stringify({ additionalMinutes }),
    },
    submissionKey,
  );
}

async function submitBooking(
  path: string,
  options: RequestInit,
  submissionKey: string,
) {
  try {
    return await request<Reservation>(path, {
      ...options,
      headers: { 'Idempotency-Key': submissionKey },
    });
  } catch (error) {
    if (!(error instanceof ApiError) || !error.outcomeUnknown) throw error;
    try {
      return await request<Reservation>(`/booking-requests/${submissionKey}`, {
        cache: 'no-store',
      });
    } catch {
      // A missing receipt cannot prove that the write failed (the server may have restarted).
      throw new ApiError(
        'We couldn’t confirm whether this booking was saved. Retry this request to recover its confirmation. Check Reservations before making a different booking.',
        'BOOKING_UNCONFIRMED',
        true,
      );
    }
  }
}

export function reservationAction(
  id: string,
  action: 'cancel' | 'check-in' | 'end',
) {
  return request<Reservation>(`/reservations/${id}/${action}`, {
    method: 'POST',
  });
}
