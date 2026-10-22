import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import type {
  BookingRequest,
  Person,
  Reservation,
  Room,
} from '../api/contracts';
import { toLocalInput, toUtc } from '../lib/dates';

interface Props {
  rooms: Room[];
  people: Person[];
  initial: Reservation | null;
  preferredRoomId?: string;
  onSave: (request: BookingRequest, id?: string) => Promise<void>;
  onClose: () => void;
}

export function BookingDialog({
  rooms,
  people,
  initial,
  preferredRoomId,
  onSave,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const [defaultStart] = useState(() => {
    const start = new Date(Date.now() + 60 * 60 * 1000);
    start.setMinutes(0, 0, 0);
    return start;
  });

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    return () => element?.close();
  }, []);

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setSaving(true);
    setError(null);
    try {
      await onSave(
        {
          title: String(form.get('title')),
          roomId: String(form.get('roomId')),
          organizerId: String(form.get('organizerId')),
          startUtc: toUtc(String(form.get('start'))),
          endUtc: toUtc(String(form.get('end'))),
          attendees: Number(form.get('attendees')),
        },
        initial?.id,
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error('Could not save this reservation.'),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <dialog
      ref={dialog}
      className="booking-dialog"
      aria-labelledby="booking-heading"
      onCancel={(event) => {
        event.preventDefault();
        if (!saving) onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">MAKE SPACE</p>
          <h2 id="booking-heading">
            {initial ? 'Edit reservation' : 'A room for your next idea.'}
          </h2>
        </div>
        <button
          className="icon-button"
          aria-label="Close reservation form"
          onClick={onClose}
          disabled={saving}
        >
          ×
        </button>
      </div>
      <form
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <label>
          Meeting title
          <input
            name="title"
            autoFocus
            required
            maxLength={120}
            defaultValue={initial?.title ?? ''}
            placeholder="e.g. Product planning"
          />
        </label>
        <div className="form-grid">
          <label>
            Room
            <select
              name="roomId"
              required
              defaultValue={initial?.roomId ?? preferredRoomId ?? ''}
            >
              <option value="" disabled>
                Choose a room
              </option>
              {rooms.map((room) => (
                <option key={room.id} value={room.id} disabled={!room.isActive}>
                  {room.name} · {room.capacity} people
                  {!room.isActive ? ' · Inactive' : ''}
                </option>
              ))}
            </select>
          </label>
          <label>
            Organizer
            <select
              name="organizerId"
              required
              defaultValue={initial?.organizerId ?? ''}
            >
              <option value="" disabled>
                Choose an organizer
              </option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </label>
          <label>
            Starts
            <input
              name="start"
              type="datetime-local"
              step="60"
              required
              defaultValue={toLocalInput(
                initial ? new Date(initial.startUtc) : defaultStart,
              )}
            />
          </label>
          <label>
            Ends
            <input
              name="end"
              type="datetime-local"
              step="60"
              required
              defaultValue={toLocalInput(
                initial
                  ? new Date(initial.endUtc)
                  : new Date(defaultStart.getTime() + 60 * 60 * 1000),
              )}
            />
          </label>
        </div>
        <label>
          Number of attendees
          <input
            className="short-input"
            name="attendees"
            type="number"
            min="1"
            step="1"
            required
            defaultValue={initial?.attendees ?? 1}
          />
        </label>
        <p className="form-note">
          Times use your device’s timezone. The server checks room capacity,
          conflicts and booking limits before saving.
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
            onClick={onClose}
            disabled={saving}
          >
            Go back
          </button>
          <button className="button primary" disabled={saving}>
            {saving
              ? 'Saving…'
              : initial
                ? 'Save changes'
                : 'Create reservation'}
          </button>
        </div>
      </form>
    </dialog>
  );
}
