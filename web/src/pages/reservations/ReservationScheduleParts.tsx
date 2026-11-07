import type { Ref } from 'react';
import { Icon } from '../../components/Icon';
import type { SavedBooking } from '../../features/reservations/types';

export function BookingConfirmation({
  saved,
  headingRef,
  onDismiss,
}: {
  saved: SavedBooking;
  headingRef: Ref<HTMLHeadingElement>;
  onDismiss: () => void;
}) {
  return (
    <section
      className="booking-confirmation"
      aria-labelledby="booking-confirmed"
    >
      <div className="confirmation-heading">
        <h2 id="booking-confirmed" ref={headingRef} tabIndex={-1}>
          <Icon name="check" /> {saved.label}
        </h2>
        <button
          className="icon-button"
          aria-label="Dismiss booking confirmation"
          onClick={onDismiss}
        >
          <Icon name="close" size={16} />
        </button>
      </div>
      <p>{saved.reservation.title} is in your schedule below.</p>
    </section>
  );
}

export function ReservationPagination({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <nav className="pagination" aria-label="Reservation pages">
      <span>
        Page {page} of {totalPages}
      </span>
      <div>
        <button
          className="button secondary"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          Previous
        </button>
        <button
          className="button secondary"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          Next
        </button>
      </div>
    </nav>
  );
}

export function EmptySchedule({
  filtered,
  history,
  canBook,
  onClear,
  onBook,
}: {
  filtered: boolean;
  history: boolean;
  canBook: boolean;
  onClear: () => void;
  onBook: () => void;
}) {
  return (
    <div className="schedule-empty">
      <span className="empty-icon">
        <Icon name="calendar" size={24} />
      </span>
      <h3>
        {filtered
          ? 'No meetings match those filters.'
          : history
            ? 'No past reservations yet.'
            : 'A little room in your schedule.'}
      </h3>
      <p>
        {filtered
          ? 'Try a different date or room.'
          : history
            ? 'Completed and cancelled meetings will be here.'
            : 'Book a space when you need one.'}
      </p>
      {filtered ? (
        <button className="button secondary" onClick={onClear}>
          Clear filters
        </button>
      ) : !history ? (
        <button className="button primary" onClick={onBook} disabled={!canBook}>
          <Icon name="plus" size={16} /> Book a room
        </button>
      ) : null}
    </div>
  );
}
