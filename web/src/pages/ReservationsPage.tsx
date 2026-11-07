import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
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
import { reservationApi } from '../features/reservations/api';
import type { SavedBooking } from '../features/reservations/types';
import { toUtc } from '../lib/dates';
import { ReservationFilters } from './reservations/ReservationFilters';
import {
  BookingConfirmation,
  EmptySchedule,
  ReservationPagination,
} from './reservations/ReservationScheduleParts';
import {
  reservationPageSize,
  useReservationFilters,
} from './reservations/useReservationFilters';
import type { ReservationFilters as Filters } from './reservations/useReservationFilters';

interface Props {
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
}

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
}: Props) {
  const workspace = profile === 'admin';
  const { filters, updateFilters } = useReservationFilters();
  const [, setSearch] = useSearchParams();
  const [dismissedSaved, setDismissedSaved] = useState<SavedBooking | null>(
    null,
  );
  const confirmation = saved !== dismissedSaved ? saved : null;
  const focusId = confirmation?.reservation.id ?? null;
  const [filtersOpen, setFiltersOpen] = useState(false);
  const confirmationHeading = useRef<HTMLHeadingElement>(null);
  const scheduleHeading = useRef<HTMLHeadingElement>(null);
  const { view, page, roomId, organizerId, status, from, to } = filters;
  const query = new URLSearchParams({
    view,
    page: String(focusId && saved ? 1 : page),
    pageSize: String(reservationPageSize),
  });
  if (roomId) query.set('roomId', roomId);
  if (focusId && saved) query.set('focusId', focusId);
  if (!workspace) query.set('organizerId', profile);
  else if (organizerId) query.set('organizerId', organizerId);
  if (status) query.set('status', status);
  if (from) query.set('from', toUtc(from));
  if (to) query.set('to', toUtc(to));
  const feed = useApi<ReservationFeed>(
    reservationApi.feedPath(query),
    revision,
    profile,
  );
  const totalPages = Math.max(
    1,
    Math.ceil((feed.data?.totalCount ?? 0) / reservationPageSize),
  );
  const activeFilters = [
    roomId,
    workspace ? organizerId : '',
    status,
    from,
    to,
  ].filter(Boolean).length;
  const resolvedPage = feed.data
    ? focusId && saved
      ? feed.data.page
      : Math.min(page, totalPages)
    : page;

  useEffect(() => {
    if (!feed.data || resolvedPage === page) return;
    setSearch(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (resolvedPage === 1) next.delete('page');
        else next.set('page', String(resolvedPage));
        return next;
      },
      { replace: true },
    );
  }, [feed.data, page, resolvedPage, setSearch]);
  useEffect(() => {
    if (saved) confirmationHeading.current?.focus();
  }, [saved]);

  function changeFilters(patch: Partial<Filters>) {
    setDismissedSaved(saved);
    onDismissSaved();
    updateFilters({ ...patch, page: 1 });
  }
  function changePage(next: number) {
    setDismissedSaved(saved);
    onDismissSaved();
    updateFilters({ page: next });
    scheduleHeading.current?.focus();
  }
  function clearFilters() {
    changeFilters({
      roomId: '',
      organizerId: '',
      status: '',
      from: '',
      to: '',
    });
  }

  return (
    <section aria-label="Reservation schedule">
      {saved ? (
        <BookingConfirmation
          saved={saved}
          headingRef={confirmationHeading}
          onDismiss={onDismissSaved}
        />
      ) : null}
      <div className="schedule-toolbar">
        <div
          className="segmented-control"
          role="group"
          aria-label="Reservation period"
        >
          <button
            aria-pressed={view === 'upcoming'}
            onClick={() => changeFilters({ view: 'upcoming', status: '' })}
          >
            Upcoming
          </button>
          <button
            aria-pressed={view === 'history'}
            onClick={() => changeFilters({ view: 'history', status: '' })}
          >
            History
          </button>
        </div>
        <div className="schedule-tools">
          <span className="scope-label">
            {workspace ? 'All bookings' : 'My bookings'}
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
        <ReservationFilters
          filters={filters}
          rooms={rooms}
          people={people}
          workspace={workspace}
          activeCount={activeFilters}
          onChange={changeFilters}
          onClear={clearFilters}
        />
      ) : null}
      <div className="schedule-heading">
        <h2 ref={scheduleHeading} tabIndex={-1}>
          {view === 'history'
            ? 'Past & cancelled'
            : workspace
              ? 'Workspace schedule'
              : 'Your upcoming meetings'}
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
          {feed.data.items.length ? (
            <ReservationList
              profile={profile}
              reservations={feed.data.items}
              pending={pending}
              onAction={onAction}
            />
          ) : (
            <EmptySchedule
              filtered={activeFilters > 0}
              history={view === 'history'}
              canBook={rooms.length > 0 && people.length > 0}
              onClear={clearFilters}
              onBook={onBook}
            />
          )}
          <ReservationPagination
            page={resolvedPage}
            totalPages={totalPages}
            onChange={changePage}
          />
        </>
      ) : null}
    </section>
  );
}
