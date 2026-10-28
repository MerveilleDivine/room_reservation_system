import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { people, reservation, rooms } from './test/fixtures';

function mockApi() {
  const fetchMock = vi.fn(async (url: string) => {
    const data = url.startsWith('/api/rooms')
      ? rooms
      : url.startsWith('/api/room-availability')
        ? rooms.map((room) => ({
            roomId: room.id,
            isAvailable: room.isActive,
            reason: null,
          }))
        : url.startsWith('/api/users')
          ? people
          : { items: [reservation], totalCount: 1, page: 1, pageSize: 6 };
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('workspace', () => {
  it('opens on a personal upcoming schedule, greets the person and makes no requests while idle', async () => {
    const fetchMock = mockApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Planning' });
    expect(screen.getByRole('heading', { name: /Alex\./ })).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Atlas' }),
    ).not.toBeInTheDocument();
    expect(
      fetchMock.mock.calls.some(
        ([url]) =>
          url.includes('view=upcoming') &&
          url.includes('organizerId=' + people[0]!.id),
      ),
    ).toBe(true);
    const count = fetchMock.mock.calls.length;
    vi.useFakeTimers();
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(count);
    } finally {
      vi.useRealTimers();
    }
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Refresh schedule' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(count),
    );
  });

  it('shows compact room search with real slot availability and disables inactive rooms', async () => {
    mockApi();
    render(<App />);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Rooms' }));
    expect(
      await screen.findByRole('heading', { name: 'Atlas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Not accepting bookings/ }),
    ).toBeDisabled();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('checkbox', { name: 'Projector' }),
    ).not.toBeInTheDocument();
  });

  it('offers advanced equipment filters on demand', async () => {
    const fetchMock = mockApi();
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Rooms' }));
    await screen.findByRole('heading', { name: 'Atlas' });
    await user.click(screen.getByRole('button', { name: 'Filters' }));
    await user.click(screen.getByRole('checkbox', { name: 'Projector' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/rooms?equipment=projector',
        expect.anything(),
      ),
    );
  });

  it('shows owned actions and active counts without mixing views', async () => {
    mockApi();
    render(<App />);
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Planning' });
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Check in' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'People' }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Usage' }),
    ).not.toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText('Current profile'), 'admin');
    await user.click(screen.getByRole('button', { name: 'People' }));
    expect(
      await screen.findByRole('heading', { name: 'Alex Morgan' }),
    ).toBeInTheDocument();
    expect(screen.getByText('active reservations')).toBeInTheDocument();
  });

  it('shows service failures without enabling a new booking', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')));
    render(<App />);
    const alerts = await screen.findAllByRole('alert');
    expect(
      alerts.every((alert) =>
        alert.textContent?.includes('Cannot reach the booking service'),
      ),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'New reservation' }),
    ).toBeDisabled();
  });

  it('refreshes a stale schedule after an action fails and clears that error on explicit refresh', async () => {
    const fetchMock = mockApi();
    const normalReply = fetchMock.getMockImplementation()!;
    let cancelledElsewhere = false;
    fetchMock.mockImplementation(async (url: string) => {
      if (url.endsWith('/cancel')) {
        cancelledElsewhere = true;
        return new Response(
          JSON.stringify({
            code: 'RESERVATION_NOT_ACTIVE',
            detail: 'This reservation is no longer active.',
          }),
          { status: 409 },
        );
      }
      if (url.startsWith('/api/reservation-feed') && cancelledElsewhere)
        return new Response(
          JSON.stringify({ items: [], totalCount: 0, page: 1, pageSize: 6 }),
        );
      return normalReply(url);
    });
    vi.stubGlobal('confirm', vi.fn().mockReturnValue(true));
    render(<App />);
    await screen.findByRole('heading', { name: 'Planning' });
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'no longer active',
    );
    await screen.findByRole('heading', {
      name: 'A little room in your schedule.',
    });
    expect(
      screen.queryByRole('heading', { name: 'Planning' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Refresh schedule' }));
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    );
  });
});
