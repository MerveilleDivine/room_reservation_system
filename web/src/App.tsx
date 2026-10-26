import { useState } from 'react';
import {
  reservationAction,
  reserveAdditionalTime,
  saveReservation,
} from './api/client';
import type {
  BookingRequest,
  Person,
  Reservation,
  ReservationAction,
  Room,
} from './api/contracts';
import { BookingDialog } from './components/BookingDialog';
import { ContinuationDialog } from './components/ContinuationDialog';
import { ErrorNotice } from './components/Feedback';
import { Icon } from './components/Icon';
import { RoomsPage } from './pages/RoomsPage';
import type { SavedBooking } from './pages/ReservationsPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { UsersPage } from './pages/UsersPage';
import { UsagePage } from './pages/UsagePage';
import { useApi } from './hooks/useApi';
import { canManage, readProfile, storeProfile } from './lib/profile';

const pages = {
  reservations: {
    label: 'Reservations',
    icon: 'calendar',
    title: 'Reservations',
    description: 'Manage your meetings and room bookings.',
  },
  rooms: {
    label: 'Rooms',
    icon: 'rooms',
    title: 'Find your room.',
    description: 'Choose a space for your next meeting.',
  },
  users: {
    label: 'People',
    icon: 'users',
    title: 'People',
    description: 'Organizers and their active reservations.',
  },
  usage: {
    label: 'Usage',
    icon: 'chart',
    title: 'Room usage',
    description: 'See how your meeting spaces are being used.',
  },
} as const;
type Page = keyof typeof pages;
type BookingForm = {
  reservation: Reservation | null;
  roomId?: string;
  startUtc?: string;
  endUtc?: string;
};

