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
import { RoomsPage } from './pages/RoomsPage';
import { ReservationsPage } from './pages/ReservationsPage';
import { UsersPage } from './pages/UsersPage';
import { useApi } from './hooks/useApi';

type Page = 'rooms' | 'reservations' | 'users';
type BookingForm = { reservation: Reservation | null; roomId?: string };

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

  useEffect(() => {
    const timer = window.setInterval(
      () => setRevision((value) => value + 1),
      30_000,
    );
    return () => window.clearInterval(timer);
  }, []);

  async function save(request: BookingRequest, id?: string) {
    await saveReservation(request, id);
    setForm(null);
    setPage('reservations');
    setNotice(id ? 'Reservation updated.' : 'Your reservation is booked.');
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
          ? `Cancel “${reservation.title}”?`
          : `End “${reservation.title}” now and release the room?`,
      )
    )
      return;
    setPending(true);
    try {
      await reservationAction(reservation.id, action);
      setNotice(
        action === 'check-in'
          ? 'Checked in. Observed usage starts now.'
          : action === 'end'
            ? 'Meeting ended. The room has been released.'
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
      <aside className="sidebar">
        <a className="brand" href="#main">
          <span className="brand-mark" aria-hidden="true">
            r<span>↗</span>
          </span>
          roomwise<span className="brand-dot">.</span>
        </a>
        <p className="sidebar-label">YOUR WORKPLACE</p>
        <nav aria-label="Main navigation">
          {(['rooms', 'reservations', 'users'] as const).map((item) => (
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
              <span aria-hidden="true">
                {item === 'rooms' ? '▦' : item === 'reservations' ? '▤' : '◉'}
              </span>
              {item === 'rooms'
                ? 'Meeting rooms'
                : item === 'reservations'
                  ? 'Reservations'
                  : 'Users'}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="workspace-avatar">W</div>
          <div>
            <strong>Workspace demo</strong>
            <small>No sign-in required</small>
          </div>
        </div>
      </aside>
      <main id="main">
        <header className="topbar">
          <span>
            WORKSPACE <span className="breadcrumb-divider">/</span>{' '}
            {page === 'rooms'
              ? 'Meeting rooms'
              : page === 'users'
                ? 'Users'
                : 'Reservations'}
          </span>
          <button className="text-button" onClick={refresh}>
            ↻ Refresh
          </button>
        </header>
        <div className="main-content">
          <section className="page-intro">
            <div>
              <p className="eyebrow">LESS FRICTION. MORE FOCUS.</p>
              <h1>
                {page === 'rooms' ? (
                  <>
                    Make space for
                    <br />
                    <em>good work.</em>
                  </>
                ) : page === 'reservations' ? (
                  <>
                    Good ideas.
                    <br />
                    <em>Time reserved.</em>
                  </>
                ) : (
                  <>
                    The people
                    <br />
                    <em>behind the plans.</em>
                  </>
                )}
              </h1>
              <p className="intro-copy">
                {page === 'rooms'
                  ? 'Find the right room, bring your people, and get things moving.'
                  : page === 'reservations'
                    ? 'One place to book, adjust and keep your meetings on track.'
                    : 'Meet your organizers and see their active reservations.'}
              </p>
            </div>
            <button
              className="button primary new-booking"
              disabled={!canBook}
              onClick={() => {
                setNotice('');
                setForm({ reservation: null });
              }}
            >
              <span aria-hidden="true">＋</span> New reservation
            </button>
          </section>
          <div className="workspace-notes">
            <span>
              <i className="status-dot" />
              Local in-memory workspace
            </span>
            {policy.data ? (
              <span>
                Up to {policy.data.maximumDurationDays} days per booking{' '}
                <span className="dot">·</span> {policy.data.maximumAdvanceDays}
                -day booking window
              </span>
            ) : null}
            <span>Times shown in your device’s timezone</span>
          </div>
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
          <footer className="main-footer">
            <span>ROOMWISE / A LITTLE MORE ROOM FOR WHAT MATTERS</span>
            <span>Demo data resets when the API restarts.</span>
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
