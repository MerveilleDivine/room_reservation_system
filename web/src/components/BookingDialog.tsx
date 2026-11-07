import { useRef } from 'react';
import { Icon } from './Icon';
import { ModalDialog } from './ModalDialog';
import { BookingFields } from './booking/BookingFields';
import { useBookingForm } from './booking/useBookingForm';
import type { BookingDialogProps } from './booking/types';

export function BookingDialog(props: BookingDialogProps) {
  const titleInput = useRef<HTMLInputElement>(null);
  const { initial, organizerId, rooms, people, onClose } = props;
  const {
    selection,
    setSelection,
    suggestionQuery,
    error,
    saving,
    unconfirmed,
    submit,
  } = useBookingForm(props);
  return (
    <ModalDialog
      labelledBy="booking-heading"
      pending={saving}
      initialFocus={titleInput}
      onClose={onClose}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">Reservation</p>
          <h2 id="booking-heading">
            {initial ? 'Edit reservation' : 'New reservation'}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close reservation form"
          onClick={onClose}
          disabled={saving}
        >
          <Icon name="close" />
        </button>
      </div>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <BookingFields
          titleInput={titleInput}
          organizerId={organizerId}
          rooms={rooms}
          people={people}
          initial={initial}
          saving={saving}
          unconfirmed={unconfirmed}
          selection={selection}
          setSelection={setSelection}
          suggestionQuery={suggestionQuery}
        />
        {error ? (
          <div className="notice error" role="alert">
            {error.message}
          </div>
        ) : null}
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={onClose}
            disabled={saving}
          >
            Go back
          </button>
          <button className="button primary" disabled={saving}>
            {saving
              ? 'Saving…'
              : unconfirmed
                ? 'Retry reservation'
                : initial
                  ? 'Save changes'
                  : 'Create reservation'}
          </button>
        </div>
      </form>
    </ModalDialog>
  );
}
