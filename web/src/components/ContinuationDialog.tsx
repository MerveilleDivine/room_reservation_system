import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import type { Reservation } from '../api/contracts';
import { useSubmissionKey } from '../hooks/useSubmissionKey';
import { formatDate, formatTime } from '../lib/dates';
import { Icon } from './Icon';

interface Props {
  reservation: Reservation;
  onSave: (
    id: string,
    additionalMinutes: number,
    submissionKey: string,
  ) => Promise<void>;
  onClose: () => void;
}

export function ContinuationDialog({ reservation, onSave, onClose }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const durationInput = useRef<HTMLSelectElement>(null);
  const [additionalMinutes, setAdditionalMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const submissionKey = useSubmissionKey();
  const unconfirmed = error instanceof ApiError && error.outcomeUnknown;

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    durationInput.current?.focus();
    return () => element?.close();
  }, []);

  function dismiss() {
    dialog.current?.close();
    onClose();
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onSave(
        reservation.id,
        additionalMinutes,
        submissionKey({ id: reservation.id, additionalMinutes }),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error('Could not reserve extra time.'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="booking-dialog"
      aria-labelledby="continuation-heading"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) dismiss();
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">Keep the conversation going</p>
          <h2 id="continuation-heading">Reserve more time</h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close extra time form"
          disabled={saving}
          onClick={dismiss}
        >
          <Icon name="close" />
        </button>
      </div>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <div className="continuation-context">
          <h3>{reservation.title}</h3>
          <p>
            {reservation.roomName} · {reservation.organizerName} ·{' '}
            {reservation.attendees} people
          </p>
          <p>
            Extra time starts {formatDate(reservation.endUtc)} at{' '}
            {formatTime(reservation.endUtc)}.
          </p>
        </div>
        <label>
          Additional time
          <select
            ref={durationInput}
            value={additionalMinutes}
            disabled={saving || unconfirmed}
            onChange={(event) =>
              setAdditionalMinutes(Number(event.target.value))
            }
          >
            <option value={15}>15 minutes</option>
            <option value={30}>30 minutes</option>
            <option value={60}>1 hour</option>
          </select>
        </label>
        <p className="form-note">
          We’ll create a linked booking with the same room, organizer and
          attendees, if everyone’s schedule allows it. Reserve it before this
          meeting’s scheduled end. Existing bookings take priority.
        </p>
        <p className="form-note">
          The extra booking has its own check-in and cancellation. Ending this
          meeting early keeps the extra booking reserved.
        </p>
        {error ? (
          <div className="notice error" role="alert">
            {error.message}
            {error instanceof ApiError ? <code>{error.code}</code> : null}
          </div>
        ) : null}
        <div className="dialog-actions">
          <button
            type="button"
            className="button secondary"
            onClick={dismiss}
            disabled={saving}
          >
            Go back
          </button>
          <button className="button primary" disabled={saving}>
            {saving
              ? 'Reserving…'
              : unconfirmed
                ? 'Retry reservation'
                : 'Reserve extra time'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