export function App() {
  const [profile, setProfile] = useState(readProfile);
  const [page, setPage] = useState<Page>('reservations');
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<BookingForm | null>(null);
  const [continuation, setContinuation] = useState<Reservation | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<Error | null>(null);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState<SavedBooking | null>(null);
  const [scheduleVersion, setScheduleVersion] = useState(0);
  const allRooms = useApi<Room[]>('/rooms', revision);
  const people = useApi<Person[]>('/users', revision);
  const refresh = () => setRevision((value) => value + 1);
  const current = pages[page];
  const person = people.data?.find((item) => item.id === profile);
  const displayName = profile === 'admin' ? 'Administrator' : person?.firstName;
  const [today] = useState(() => new Date());
  const dateLabel = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  }).format(today);
  const greeting =
    today.getHours() < 12
      ? 'Good morning'
      : today.getHours() < 18
        ? 'Good afternoon'
        : 'Good evening';

  async function save(
    request: BookingRequest,
    id: string | undefined,
    submissionKey: string,
  ) {
    setPending(true);
    try {
      const reservation = await saveReservation(request, id, submissionKey);
      setSaved({ reservation, label: id ? 'Changes saved' : 'You’re booked' });
      setScheduleVersion((value) => value + 1);
      setForm(null);
      setPage('reservations');
      setNotice('');
      refresh();
    } finally {
      setPending(false);
    }
  }

  async function saveContinuation(
    id: string,
    additionalMinutes: number,
    submissionKey: string,
  ) {
    setPending(true);
    try {
      const reservation = await reserveAdditionalTime(
        id,
        additionalMinutes,
        submissionKey,
      );
      setSaved({ reservation, label: 'Extra time reserved' });
      setScheduleVersion((value) => value + 1);
      setPage('reservations');
      setContinuation(null);
      setNotice('');
      refresh();
    } finally {
      setPending(false);
    }
  }

  async function handleAction(
    reservation: Reservation,
    action: ReservationAction,
  ) {
    if (!canManage(profile, reservation.organizerId)) return;
    setActionError(null);
    setNotice('');
    if (action === 'edit') {
      setForm({ reservation });
      return;
    }
    if (action === 'reserve-more') {
      setContinuation(reservation);
      return;
    }
    if (
      action !== 'check-in' &&
      !window.confirm(
        action === 'cancel'
          ? 'Cancel “' + reservation.title + '”?'
          : 'End “' + reservation.title + '” now and release the room?',
      )
    )
      return;
    setPending(true);
    try {
      await reservationAction(reservation.id, action);
      setSaved(null);
      setNotice(
        action === 'check-in'
          ? 'Checked in.'
          : action === 'end'
            ? 'Meeting ended. The room is released.'
            : 'Reservation cancelled.',
      );
      refresh();
    } catch (error) {
      setActionError(
        error instanceof Error ? error : new Error('Action failed.'),
      );
    } finally {
      setPending(false);
    }
  }

  const canBook = Boolean(
    allRooms.data &&
      people.data &&
      !allRooms.error &&
      !people.error &&
      (profile === 'admin' ||
        people.data.some((person) => person.id === profile)),
  );

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="#main">
            <span className="brand-mark">
              <Icon name="door" size={20} />
            </span>
            <span>Roomwise</span>
          </a>
          <nav aria-label="Main navigation">
            {(Object.keys(pages) as Page[]).map((item) => (
              <button
                key={item}
                className={page === item ? 'nav-item selected' : 'nav-item'}
                aria-current={page === item ? 'page' : undefined}
                onClick={() => {
                  setPage(item);
                  setSaved(null);
                  window.scrollTo({ top: 0 });
                  setNotice('');
                  setActionError(null);
                }}
              >
                <span>{pages[item].label}</span>
              </button>
            ))}
          </nav>
          <div className="header-actions">
            <label className="profile-switcher">
              <span className="sr-only">Current profile</span>
              <select
                aria-label="Current profile"
                value={profile}
                disabled={pending || !people.data}
                onChange={(event) => {
                  const next = event.target.value;
                  storeProfile(next);
                  setProfile(next);
                  setSaved(null);
                  setPage('reservations');
                  setForm(null);
                  setContinuation(null);
                  setNotice('');
                  setActionError(null);
                  refresh();
                }}
              >
                {!people.data ? <option value={profile}>Profile</option> : null}
                {people.data?.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.firstName} {person.lastName}
                  </option>
                ))}
                <option value="admin">Administrator</option>
              </select>
            </label>
            <button
              className="icon-button"
              aria-label="Refresh workspace"
              title="Refresh"
              onClick={() => {
                setSaved(null);
                refresh();
              }}
            >
              <Icon name="refresh" size={17} />
            </button>
            <button
              className="button primary new-booking"
              disabled={!canBook}
              onClick={() => {
                setNotice('');
                setForm({ reservation: null });
              }}
            >
              <Icon name="plus" size={16} />
              <span className="booking-button-label">New reservation</span>
            </button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} aria-busy={pending}>
        <div className="main-content">
          <section className="page-intro">
            <div className="intro-text">
              <p className="eyebrow">
                {page === 'reservations' ? dateLabel : 'Your workspace'}
              </p>
              <h1>
                {page === 'reservations'
                  ? `${greeting}${displayName ? `, ${displayName}` : ''}.`
                  : current.title}
              </h1>
              <p className="intro-copy">
                {page === 'reservations'
                  ? profile === 'admin'
                    ? 'A clear view of what’s next across the workspace.'
                    : 'Your meetings, without the back and forth.'
                  : current.description}
              </p>
            </div>
          </section>
          {notice ? (
            <div className="notice success" role="status">
              <Icon name="check" size={18} />
              <span>{notice}</span>
              <button
                className="icon-button"
                aria-label="Dismiss confirmation"
                onClick={() => setNotice('')}
              >
                <Icon name="close" size={15} />
              </button>
            </div>
          ) : null}
          {actionError ? <ErrorNotice error={actionError} /> : null}
          {people.error && !allRooms.error && page !== 'users' ? (
            <ErrorNotice error={people.error} />
          ) : null}
          {page === 'rooms' ? (
            <RoomsPage
              allRooms={allRooms}
              revision={revision}
              canBook={canBook}
              profile={profile}
              onBook={(roomId, startUtc, endUtc) =>
                setForm({ reservation: null, roomId, startUtc, endUtc })
              }
            />
          ) : null}
          {page === 'reservations' ? (
            <ReservationsPage
              key={`${profile}:${scheduleVersion}`}
              saved={saved}
              onDismissSaved={() => setSaved(null)}
              onBook={() => setForm({ reservation: null })}
              onRefresh={() => {
                setSaved(null);
                refresh();
              }}
              profile={profile}
              rooms={allRooms.data ?? []}
              people={people.data ?? []}
              revision={revision}
              pending={pending}
              onAction={(reservation, action) => {
                void handleAction(reservation, action);
              }}
            />
          ) : null}
          {page === 'users' ? <UsersPage people={people} /> : null}
          {page === 'usage' ? (
            <UsagePage rooms={allRooms.data ?? []} revision={revision} />
          ) : null}
          <footer className="main-footer">
            <span>
              © {new Date().getFullYear()} Mervine Muganguzi · Roomwise
            </span>
          </footer>
        </div>
      </main>
      {form && allRooms.data && people.data ? (
        <BookingDialog
          organizerId={profile === 'admin' ? undefined : profile}
          rooms={allRooms.data}
          people={people.data}
          initial={form.reservation}
          preferredRoomId={form.roomId}
          preferredStartUtc={form.startUtc}
          preferredEndUtc={form.endUtc}
          onSave={save}
          onClose={() => setForm(null)}
        />
      ) : null}
      {continuation ? (
        <ContinuationDialog
          reservation={continuation}
          onSave={saveContinuation}
          onClose={() => setContinuation(null)}
        />
      ) : null}
    </div>
  );
}
