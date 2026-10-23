import { useState } from 'react';
import { equipmentLabels } from '../api/contracts';
import type { Equipment, Room } from '../api/contracts';
import { ErrorNotice } from '../components/Feedback';
import { RoomList } from '../components/RoomList';
import { useApi } from '../hooks/useApi';
import type { ApiResource } from '../hooks/useApi';

export function RoomsPage({
  allRooms,
  revision,
  canBook,
  onBook,
}: {
  allRooms: ApiResource<Room[]>;
  revision: number;
  canBook: boolean;
  onBook: (roomId: string) => void;
}) {
  const [capacity, setCapacity] = useState('');
  const [floor, setFloor] = useState('');
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const query = new URLSearchParams();
  if (capacity) query.set('minimumCapacity', capacity);
  if (floor) query.set('floor', floor);
  if (equipment.length) query.set('equipment', equipment.join(','));
  const filtered = useApi<Room[]>(
    query.size ? '/rooms?' + query : null,
    revision,
  );
  const rooms = query.size ? filtered : allRooms;
  const floors = [
    ...new Set((allRooms.data ?? []).map((room) => room.floor)),
  ].sort();

  return (
    <section aria-labelledby="rooms-heading">
      <div className="section-heading">
        <h2 id="rooms-heading">All rooms</h2>
      </div>
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
      {rooms.error ? (
        <ErrorNotice error={rooms.error} />
      ) : rooms.loading ? (
        <p className="loading" role="status">
          Loading rooms…
        </p>
      ) : rooms.data ? (
        <RoomList rooms={rooms.data} bookingEnabled={canBook} onBook={onBook} />
      ) : null}
      <p className="footnote">
        Active rooms accept reservations. Availability is checked against your
        meeting’s time when you book.
      </p>
    </section>
  );
}
