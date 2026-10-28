import { useEffect, useRef, useState } from 'react';
import type {
  Person,
  Reservation,
  ReservationAction,
  ReservationFeed,
  Room,
} from '../api/contracts';
import { ErrorNotice } from '../components/Feedback';
import { ReservationList } from '../components/ReservationList';
import { Icon } from '../components/Icon';
import { useApi } from '../hooks/useApi';
import { toUtc } from '../lib/dates';

export interface SavedBooking {
  reservation: Reservation;
  label: string;
}
const pageSize = 6;

export function ReservationsPage({
  profile,
  rooms,
  people,
  revision,
  pending,
  saved,
  onDismissSaved,
  onAction,
  onBook,
  onRefresh,
}: {
  profile: string;
  rooms: Room[];
  people: Person[];
  revision: number;
  pending: boolean;
  saved: SavedBooking | null;
  onDismissSaved: () => void;
  onAction: (reservation: Reservation, action: ReservationAction) => void;
  onBook: () => void;
  onRefresh: () => void;
}) {
  const scope = profile === 'admin' ? 'workspace' : 'mine';
  const [view, setView] = useState<'upcoming' | 'history'>('upcoming');
  const [page, setPage] = useState(1);
  const [focusId, setFocusId] = useState(saved?.reservation.id ?? null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [room, setRoom] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const scheduleHeading = useRef<HTMLHeadingElement>(null);
  const query = new URLSearchParams({
    view,
    page: String(focusId && saved ? 1 : page),
    pageSize: String(pageSize),
  });
  if (room) query.set('roomId', room);
  if (focusId && saved) query.set('focusId', focusId);
  if (scope === 'mine') query.set('organizerId', profile);
  else if (organizer) query.set('organizerId', organizer);
  if (status) query.set('status', status);
  if (from) query.set('from', toUtc(from));
  if (to) query.set('to', toUtc(to));
  const feed = useApi<ReservationFeed>('/reservation-feed?' + query, revision);
  const totalPages = Math.max(
    1,
    Math.ceil((feed.data?.totalCount ?? 0) / pageSize),
  );
  const activeFilters = [
    room,
    scope === 'workspace' ? organizer : '',
    status,
    from,
    to,
  ].filter(Boolean).length;

  useEffect(() => {
    if (feed.data && focusId && saved) {
      setPage(feed.data.page);
    }
  }, [feed.data, focusId, saved]);
  useEffect(() => {
    if (saved) confirmationHeading.current?.focus();
  }, [saved]);
  useEffect(() => {
    if (feed.data && page > totalPages) setPage(totalPages);
  }, [feed.data, page, totalPages]);

  function changeView(next: 'upcoming' | 'history') {
    setView(next);
    setStatus('');
    setFocusId(null);
    setPage(1);
    onDismissSaved();
  }
  function clearFilters() {
    setFocusId(null);
    setRoom('');
    setOrganizer('');
    setStatus('');
    setFrom('');
    setTo('');
    setPage(1);
  }
  const items = feed.data?.items ?? [];

  return (
    <section aria-label="Reservation schedule">
      {saved ? (
        <section
          className="booking-confirmation"
          aria-labelledby="booking-confirmed"
        >
          <div className="confirmation-heading">
            <h2 id="booking-confirmed" ref={confirmationHeading} tabIndex={-1}>
              <Icon name="check" /> {saved.label}
            </h2>
            <button
              className="icon-button"
              aria-label="Dismiss booking confirmation"
              onClick={onDismissSaved}
            >
              <Icon name="close" size={16} />
            </button>
          </div>
          <p>{saved.reservation.title} is in your schedule below.</p>
        </section>
      ) : null}
      <div className="schedule-toolbar">
        <div
          className="segmented-control"
          role="group"
          aria-label="Reservation period"
        >
          <button
            aria-pressed={view === 'upcoming'}
            onClick={() => changeView('upcoming')}
          >
            Upcoming
          </button>
          <button
            aria-pressed={view === 'history'}
            onClick={() => changeView('history')}
          >
            History
          </button>
        </div>
        <div className="schedule-tools">
          <span className="scope-label">
            {profile === 'admin' ? 'All bookings' : 'My bookings'}
          </span>
          <button
            className="button secondary filter-toggle"
            aria-expanded={filtersOpen}
            aria-controls="reservation-filters"
            onClick={() => setFiltersOpen((open) => !open)}
          >
            <Icon name="filter" size={16} /> Filters
            {activeFilters ? ` (${activeFilters})` : ''}
          </button>
          <button
            className="icon-button"
            aria-label="Refresh schedule"
            onClick={onRefresh}
          >
            <Icon name="refresh" size={16} />
          </button>
        </div>
      </div>
      {filtersOpen ? (
        <div className="filter-panel" id="reservation-filters">
          <div className="filters reservation-filters">
            <label>
              Room
              <select
                value={room}
                onChange={(event) => {
                  setFocusId(null);
                  setRoom(event.target.value);
                  setPage(1);
                }}
              >
                <option value="">All rooms</option>
                {rooms.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </label>
            {scope === 'workspace' ? (
              <label>
                Organizer
                <select
                  value={organizer}
                  onChange={(event) => {
                    setFocusId(null);
                    setOrganizer(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All organizers</option>
                  {people.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.firstName} {person.lastName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {view === 'history' ? (
              <label>
                Status
                <select
                  value={status}
                  onChange={(event) => {
                    setFocusId(null);
                    setStatus(event.target.value);
                    setPage(1);
                  }}
                >
                  <option value="">All history</option>
                  <option>Completed</option>
                  <option>Cancelled</option>
                </select>
              </label>
            ) : null}
            <label>
              From
              <input
                aria-label="Reservations from"
                type="datetime-local"
                value={from}
                onChange={(event) => {
                  setFocusId(null);
                  setFrom(event.target.value);
                  setPage(1);
                }}
              />
            </label>
            <label>
              Until
              <input
                aria-label="Reservations until"
                type="datetime-local"
                value={to}
                onChange={(event) => {
                  setFocusId(null);
                  setTo(event.target.value);
                  setPage(1);
                }}
              />
            </label>
          </div>
          {activeFilters ? (
            <button className="text-button" onClick={clearFilters}>
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="schedule-heading">
        <h2 ref={scheduleHeading} tabIndex={-1}>
          {view === 'history'
            ? 'Past & cancelled'
            : scope === 'mine'
              ? 'Your upcoming meetings'
              : 'Workspace schedule'}
        </h2>
        {feed.data ? (
          <span>
            {feed.data.totalCount}{' '}
            {feed.data.totalCount === 1 ? 'reservation' : 'reservations'}
          </span>
        ) : null}
      </div>
      {feed.error ? (
        <ErrorNotice error={feed.error} />
      ) : feed.loading ? (
        <div className="schedule-loading" role="status">
          Loading your schedule…
        </div>
      ) : feed.data ? (
        <>
          {items.length ? (
            <ReservationList
              profile={profile}
              reservations={items}
              pending={pending}
              onAction={onAction}
            />
          ) : (
            <div className="schedule-empty">
              <span className="empty-icon">
                <Icon name="calendar" size={24} />
              </span>
              <h3>
                {activeFilters
                  ? 'No meetings match those filters.'
                  : view === 'history'
                    ? 'No past reservations yet.'
                    : 'A little room in your schedule.'}
              </h3>
              <p>
                {activeFilters
                  ? 'Try a different date or room.'
                  : view === 'history'
                    ? 'Completed and cancelled meetings will be here.'
                    : 'Book a space when you need one.'}
              </p>
              {activeFilters ? (
                <button className="button secondary" onClick={clearFilters}>
                  Clear filters
                </button>
              ) : view === 'upcoming' ? (
                <button
                  className="button primary"
                  onClick={onBook}
                  disabled={!rooms.length || !people.length}
                >
                  <Icon name="plus" size={16} /> Book a room
                </button>
              ) : null}
            </div>
          )}
          {totalPages > 1 ? (
            <nav className="pagination" aria-label="Reservation pages">
              <span>
                Page {page} of {totalPages}
              </span>
              <div>
                <button
                  className="button secondary"
                  disabled={page <= 1}
                  onClick={() => {
                    setFocusId(null);
                    setPage((value) => value - 1);
                    scheduleHeading.current?.focus();
                  }}
                >
                  Previous
                </button>
                <button
                  className="button secondary"
                  disabled={page >= totalPages}
                  onClick={() => {
                    setFocusId(null);
                    setPage((value) => value + 1);
                    scheduleHeading.current?.focus();
                  }}
                >
                  Next
                </button>
              </div>
            </nav>
          ) : null}
        </>
      ) : null}
    </section>
  );
}
