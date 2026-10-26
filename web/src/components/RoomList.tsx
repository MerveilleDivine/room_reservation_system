import { equipmentLabels } from '../api/contracts';
import type { Room, RoomAvailability } from '../api/contracts';
import { EmptyState } from './Feedback';
import { Icon } from './Icon';

export function RoomList({
  rooms,
  onBook,
  bookingEnabled = true,
  availability,
}: {
  rooms: Room[];
  onBook: (id: string) => void;
  bookingEnabled?: boolean;
  availability: RoomAvailability[];
}) {
  if (!rooms.length)
    return (
      <EmptyState
        title="No matching rooms"
        description="Try a different floor, capacity or equipment filter."
      />
    );
  const slots = new Map(availability.map((item) => [item.roomId, item]));
  return (
    <div className="room-grid">
      {rooms.map((room) => {
        const slot = slots.get(room.id);
        const available = room.isActive && slot?.isAvailable === true;
        return (
          <article className="room-card" key={room.id}>
            <div className="room-card-top">
              <div>
                <p className="room-location">Floor {room.floor}</p>
                <h3>{room.name}</h3>
              </div>
              <span className={`pill ${available ? 'active' : 'inactive'}`}>
                <span className="status-dot" aria-hidden="true" />
                {!room.isActive
                  ? 'Inactive'
                  : available
                    ? 'Available'
                    : slot
                      ? 'Unavailable'
                      : 'Not checked'}
              </span>
            </div>
            <p className="room-capacity">
              <Icon name="users" size={16} /> Up to {room.capacity} people
            </p>
            <div className="equipment-tags">
              {room.equipment.map((item) => (
                <span key={item}>{equipmentLabels[item]}</span>
              ))}
            </div>
            {!available && room.isActive && slot?.reason ? (
              <p className="room-conflict">{slot.reason}</p>
            ) : null}
            <div className="room-card-bottom">
              <details className="identifier-details">
                <summary aria-label={`Room details for ${room.name}`}>
                  Details
                </summary>
                <small className="room-id">ID: {room.id}</small>
              </details>
              <button
                className="button room-book"
                onClick={() => onBook(room.id)}
                disabled={!available || !bookingEnabled}
              >
                {!room.isActive
                  ? 'Not accepting bookings'
                  : available
                    ? 'Book this room'
                    : slot
                      ? 'Unavailable'
                      : 'Check time'}
                {available ? <Icon name="arrow" size={16} /> : null}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
