import { describe, expect, it, vi } from 'vitest';
import { ApiError, request, saveReservation } from './client';

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
      message: expect.stringContaining('5080'),
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
});
