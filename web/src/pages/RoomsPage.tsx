import { useState } from 'react';
import { equipmentLabels } from '../api/contracts';
import type { Equipment, Room, RoomAvailability } from '../api/contracts';
import { ErrorNotice } from '../components/Feedback';
import { RoomList } from '../components/RoomList';
import { Icon } from '../components/Icon';
import { useApi } from '../hooks/useApi';
import type { ApiResource } from '../hooks/useApi';
import { formatDate, formatTime, toLocalInput, toUtc } from '../lib/dates';

function nextSlot() {
  const start = new Date(Date.now() + 15 * 60 * 1000);
  start.setMinutes(Math.ceil(start.getMinutes() / 15) * 15, 0, 0);
  return {
    start: toLocalInput(start),
    end: toLocalInput(new Date(start.getTime() + 30 * 60 * 1000)),
  };
}

export function RoomsPage({
  allRooms,
  revision,
  canBook,
  profile,
  onBook,
}: {
  allRooms: ApiResource<Room[]>;
  revision: number;
  canBook: boolean;
  profile: string;
  onBook: (roomId: string, startUtc: string, endUtc: string) => void;
}) {
  const [capacity, setCapacity] = useState('');
  const [floor, setFloor] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [draft, setDraft] = useState(nextSlot);
  const [slot, setSlot] = useState(draft);
  const [searchRevision, setSearchRevision] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const query = new URLSearchParams();
  if (capacity) query.set('minimumCapacity', capacity);
  if (floor) query.set('floor', floor);
  if (equipment.length) query.set('equipment', equipment.join(','));
  const filtered = useApi<Room[]>(
    query.size ? '/rooms?' + query : null,
    revision,
  );
  const rooms = query.size ? filtered : allRooms;
  const availabilityQuery = new URLSearchParams({
    startUtc: toUtc(slot.start),
    endUtc: toUtc(slot.end),
  });
  if (profile !== 'admin') availabilityQuery.set('organizerId', profile);
  const availability = useApi<RoomAvailability[]>(
    '/room-availability?' + availabilityQuery,
    revision + searchRevision,
  );
  const dirty = draft.start !== slot.start || draft.end !== slot.end;
  const floors = [
    ...new Set((allRooms.data ?? []).map((room) => room.floor)),
  ].sort();
  const ready =
    canBook &&
    !availability.loading &&
    !availability.error &&
    availability.data !== null &&
    !dirty;

  return (
    <section aria-labelledby="rooms-heading">
      <form
        className="room-search"
        onSubmit={(event) => {
          event.preventDefault();
          setSlot({ ...draft });
          setSearchRevision((value) => value + 1);
        }}
      >
        <label>
          Starts
          <input
            aria-label="Find rooms from"
            type="datetime-local"
            required
            value={draft.start}
            onChange={(event) =>
              setDraft((current) => ({ ...current, start: event.target.value }))
            }
          />
        </label>
        <label>
          Ends
          <input
            aria-label="Find rooms until"
            type="datetime-local"
            required
            value={draft.end}
            onChange={(event) =>
              setDraft((current) => ({ ...current, end: event.target.value }))
            }
          />
        </label>
        <button className="button primary" type="submit">
          Find a room <Icon name="arrow" size={16} />
        </button>
        <button
          className="button secondary filter-toggle"
          type="button"
          aria-expanded={filtersOpen}
          aria-controls="room-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          <Icon name="filter" size={16} /> Filters
          {query.size ? ` (${query.size})` : ''}
        </button>
      </form>
      {filtersOpen ? (
        <div className="filter-panel" id="room-filters">
          <div className="filters room-filters">
            <label>
              People
              <select
                value={capacity}
                onChange={(event) => setCapacity(event.target.value)}
              >
                <option value="">Any capacity</option>
                {[2, 4, 6, 8, 12].map((count) => (
                  <option key={count} value={count}>
                    {count}+ people
                  </option>
                ))}
              </select>
            </label>
            <label>
              Floor
              <select
                value={floor}
                onChange={(event) => setFloor(event.target.value)}
              >
                <option value="">All floors</option>
                {floors.map((value) => (
                  <option key={value} value={value}>
                    Floor {value}
                  </option>
                ))}
              </select>
            </label>
            <fieldset>
              <legend>Equipment</legend>
              <div className="equipment-options">
                {(Object.entries(equipmentLabels) as [Equipment, string][]).map(
                  ([value, label]) => (
                    <label className="check-chip" key={value}>
                      <input
                        type="checkbox"
                        checked={equipment.includes(value)}
                        onChange={(event) =>
                          setEquipment((current) =>
                            event.target.checked
                              ? [...current, value]
                              : current.filter((item) => item !== value),
                          )
                        }
                      />
                      <span>{label}</span>
                    </label>
                  ),
                )}
              </div>
            </fieldset>
          </div>
          {query.size ? (
            <button
              className="text-button"
              onClick={() => {
                setCapacity('');
                setFloor('');
                setEquipment([]);
              }}
            >
              Clear filters
            </button>
          ) : null}
        </div>
      ) : null}
      <div className="schedule-heading">
        <h2 id="rooms-heading">
          {dirty ? 'Update your search' : 'Spaces for your meeting'}
        </h2>
        <span>
          {dirty
            ? 'Choose Find a room to check the new time.'
            : `${formatDate(toUtc(slot.start))} · ${formatTime(toUtc(slot.start))}–${formatTime(toUtc(slot.end))}`}
        </span>
      </div>
      {availability.error ? <ErrorNotice error={availability.error} /> : null}
      {rooms.error ? (
        <ErrorNotice error={rooms.error} />
      ) : rooms.loading || availability.loading ? (
        <div className="schedule-loading" role="status">
          Finding your space…
        </div>
      ) : rooms.data ? (
        <RoomList
          rooms={rooms.data}
          availability={dirty ? [] : (availability.data ?? [])}
          bookingEnabled={ready}
          onBook={(roomId) =>
            onBook(roomId, toUtc(slot.start), toUtc(slot.end))
          }
        />
      ) : null}
    </section>
  );
}
