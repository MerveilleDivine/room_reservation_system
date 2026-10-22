import type { Person, Reservation, Room } from '../api/contracts';

export const rooms: Room[] = [
  {
    id: '10000000-0000-0000-0000-000000000001',
    name: 'Atlas',
    capacity: 12,
    floor: '1',
    equipment: ['tv', 'videoConferencing', 'whiteboard'],
    isActive: true,
  },
  {
    id: '10000000-0000-0000-0000-000000000004',
    name: 'Studio',
    capacity: 8,
    floor: '2',
    equipment: ['projector'],
    isActive: false,
  },
];
export const people: Person[] = [
  {
    id: '20000000-0000-0000-0000-000000000001',
    firstName: 'Alex',
    lastName: 'Morgan',
    activeReservationCount: 1,
  },
];
export const reservation: Reservation = {
  id: '30000000-0000-0000-0000-000000000001',
  roomId: rooms[0]!.id,
  roomName: 'Atlas',
  organizerId: people[0]!.id,
  organizerName: 'Alex Morgan',
  title: 'Planning',
  startUtc: '2026-10-25T09:00:00Z',
  endUtc: '2026-10-25T10:00:00Z',
  attendees: 4,
  status: 'Booked',
  checkedInAtUtc: null,
  actualEndUtc: null,
  allowedActions: ['edit', 'cancel'],
};
