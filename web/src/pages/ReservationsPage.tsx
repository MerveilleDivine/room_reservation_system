import { useState } from 'react';
import type {
  Person,
  Reservation,
  ReservationAction,
  Room,
} from '../api/contracts';
import { ErrorNotice } from '../components/Feedback';
import { ReservationList } from '../components/ReservationList';
import { useApi } from '../hooks/useApi';
import { toUtc } from '../lib/dates';

export function ReservationsPage({
  profile,
  rooms,
  people,
  revision,
  pending,
  onAction,
}: {
  profile: string;
  rooms: Room[];
  people: Person[];
  revision: number;
  pending: boolean;
  onAction: (reservation: Reservation, action: ReservationAction) => void;
}) {
  const [room, setRoom] = useState('');
  const [organizer, setOrganizer] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const query = new URLSearchParams();
  if (room) query.set('roomId', room);
  if (organizer) query.set('organizerId', organizer);
  if (status) query.set('status', status);
  if (from) query.set('from', toUtc(from));
  if (to) query.set('to', toUtc(to));
  const reservations = useApi<Reservation[]>(
    '/reservations?' + query,
    revision,
  );

  return (
    <section aria-labelledby="reservations-heading">
      <div className="section-heading">
        <h2 id="reservations-heading">Meeting schedule</h2>
        {query.size ? (
          <button
            className="text-button"
            onClick={() => {
              setRoom('');
              setOrganizer('');
              setStatus('');
              setFrom('');
              setTo('');
            }}
          >
            Clear filters
          </button>
        ) : null}
      </div>
      <div className="filters reservation-filters">
        <label>
          Room
          <select
            value={room}
            onChange={(event) => setRoom(event.target.value)}
          >
            <option value="">All rooms</option>
            {rooms.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Organizer
          <select
            value={organizer}
            onChange={(event) => setOrganizer(event.target.value)}
          >
            <option value="">All organizers</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.firstName} {person.lastName}
              </option>
            ))}
          </select>
        </label>
        <label>
          Status
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value)}
          >
            <option value="">All statuses</option>
            <option>Booked</option>
            <option>Completed</option>
            <option>Cancelled</option>
          </select>
        </label>
        <label>
          From
          <input
            aria-label="Reservations from"
            type="datetime-local"
            value={from}
            onChange={(event) => setFrom(event.target.value)}
          />
        </label>
        <label>
          Until
          <input
            aria-label="Reservations until"
            type="datetime-local"
            value={to}
            onChange={(event) => setTo(event.target.value)}
          />
        </label>
      </div>
      {reservations.error ? (
        <ErrorNotice error={reservations.error} />
      ) : reservations.loading ? (
        <p className="loading" role="status">
          Loading reservations…
        </p>
      ) : reservations.data ? (
        <ReservationList
          profile={profile}
          reservations={reservations.data}
          pending={pending}
          onAction={onAction}
        />
      ) : null}
    </section>
  );
}
