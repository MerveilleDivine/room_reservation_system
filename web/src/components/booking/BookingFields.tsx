import type { Dispatch, RefObject, SetStateAction } from 'react';
import type { Person, Reservation, Room } from '../../api/contracts';
import { roomsApi } from '../../features/rooms/api';
import { toLocalInput } from '../../lib/dates';
import { RoomSuggestion } from '../RoomSuggestion';
import type { BookingSelection } from './bookingForm';

export function BookingFields({
  titleInput,
  organizerId,
  rooms,
  people,
  initial,
  saving,
  unconfirmed,
  selection,
  setSelection,
  suggestionQuery,
}: {
  titleInput: RefObject<HTMLInputElement | null>;
  organizerId?: string;
  rooms: Room[];
  people: Person[];
  initial: Reservation | null;
  saving: boolean;
  unconfirmed: boolean;
  selection: BookingSelection;
  setSelection: Dispatch<SetStateAction<BookingSelection>>;
  suggestionQuery: URLSearchParams | null;
}) {
  return (
    <fieldset disabled={saving || unconfirmed} className="booking-fields">
      <label>
        Meeting title
        <input
          ref={titleInput}
          name="title"
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
              <option key={room.id} value={room.id} disabled={!room.isActive}>
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
                    ? toLocalInput(new Date(start.getTime() + 60 * 60 * 1000))
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
          suggestionQuery ? roomsApi.suggestionsPath(suggestionQuery) : null
        }
        onChoose={(roomId) =>
          setSelection((current) => ({ ...current, roomId }))
        }
      />
    </fieldset>
  );
}
