import { describe, expect, it, vi } from 'vitest';
import { reservation } from '../test/fixtures';
import {
  ApiError,
  request,
  reserveAdditionalTime,
  saveReservation,
} from './client';

describe('API boundary', () => {
  it('preserves the server error code and readable message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            code: 'ROOM_OVERLAP',
            detail: 'This room is already booked during that time.',
          }),
          { status: 409 },
        ),
      ),
    );
    await expect(request('/reservations')).rejects.toMatchObject({
      code: 'ROOM_OVERLAP',
      message: 'This room is already booked during that time.',
    });
  });

  it('shows an actionable message when the API is offline', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockRejectedValue(new TypeError('Failed to fetch')),
    );
    await expect(request('/rooms')).rejects.toMatchObject({
      code: 'API_UNAVAILABLE',
      message: expect.stringContaining('Cannot reach the booking service'),
    });
  });

  it('does not turn an aborted request into a network error', async () => {
    const aborted = new DOMException('Aborted', 'AbortError');
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(aborted));
    await expect(request('/rooms')).rejects.toBe(aborted);
  });

  it('handles a non-JSON server failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValue(new Response('Proxy unavailable', { status: 502 })),
    );
    await expect(request('/rooms')).rejects.toBeInstanceOf(ApiError);
  });

  it('uses PUT when editing and sends UTC fields unchanged', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}'));
    vi.stubGlobal('fetch', fetchMock);
    const booking = {
      roomId: 'room',
      organizerId: 'organizer',
      title: 'Planning',
      startUtc: '2026-10-25T09:00:00Z',
      endUtc: '2026-10-25T10:00:00Z',
      attendees: 4,
    };
    await saveReservation(booking, 'reservation-id');
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/reservations/reservation-id',
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(booking) }),
    );
  });

  it.each(['network', 'server', 'unreadable'])(
    'recovers a saved booking after a lost %s confirmation',
    async (failure) => {
      const fetchMock = vi.fn();
      if (failure === 'network')
        fetchMock.mockRejectedValueOnce(new TypeError('Connection lost'));
      else
        fetchMock.mockResolvedValueOnce(
          new Response(
            failure === 'server' ? 'Unavailable' : '<html>Unexpected</html>',
            { status: failure === 'server' ? 502 : 200 },
          ),
        );
      fetchMock.mockResolvedValueOnce(
        new Response(JSON.stringify(reservation)),
      );
      vi.stubGlobal('fetch', fetchMock);
      const key = crypto.randomUUID();
      const result = await saveReservation(reservation, undefined, key);
      expect(result.id).toBe(reservation.id);
      expect(fetchMock).toHaveBeenCalledTimes(2);
      expect(
        (fetchMock.mock.calls[0]![1] as RequestInit).headers,
      ).toBeInstanceOf(Headers);
      expect(
        new Headers((fetchMock.mock.calls[0]![1] as RequestInit).headers).get(
          'Idempotency-Key',
        ),
      ).toBe(key);
      expect(fetchMock).toHaveBeenLastCalledWith(
        `/api/booking-requests/${key}`,
        expect.objectContaining({ cache: 'no-store' }),
      );
    },
  );

  it('keeps a definite conflict as a validation failure without a recovery lookup', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'ROOM_OVERLAP',
          detail: 'Room already booked.',
        }),
        { status: 409 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    await expect(saveReservation(reservation)).rejects.toMatchObject({
      code: 'ROOM_OVERLAP',
      outcomeUnknown: false,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('preserves uncertainty if no receipt can be found and reuses the supplied key on retry', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Lost response'))
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(reservation)));
    vi.stubGlobal('fetch', fetchMock);
    const key = crypto.randomUUID();
    await expect(
      saveReservation(reservation, undefined, key),
    ).rejects.toMatchObject({
      code: 'BOOKING_UNCONFIRMED',
      outcomeUnknown: true,
    });
    expect((await saveReservation(reservation, undefined, key)).id).toBe(
      reservation.id,
    );
    const first = new Headers(
      (fetchMock.mock.calls[0]![1] as RequestInit).headers,
    );
    const retry = new Headers(
      (fetchMock.mock.calls[2]![1] as RequestInit).headers,
    );
    expect(retry.get('Idempotency-Key')).toBe(first.get('Idempotency-Key'));
  });

  it('uses the same recovery protocol for additional time', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Lost response'))
      .mockResolvedValueOnce(new Response(JSON.stringify(reservation)));
    vi.stubGlobal('fetch', fetchMock);
    const key = crypto.randomUUID();
    await expect(
      reserveAdditionalTime('parent-id', 30, key),
    ).resolves.toMatchObject({ id: reservation.id });
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      '/api/reservations/parent-id/continuations',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ additionalMinutes: 30 }),
      }),
    );
  });
});
