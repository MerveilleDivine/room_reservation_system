import type { BookingRequest, Reservation } from '../../api/contracts';
import { readProfile } from '../../lib/profile';
import { ApiError } from '../../shared/api/ApiError';
import { withQuery } from '../../shared/api/paths';
import { request, submissionHeader } from '../../shared/api/transport';
import type { RequestOptions } from '../../shared/api/transport';

export const reservationApi = {
  feedPath: (query: URLSearchParams) => withQuery('/reservation-feed', query),
  extraTimePath: (id: string) =>
    `/reservations/${encodeURIComponent(id)}/extra-time`,
};

export function isReservationFeedPath(path: unknown) {
  return typeof path === 'string' && path.split('?')[0] === '/reservation-feed';
}

export function saveReservation(
  booking: BookingRequest,
  id?: string,
  submissionKey: string = crypto.randomUUID(),
  profile = readProfile(),
) {
  return submitBooking(
    id ? `/reservations/${encodeURIComponent(id)}` : '/reservations',
    { method: id ? 'PUT' : 'POST', body: JSON.stringify(booking) },
    submissionKey,
    profile,
  );
}

export function reserveAdditionalTime(
  id: string,
  additionalMinutes: number,
  submissionKey: string,
  profile = readProfile(),
) {
  return submitBooking(
    `/reservations/${encodeURIComponent(id)}/continuations`,
    { method: 'POST', body: JSON.stringify({ additionalMinutes }) },
    submissionKey,
    profile,
  );
}

async function submitBooking(
  path: string,
  options: RequestOptions,
  submissionKey: string,
  profile: string,
) {
  try {
    return await request<Reservation>(path, {
      ...options,
      profile,
      headers: { [submissionHeader]: submissionKey },
    });
  } catch (error) {
    if (!(error instanceof ApiError) || !error.outcomeUnknown) throw error;
    try {
      return await request<Reservation>(
        `/booking-requests/${encodeURIComponent(submissionKey)}`,
        { cache: 'no-store', profile },
      );
    } catch {
      // A missing receipt cannot prove failure: this process may have restarted.
      throw new ApiError(
        'We couldn’t confirm whether this booking was saved. Retry this request to recover its confirmation. Check Reservations before making a different booking.',
        'BOOKING_UNCONFIRMED',
        true,
      );
    }
  }
}

export type LifecycleAction = 'cancel' | 'check-in' | 'end';

export function reservationAction(
  id: string,
  action: LifecycleAction,
  profile = readProfile(),
) {
  return request<Reservation>(
    `/reservations/${encodeURIComponent(id)}/${action}`,
    {
      method: 'POST',
      profile,
    },
  );
}
