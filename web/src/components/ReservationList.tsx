import type { Reservation, ReservationAction } from '../api/contracts';
import { formatDate, formatTime } from '../lib/dates';
import { EmptyState } from './Feedback';
import { canManage } from '../lib/profile';

const actionLabels: Record<ReservationAction, string> = {
  edit: 'Edit',
  cancel: 'Cancel',
  'check-in': 'Check in',
  'reserve-more': 'Reserve more time',
  end: 'End early',
};

export function ReservationList({
  profile,
  reservations,
  pending,
  onAction,
}: {
  profile: string;
  reservations: Reservation[];
  pending: boolean;
  onAction: (reservation: Reservation, action: ReservationAction) => void;
}) {
  if (reservations.length === 0)
    return (
      <EmptyState
        title="No matching reservations"
        description="Create a reservation or adjust the filters."
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
            formatDate(reservation.actualEndUtc ?? reservation.endUtc) ? (
              <small>
                Ends{' '}
                {formatDate(reservation.actualEndUtc ?? reservation.endUtc)}
              </small>
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
              {reservation.attendees}{' '}
              {reservation.attendees === 1 ? 'person' : 'people'}
            </p>
            {reservation.checkedInAtUtc ? (
              <small>
                Checked in at {formatTime(reservation.checkedInAtUtc)}
              </small>
            ) : null}
            {reservation.continuationOfId ? (
              <small>Additional time</small>
            ) : null}
            {reservation.completionNote ? (
              <small>{reservation.completionNote}</small>
            ) : null}
          </div>
          <div className="reservation-actions">
            {(canManage(profile, reservation.organizerId)
              ? reservation.allowedActions
              : []
            ).map((action) => (
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
