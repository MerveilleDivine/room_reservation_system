import { equipmentLabels } from '../api/contracts';
import type { Room } from '../api/contracts';
import { EmptyState } from './Feedback';

export function RoomList({
  rooms,
  onBook,
  bookingEnabled = true,
}: {
  rooms: Room[];
  onBook: (id: string) => void;
  bookingEnabled?: boolean;
}) {
  if (rooms.length === 0)
    return (
      <EmptyState
        title="No rooms match just yet."
        description="Try a different floor, capacity or equipment filter."
      />
    );
  return (
    <div className="room-grid">
      {rooms.map((room, index) => (
        <article className={`room-card room-tone-${index % 3}`} key={room.id}>
          <div className="room-visual" aria-hidden="true">
            <div className="room-plan">
              <span />
              <span />
              <span />
              <i />
              <b />
            </div>
            <span className="room-number">{room.name.slice(0, 1)}</span>
          </div>
          <div className="room-card-body">
            <div className="room-card-title">
              <h3>{room.name}</h3>
              <span className={`pill ${room.isActive ? 'active' : 'inactive'}`}>
                {room.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="muted">
              Up to {room.capacity} people <span className="dot">·</span> Floor{' '}
              {room.floor}
            </p>
            <div className="equipment-tags">
              {room.equipment.map((item) => (
                <span key={item}>{equipmentLabels[item]}</span>
              ))}
            </div>
            <button
              className="button room-book"
              onClick={() => onBook(room.id)}
              disabled={!room.isActive || !bookingEnabled}
            >
              {room.isActive ? 'Book this room' : 'Not accepting bookings'}
              <span aria-hidden="true">↗</span>
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
