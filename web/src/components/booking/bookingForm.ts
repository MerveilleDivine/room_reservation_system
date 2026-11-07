import type { Equipment, Room } from '../../api/contracts';
import { toLocalInput, toUtc } from '../../lib/dates';
import type { BookingDialogProps } from './types';

const minuteMilliseconds = 60_000;
const defaultDurationMinutes = 30;
const startStepMinutes = 15;

export function createBookingSelection(
  {
    organizerId,
    rooms,
    initial,
    preferredRoomId,
    preferredStartUtc,
    preferredEndUtc,
  }: Pick<
    BookingDialogProps,
    | 'organizerId'
    | 'rooms'
    | 'initial'
    | 'preferredRoomId'
    | 'preferredStartUtc'
    | 'preferredEndUtc'
  >,
  now = new Date(),
) {
  const start = preferredStartUtc
    ? new Date(preferredStartUtc)
    : new Date(now.getTime() + defaultDurationMinutes * minuteMilliseconds);
  if (!preferredStartUtc)
    start.setMinutes(
      Math.floor(start.getMinutes() / startStepMinutes) * startStepMinutes,
      0,
      0,
    );
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
          : new Date(
              start.getTime() + defaultDurationMinutes * minuteMilliseconds,
            ),
    ),
    attendees: String(initial?.attendees ?? 1),
  };
}

export type BookingSelection = ReturnType<typeof createBookingSelection>;

export function buildSuggestionQuery(
  selection: BookingSelection,
  rooms: Room[],
  equipment: Equipment[],
  excludeReservationId?: string,
  now = Date.now(),
) {
  const attendees = Number(selection.attendees);
  const selectedRoom = rooms.find((room) => room.id === selection.roomId);
  if (
    !selection.organizerId ||
    !Number.isInteger(attendees) ||
    attendees <= 0 ||
    !(new Date(selection.start).getTime() > now) ||
    !(new Date(selection.end) > new Date(selection.start)) ||
    !rooms.some(
      (room) =>
        room.isActive &&
        room.capacity >= attendees &&
        room.capacity < (selectedRoom?.capacity ?? 0),
    )
  )
    return null;
  const query = new URLSearchParams({
    roomId: selection.roomId,
    organizerId: selection.organizerId,
    attendees: String(attendees),
    startUtc: toUtc(selection.start),
    endUtc: toUtc(selection.end),
  });
  if (equipment.length) query.set('equipment', equipment.join(','));
  if (excludeReservationId)
    query.set('excludeReservationId', excludeReservationId);
  return query;
}
