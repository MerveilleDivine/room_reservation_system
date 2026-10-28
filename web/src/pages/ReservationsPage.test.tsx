import type { ComponentProps } from 'react';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Reservation, ReservationFeed } from '../api/contracts';
import { people, reservation, rooms } from '../test/fixtures';
import { ReservationsPage } from './ReservationsPage';

const memberId = people[0]!.id;

function envelope(
  items: Reservation[],
  page = 1,
  totalCount = items.length,
): ReservationFeed {
  return { items, totalCount, page, pageSize: 6 };
}

function response(feed: ReservationFeed) {
  return new Response(JSON.stringify(feed), {
    headers: { 'Content-Type': 'application/json' },
  });
}

function renderSchedule(
  overrides: Partial<ComponentProps<typeof ReservationsPage>> = {},
) {
  const props: ComponentProps<typeof ReservationsPage> = {
    profile: memberId,
    rooms,
    people,
    revision: 0,
    pending: false,
    saved: null,
    onDismissSaved: vi.fn(),
    onAction: vi.fn(),
    onBook: vi.fn(),
    onRefresh: vi.fn(),
    ...overrides,
  };
  return { ...render(<ReservationsPage {...props} />), props };
}

function latestQuery(fetchMock: ReturnType<typeof vi.fn>) {
  const path = String(fetchMock.mock.calls.at(-1)![0]);
  expect(path.startsWith('/api/reservation-feed?')).toBe(true);
  return new URL(path, 'http://localhost').searchParams;
}

