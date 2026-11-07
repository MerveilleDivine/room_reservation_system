export const pages = {
  reservations: {
    path: '/reservations',
    label: 'Reservations',
    title: 'Reservations',
    description: 'Manage your meetings and room bookings.',
  },
  rooms: {
    path: '/rooms',
    label: 'Rooms',
    title: 'Find your room.',
    description: 'Choose a space for your next meeting.',
  },
  people: {
    path: '/people',
    label: 'People',
    title: 'People',
    description: 'Organizers and their active reservations.',
  },
  usage: {
    path: '/usage',
    label: 'Usage',
    title: 'Room usage',
    description: 'See how your meeting spaces are being used.',
  },
} as const;

export type Page = keyof typeof pages;
