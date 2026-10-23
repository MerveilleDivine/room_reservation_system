import { equipmentLabels } from '../api/contracts';
import type { Room } from '../api/contracts';
import { EmptyState } from './Feedback';
import { Icon } from './Icon';

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
        title="No matching rooms"
        description="Try a different floor, capacity or equipment filter."
      />
    );
  return (
    <div className="room-grid">
      {rooms.map((room) => (
        <article className="room-card" key={room.id}>
          <div className="room-card-body">
            <div className="room-card-title">
              <div>
                <p className="room-location">Floor {room.floor}</p>
                <h3>{room.name}</h3>
              </div>
              <span className={`pill ${room.isActive ? 'active' : 'inactive'}`}>
                {room.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="muted">
              <Icon name="users" size={16} /> Up to {room.capacity} people
            </p>
            <div className="equipment-tags">
              {room.equipment.map((item) => (
                <span key={item}>{equipmentLabels[item]}</span>
              ))}
            </div>
            <small className="room-id">ID: {room.id}</small>
            <button
              className="button room-book"
              onClick={() => onBook(room.id)}
              disabled={!room.isActive || !bookingEnabled}
            >
              {room.isActive ? 'Book this room' : 'Not accepting bookings'}
              {room.isActive ? <Icon name="arrow" size={16} /> : null}
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}
