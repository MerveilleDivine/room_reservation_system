import type { Person, Room } from '../../api/contracts';
import type { ReservationFilters as Filters } from './useReservationFilters';

interface Props {
  filters: Filters;
  rooms: Room[];
  people: Person[];
  workspace: boolean;
  activeCount: number;
  onChange: (patch: Partial<Filters>) => void;
  onClear: () => void;
}

export function ReservationFilters({
  filters,
  rooms,
  people,
  workspace,
  activeCount,
  onChange,
  onClear,
}: Props) {
  return (
    <div className="filter-panel" id="reservation-filters">
      <div className="filters reservation-filters">
        <label>
          Room
          <select
            value={filters.roomId}
            onChange={(event) => onChange({ roomId: event.target.value })}
          >
            <option value="">All rooms</option>
            {rooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        {workspace ? (
          <label>
            Organizer
            <select
              value={filters.organizerId}
              onChange={(event) =>
                onChange({ organizerId: event.target.value })
              }
            >
              <option value="">All organizers</option>
              {people.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.firstName} {person.lastName}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {filters.view === 'history' ? (
          <label>
            Status
            <select
              value={filters.status}
              onChange={(event) => onChange({ status: event.target.value })}
            >
              <option value="">All history</option>
              <option>Completed</option>
              <option>Cancelled</option>
            </select>
          </label>
        ) : null}
        <label>
          From
          <input
            aria-label="Reservations from"
            type="datetime-local"
            value={filters.from}
            onChange={(event) => onChange({ from: event.target.value })}
          />
        </label>
        <label>
          Until
          <input
            aria-label="Reservations until"
            type="datetime-local"
            value={filters.to}
            onChange={(event) => onChange({ to: event.target.value })}
          />
        </label>
      </div>
      {activeCount ? (
        <button className="text-button" onClick={onClear}>
          Clear filters
        </button>
      ) : null}
    </div>
  );
}
