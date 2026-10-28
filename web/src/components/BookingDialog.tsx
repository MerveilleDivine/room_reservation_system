import { useEffect, useRef, useState } from 'react';
import { ApiError } from '../api/client';
import type {
  BookingRequest,
  Equipment,
  Person,
  Reservation,
  Room,
} from '../api/contracts';
import { toLocalInput, toUtc } from '../lib/dates';
import { useSubmissionKey } from '../hooks/useSubmissionKey';
import { Icon } from './Icon';
import { RoomSuggestion } from './RoomSuggestion';

interface Props {
  organizerId?: string;
  rooms: Room[];
  people: Person[];
  initial: Reservation | null;
  preferredRoomId?: string;
  preferredStartUtc?: string;
  preferredEndUtc?: string;
  requiredEquipment?: Equipment[];
  onSave: (
    request: BookingRequest,
    id: string | undefined,
    submissionKey: string,
  ) => Promise<void>;
  onClose: () => void;
}

export function BookingDialog({
  organizerId,
  rooms,
  people,
  initial,
  preferredRoomId,
  preferredStartUtc,
  preferredEndUtc,
  requiredEquipment = [],
  onSave,
  onClose,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleInput = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const pendingRequest = useRef<BookingRequest | null>(null);
  const submissionKey = useSubmissionKey();
  const unconfirmed = error instanceof ApiError && error.outcomeUnknown;
  const [selection, setSelection] = useState(() => {
    const start = preferredStartUtc
      ? new Date(preferredStartUtc)
      : new Date(Date.now() + 30 * 60 * 1000);
    if (!preferredStartUtc)
      start.setMinutes(Math.floor(start.getMinutes() / 15) * 15, 0, 0);
    return {
      roomId:
        initial?.roomId ??
        preferredRoomId ??
        rooms.find((room) => room.isActive)?.id ??
        '',
      organizerId: organizerId ?? initial?.organizerId ?? '',
      start: toLocalInput(initial ? new Date(initial.startUtc) : start),
      end: toLocalInput(
        initial
          ? new Date(initial.endUtc)
          : preferredEndUtc
            ? new Date(preferredEndUtc)
            : new Date(start.getTime() + 30 * 60 * 1000),
      ),
      attendees: String(initial?.attendees ?? 1),
    };
  });
  const attendees = Number(selection.attendees);
  const startTime = new Date(selection.start).getTime();
  const endTime = new Date(selection.end).getTime();
  const selectedRoom = rooms.find((room) => room.id === selection.roomId);
  const canSuggest =
    !saving &&
    !unconfirmed &&
    selection.organizerId &&
    Number.isInteger(attendees) &&
    attendees > 0 &&
    startTime > Date.now() &&
    endTime > startTime &&
    rooms.some(
      (room) =>
        room.isActive &&
        room.capacity >= attendees &&
        room.capacity < (selectedRoom?.capacity ?? 0),
    );
  const suggestionQuery = canSuggest
    ? new URLSearchParams({
        roomId: selection.roomId,
        organizerId: selection.organizerId,
        attendees: String(attendees),
        startUtc: toUtc(selection.start),
        endUtc: toUtc(selection.end),
      })
    : null;
  if (suggestionQuery && requiredEquipment.length)
    suggestionQuery.set('equipment', requiredEquipment.join(','));
  if (suggestionQuery && initial)
    suggestionQuery.set('excludeReservationId', initial.id);

  useEffect(() => {
    const element = dialog.current;
    element?.showModal();
    titleInput.current?.focus();
    return () => element?.close();
  }, []);

  function dismiss() {
    dialog.current?.close();
    onClose();
  }

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const request: BookingRequest =
      unconfirmed && pendingRequest.current
        ? pendingRequest.current
        : {
            title: String(form.get('title')),
            roomId: String(form.get('roomId')),
            organizerId: String(form.get('organizerId')),
            startUtc: toUtc(String(form.get('start'))),
            endUtc: toUtc(String(form.get('end'))),
            attendees: Number(form.get('attendees')),
          };
    pendingRequest.current = request;
    setSaving(true);
    setError(null);
    try {
      await onSave(
        request,
        initial?.id,
        submissionKey({ request, id: initial?.id }),
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
        if (!saving) dismiss();
      }}
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
          onClick={dismiss}
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
        <fieldset disabled={saving || unconfirmed} className="booking-fields">
          <label>
            Meeting title
            <input
              ref={titleInput}
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
                value={selection.roomId}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    roomId: event.target.value,
                  }))
                }
              >
                <option value="" disabled>
                  Choose a room
                </option>
                {rooms.map((room) => (
                  <option
                    key={room.id}
                    value={room.id}
                    disabled={!room.isActive}
                  >
                    {room.name} · {room.capacity} people
                    {!room.isActive ? ' · Inactive' : ''}
                  </option>
                ))}
              </select>
            </label>
            {organizerId ? (
              <input type="hidden" name="organizerId" value={organizerId} />
            ) : null}
            <label>
              Organizer
              {organizerId ? (
                <>
                  <input
                    readOnly
                    value={people
                      .filter((person) => person.id === organizerId)
                      .map((person) => `${person.firstName} ${person.lastName}`)
                      .join('')}
                  />
                </>
              ) : (
                <select
                  name="organizerId"
                  required
                  value={selection.organizerId}
                  onChange={(event) =>
                    setSelection((current) => ({
                      ...current,
                      organizerId: event.target.value,
                    }))
                  }
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
              )}
            </label>
            <label>
              Starts
              <input
                name="start"
                type="datetime-local"
                onChange={(event) => {
                  const value = event.target.value;
                  const start = new Date(value);
                  setSelection((current) => ({
                    ...current,
                    start: value,
                    end:
                      !Number.isNaN(start.getTime()) &&
                      (!current.end || new Date(current.end) <= start)
                        ? toLocalInput(
                            new Date(start.getTime() + 60 * 60 * 1000),
                          )
                        : current.end,
                  }));
                }}
                step="60"
                required
                value={selection.start}
              />
            </label>
            <label>
              Ends
              <input
                name="end"
                type="datetime-local"
                step="60"
                required
                value={selection.end}
                onChange={(event) =>
                  setSelection((current) => ({
                    ...current,
                    end: event.target.value,
                  }))
                }
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
              value={selection.attendees}
              onChange={(event) =>
                setSelection((current) => ({
                  ...current,
                  attendees: event.target.value,
                }))
              }
            />
          </label>
          <RoomSuggestion
            path={
              suggestionQuery ? '/room-suggestions?' + suggestionQuery : null
            }
            onChoose={(roomId) =>
              setSelection((current) => ({ ...current, roomId }))
            }
          />
        </fieldset>
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
    </dialog>
  );
}
