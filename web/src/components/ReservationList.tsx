import type { Reservation, ReservationAction } from '../api/contracts';
import { formatDate, formatTime } from '../lib/dates';
import { EmptyState } from './Feedback';

const actionLabels: Record<ReservationAction, string> = {
  edit: 'Edit',
  cancel: 'Cancel',
  'check-in': 'Check in',
  end: 'End early',
};

export function ReservationList({
  reservations,
  pending,
  onAction,
}: {
  reservations: Reservation[];
  pending: boolean;
  onAction: (reservation: Reservation, action: ReservationAction) => void;
}) {
  if (reservations.length === 0)
    return (
      <EmptyState
        title="Space for something new."
        description="No reservations match these filters. Create one or adjust your search."
      />
    );
  return (
    <div className="reservation-list">
      {reservations.map((reservation) => (
        <article className="reservation-card" key={reservation.id}>
          <div className="reservation-date">
            <strong>{formatDate(reservation.startUtc)}</strong>
            <span>
              {formatTime(reservation.startUtc)} –{' '}
              {formatTime(reservation.actualEndUtc ?? reservation.endUtc)}
            </span>
            {formatDate(reservation.startUtc) !==
            formatDate(reservation.endUtc) ? (
              <small>Ends {formatDate(reservation.endUtc)}</small>
            ) : null}
          </div>
          <div className="reservation-details">
            <div className="reservation-title">
              <h3>{reservation.title}</h3>
              <span className={`pill ${reservation.status.toLowerCase()}`}>
                {reservation.status}
              </span>
            </div>
            <p>
              {reservation.roomName} <span className="dot">·</span>{' '}
              {reservation.organizerName} <span className="dot">·</span>{' '}
              {reservation.attendees} people
            </p>
            <small>
              {reservation.checkedInAtUtc
                ? `Checked in at ${formatTime(reservation.checkedInAtUtc)}`
                : 'Usage not confirmed by check-in'}
            </small>
          </div>
          <div className="reservation-actions">
            {reservation.allowedActions.map((action) => (
              <button
                key={action}
                className={`text-button ${action === 'cancel' ? 'danger' : ''}`}
                disabled={pending}
                onClick={() => onAction(reservation, action)}
              >
                {actionLabels[action]}
              </button>
            ))}
          </div>
        </article>
      ))}
    </div>
  );
}