describe('reservation schedule', () => {
  it('opens on the selected members upcoming bookings without requesting history', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() =>
        Promise.resolve(response(envelope([reservation]))),
      );
    vi.stubGlobal('fetch', fetchMock);
    renderSchedule();

    expect(
      await screen.findByRole('heading', { name: 'Planning' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Upcoming' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('My bookings')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Everyone' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    expect(Object.fromEntries(latestQuery(fetchMock))).toEqual({
      view: 'upcoming',
      page: '1',
      pageSize: '6',
      organizerId: memberId,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('requests the second page on Next and starts history at page one only after it is selected', async () => {
    const second = {
      ...reservation,
      id: 'second-page',
      title: 'Second page meeting',
    };
    const historical: Reservation = {
      ...reservation,
      id: 'past',
      title: 'A finished meeting',
      status: 'Completed',
      allowedActions: [],
    };
    const fetchMock = vi.fn().mockImplementation((path: string) => {
      const query = new URL(path, 'http://localhost').searchParams;
      return Promise.resolve(
        response(
          query.get('view') === 'history'
            ? envelope([historical])
            : query.get('page') === '2'
              ? envelope([second], 2, 7)
              : envelope([reservation], 1, 7),
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    const { props } = renderSchedule();
    const user = userEvent.setup();
    await screen.findByRole('heading', { name: 'Planning' });
    await user.click(screen.getByRole('button', { name: 'Next' }));
    await screen.findByRole('heading', { name: 'Second page meeting' });
    expect(latestQuery(fetchMock).get('page')).toBe('2');
    expect(screen.getByText('Page 2 of 2')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'History' }));
    expect(
      await screen.findByRole('heading', { name: 'A finished meeting' }),
    ).toBeInTheDocument();
    expect(latestQuery(fetchMock).get('view')).toBe('history');
    expect(latestQuery(fetchMock).get('page')).toBe('1');
    expect(latestQuery(fetchMock).get('organizerId')).toBe(memberId);
    expect(
      screen.queryByRole('heading', { name: 'Second page meeting' }),
    ).not.toBeInTheDocument();
    expect(props.onDismissSaved).toHaveBeenCalled();
  });

  it('starts with collapsed filters and clears filters without changing the chosen period or workspace scope', async () => {
    const fetchMock = vi
      .fn()
      .mockImplementation(() => Promise.resolve(response(envelope([]))));
    vi.stubGlobal('fetch', fetchMock);
    renderSchedule({ profile: 'admin' });
    const user = userEvent.setup();
    await screen.findByRole('heading', {
      name: 'A little room in your schedule.',
    });
    const toggle = screen.getByRole('button', { name: /^Filters/ });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(
      screen.queryByLabelText('Room', { exact: true }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'History' }));
    await user.click(toggle);
    await user.selectOptions(
      screen.getByLabelText('Room', { exact: true }),
      rooms[0]!.id,
    );
    await user.selectOptions(
      screen.getByLabelText('Organizer', { exact: true }),
      memberId,
    );
    await user.selectOptions(
      screen.getByLabelText('Status', { exact: true }),
      'Cancelled',
    );
    fireEvent.change(screen.getByLabelText('Reservations from'), {
      target: { value: '2026-10-01T09:00' },
    });
    fireEvent.change(screen.getByLabelText('Reservations until'), {
      target: { value: '2026-10-30T09:00' },
    });
    await waitFor(() =>
      expect(latestQuery(fetchMock).get('to')).toBe(
        new Date('2026-10-30T09:00').toISOString(),
      ),
    );
    expect(screen.getByRole('button', { name: 'Filters (5)' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
    await user.click(screen.getByRole('button', { name: 'Filters (5)' }));
    expect(
      screen.queryByLabelText('Room', { exact: true }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters (5)' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
    await user.click(screen.getByRole('button', { name: 'Filters (5)' }));
    await user.click(
      within(document.getElementById('reservation-filters')!).getByRole(
        'button',
        { name: 'Clear filters' },
      ),
    );
    await waitFor(() =>
      expect(Object.fromEntries(latestQuery(fetchMock))).toEqual({
        view: 'history',
        page: '1',
        pageSize: '6',
      }),
    );
    expect(screen.getByText('All bookings')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'History' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('button', { name: 'Filters' })).toHaveAttribute(
      'aria-expanded',
      'true',
    );
  });

  it('keeps a newly saved booking in the chronological feed and focuses its confirmation without a duplicate row', async () => {
    const late: Reservation = {
      ...reservation,
      id: 'late',
      title: 'Next month planning',
      startUtc: '2030-12-10T09:00:00Z',
      endUtc: '2030-12-10T10:00:00Z',
    };
    const nearer: Reservation = {
      ...reservation,
      id: 'near',
      title: 'Tomorrow stand-up',
    };
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(() =>
          Promise.resolve(response(envelope([nearer, late]))),
        ),
    );
    const { props } = renderSchedule({
      saved: { reservation: late, label: 'Reservation confirmed.' },
    });
    await screen.findByRole('heading', { name: 'Tomorrow stand-up' });
    const heading = screen.getByRole('heading', {
      name: 'Reservation confirmed.',
    });
    expect(heading).toHaveFocus();
    expect(
      screen.getAllByRole('heading', { name: 'Next month planning' }),
    ).toHaveLength(1);
    const articles = screen.getAllByRole('article');
    expect(
      within(articles[0]!).getByRole('heading', {
        name: 'Tomorrow stand-up',
      }),
    ).toBeInTheDocument();
    expect(
      within(articles[1]!).getByRole('heading', {
        name: 'Next month planning',
      }),
    ).toBeInTheDocument();
    await userEvent
      .setup()
      .click(
        screen.getByRole('button', { name: 'Dismiss booking confirmation' }),
      );
    expect(props.onDismissSaved).toHaveBeenCalledOnce();
  });

  it('opens the page containing a saved booking, then lets the person navigate normally', async () => {
    const fetchMock = vi.fn().mockImplementation((path: string) => {
      const query = new URL(path, 'http://localhost').searchParams;
      return Promise.resolve(
        response(
          query.has('focusId')
            ? envelope([reservation], 2, 8)
            : envelope([], 1, 8),
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderSchedule({ saved: { reservation, label: 'You’re booked' } });
    await screen.findByRole('heading', { name: 'Planning' });
    await screen.findByText('Page 2 of 2');
    expect(latestQuery(fetchMock).get('focusId')).toBe(reservation.id);
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'Previous' }));
    await waitFor(() =>
      expect(latestQuery(fetchMock).has('focusId')).toBe(false),
    );
    expect(latestQuery(fetchMock).get('page')).toBe('1');
  });

  it('does not show the previous query while history is loading and keeps the personal scope', async () => {
    let finishWorkspace!: (value: Response) => void;
    const workspaceResponse = new Promise<Response>((resolve) => {
      finishWorkspace = resolve;
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response(envelope([reservation])))
      .mockReturnValueOnce(workspaceResponse);
    vi.stubGlobal('fetch', fetchMock);
    renderSchedule();
    await screen.findByRole('heading', { name: 'Planning' });
    await userEvent
      .setup()
      .click(screen.getByRole('button', { name: 'History' }));
    expect(
      screen.queryByRole('heading', { name: 'Planning' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading your schedule',
    );
    expect(latestQuery(fetchMock).get('organizerId')).toBe(memberId);
    expect(latestQuery(fetchMock).get('view')).toBe('history');
    const workspace = {
      ...reservation,
      id: 'workspace',
      title: 'Workspace meeting',
    };
    await act(async () => {
      finishWorkspace(response(envelope([workspace])));
    });
    expect(
      await screen.findByRole('heading', { name: 'Workspace meeting' }),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('heading', { name: 'Planning' }),
    ).not.toBeInTheDocument();
  });
});
