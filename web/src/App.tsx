import { useEffect, useState } from 'react';
import { reservationAction, saveReservation } from './api/client';
import type {
  BookingPolicy,
  BookingRequest,
  Person,
  Reservation,
  ReservationAction,
  Room,
} from './api/contracts';
import { BookingDialog } from './components/BookingDialog';
import { ErrorNotice } from './components/Feedback';
import { Icon } from './components/Icon';
import { RoomsPage } from './pages/RoomsPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { UsersPage } from './pages/UsersPage';
import { UsagePage } from './pages/UsagePage';
import { useApi } from './hooks/useApi';

const pages = {
  rooms: {
    label: 'Rooms',
    icon: 'rooms',
    title: 'Meeting rooms',
    description: 'Find a space for your next meeting.',
  },
  reservations: {
    label: 'Reservations',
    icon: 'calendar',
    title: 'Reservations',
    description: 'Manage your meetings and room bookings.',
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
    description: 'See how booked time compares with confirmed use.',
  },
} as const;
type Page = keyof typeof pages;
type BookingForm = { reservation: Reservation | null; roomId?: string };
const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

export function App() {
  const [page, setPage] = useState<Page>('rooms');
  const [revision, setRevision] = useState(0);
  const [form, setForm] = useState<BookingForm | null>(null);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState<Error | null>(null);
  const [notice, setNotice] = useState('');
  const allRooms = useApi<Room[]>('/rooms', revision);
  const people = useApi<Person[]>('/users', revision);
  const policy = useApi<BookingPolicy>('/booking-policy', 0);
  const refresh = () => setRevision((value) => value + 1);
  const current = pages[page];

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!document.hidden) setRevision((value) => value + 1);
    }, 30_000);
    return () => window.clearInterval(timer);
  }, []);

  async function save(request: BookingRequest, id?: string) {
    await saveReservation(request, id);
    setForm(null);
    setPage('reservations');
    setNotice(id ? 'Reservation updated.' : 'Reservation created.');
    refresh();
  }

  async function handleAction(
    reservation: Reservation,
    action: ReservationAction,
  ) {
    setActionError(null);
    setNotice('');
    if (action === 'edit') {
      setForm({ reservation });
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
    allRooms.data && people.data && !allRooms.error && !people.error,
  );

  return (
    <div className="app-shell">
      <a href="#main" className="skip-link">
        Skip to content
      </a>
      <aside className="sidebar">
        <a className="brand" href="#main">
          <Icon name="rooms" size={23} />
          <span>Roomwise</span>
        </a>
        <p className="sidebar-label">Workspace</p>
        <nav aria-label="Main navigation">
          {(Object.keys(pages) as Page[]).map((item) => (
            <button
              key={item}
              className={page === item ? 'nav-item selected' : 'nav-item'}
              aria-current={page === item ? 'page' : undefined}
              onClick={() => {
                setPage(item);
                setNotice('');
                setActionError(null);
              }}
            >
              <Icon name={pages[item].icon} />
              <span>{pages[item].label}</span>
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <span className="workspace-avatar">R</span>
          <div>
            <strong>Shared workspace</strong>
            <small>Meeting rooms</small>
          </div>
        </div>
      </aside>
      <main id="main" tabIndex={-1}>
        <header className="topbar">
          <span>
            Workspace <span className="breadcrumb-divider">/</span>{' '}
            <span className="breadcrumb-current">{current.label}</span>
          </span>
          <button
            className="icon-button"
            aria-label="Refresh workspace"
            title="Refresh"
            onClick={refresh}
          >
            <Icon name="refresh" size={17} />
          </button>
        </header>
        <div className="main-content">
          <section className="page-intro">
            <div>
              <h1>{current.title}</h1>
              <p className="intro-copy">{current.description}</p>
            </div>
            <button
              className="button primary new-booking"
              disabled={!canBook}
              onClick={() => {
                setNotice('');
                setForm({ reservation: null });
              }}
            >
              <Icon name="plus" size={17} />
              New reservation
            </button>
          </section>
          {notice ? (
            <div className="notice success" role="status">
              {notice}
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
              onBook={(roomId) => setForm({ reservation: null, roomId })}
            />
          ) : null}
          {page === 'reservations' ? (
            <ReservationsPage
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
            <span>Demo data resets when the server restarts.</span>
            <span>Times in {timezone}</span>
            {policy.data ? (
              <span>
                Bookings up to {policy.data.maximumDurationDays} days ·{' '}
                {policy.data.maximumAdvanceDays} days ahead
              </span>
            ) : null}
          </footer>
        </div>
      </main>
      {form && allRooms.data && people.data ? (
        <BookingDialog
          rooms={allRooms.data}
          people={people.data}
          initial={form.reservation}
          preferredRoomId={form.roomId}
          onSave={save}
          onClose={() => setForm(null)}
        />
      ) : null}
    </div>
  );
}
