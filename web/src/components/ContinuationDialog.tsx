import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import type { ExtraTimeAvailability, Reservation } from '../api/contracts';
import { useApi } from '../hooks/useApi';
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
  const durationInput = useRef<HTMLInputElement>(null);
  const [additionalMinutes, setAdditionalMinutes] = useState(15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const submissionKey = useSubmissionKey();
  const unconfirmed = error instanceof ApiError && error.outcomeUnknown;
  const [revision, setRevision] = useState(0);
  const availability = useApi<ExtraTimeAvailability>(
    `/reservations/${reservation.id}/extra-time`,
    revision,
  );
  const maximum = availability.data?.maximumMinutes ?? 0;
  const canReserve =
    maximum > 0 && !availability.error && additionalMinutes <= maximum;

  useEffect(() => {
    if (maximum > 0 && !unconfirmed)
      setAdditionalMinutes((value) => Math.min(value, maximum));
  }, [maximum, unconfirmed]);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    durationInput.current?.focus();
    return () => element?.close();
  }, []);

  useEffect(() => {
    if (!availability.loading && maximum > 0) durationInput.current?.focus();
  }, [availability.loading, maximum]);

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
      if (!(failure instanceof ApiError && failure.outcomeUnknown))
        setRevision((value) => value + 1);
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
          <input
            type="number"
            min={1}
            max={maximum || 1}
            step={1}
            required
            ref={durationInput}
            value={additionalMinutes}
            disabled={saving || unconfirmed || !maximum}
            onChange={(event) =>
              setAdditionalMinutes(Number(event.target.value))
            }
          />
        </label>
        {availability.loading ? (
          <p role="status">Checking available time…</p>
        ) : availability.error ? (
          <div className="notice error" role="alert">
            {availability.error.message}{' '}
            <button
              type="button"
              onClick={() => setRevision((value) => value + 1)}
            >
              Check again
            </button>
          </div>
        ) : availability.data ? (
          <div className="continuation-context">
            <p>
              {maximum > 0
                ? `Up to ${maximum} additional minutes available.`
                : (availability.data.message ?? 'No extra time is available.')}
            </p>
            {availability.data.blockedFromUtc &&
            availability.data.blockedUntilUtc ? (
              <p>
                {availability.data.reasonCode === 'ORGANIZER_OVERLAP'
                  ? 'Your next meeting'
                  : 'The next room booking'}
                : {formatDate(availability.data.blockedFromUtc)} at{' '}
                {formatTime(availability.data.blockedFromUtc)}–
                {formatDate(availability.data.blockedFromUtc) !==
                formatDate(availability.data.blockedUntilUtc)
                  ? `${formatDate(availability.data.blockedUntilUtc)} at `
                  : ''}
                {formatTime(availability.data.blockedUntilUtc)}.
              </p>
            ) : null}
          </div>
        ) : null}
        <p className="form-note">
          Extra time is reserved separately. Cancel it if you no longer need it.
        </p>
        {error ? (
          <div className="notice error" role="alert">
            {error.message}
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
          <button
            className="button primary"
            disabled={saving || (!unconfirmed && !canReserve)}
          >
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
