import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';
import { people, reservation, rooms } from './test/fixtures';

function mockApi() {
  const fetchMock = vi.fn(async (url: string) => {
    const data = url.startsWith('/api/rooms')
      ? rooms
      : url.startsWith('/api/users')
        ? people
        : url.startsWith('/api/booking-policy')
          ? { maximumDurationDays: 7, maximumAdvanceDays: 90 }
          : [reservation];
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' },
    });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

describe('workspace', () => {
  it('makes no API requests while idle and still supports explicit refresh', async () => {
    const fetchMock = mockApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Atlas' });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /New reservation/ }),
      ).toBeEnabled(),
    );
    const initialRequests = fetchMock.mock.calls.length;

    vi.useFakeTimers();
    try {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(10 * 60_000);
      });
      expect(fetchMock).toHaveBeenCalledTimes(initialRequests);
    } finally {
      vi.useRealTimers();
    }

    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Refresh workspace' }));
    await waitFor(() =>
      expect(fetchMock.mock.calls.length).toBeGreaterThan(initialRequests),
    );
    expect(screen.getByRole('heading', { name: 'Atlas' })).toBeInTheDocument();
  });

  it('renders rooms and disables booking for an inactive room', async () => {
    mockApi();
    render(<App />);
    expect(
      await screen.findByRole('heading', { name: 'Atlas' }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /Not accepting bookings/ }),
    ).toBeDisabled();
  });

  it('sends equipment filters to the backend instead of applying booking rules locally', async () => {
    const fetchMock = mockApi();
    render(<App />);
    await screen.findByRole('heading', { name: 'Atlas' });
    await userEvent
      .setup()
      .click(screen.getByRole('checkbox', { name: 'Projector' }));
    await waitFor(() =>
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/rooms?equipment=projector',
        expect.anything(),
      ),
    );
  });

  it('shows API-provided reservation actions and active user counts', async () => {
    mockApi();
    render(<App />);
    const user = userEvent.setup();
    await user.click(screen.getByRole('button', { name: 'Reservations' }));
    expect(
      await screen.findByRole('heading', { name: 'Planning' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Check in' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'People' }));
    expect(
      await screen.findByRole('heading', { name: 'Alex Morgan' }),
    ).toBeInTheDocument();
    expect(screen.getByText('active reservations')).toBeInTheDocument();
  });

  it('shows a useful failure state and blocks a new booking when the API fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Offline')));
    render(<App />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Cannot reach the booking service',
    );
    expect(
      screen.getByRole('button', { name: /New reservation/ }),
    ).toBeDisabled();
  });
});
