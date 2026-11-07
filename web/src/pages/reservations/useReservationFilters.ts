import { useSearchParams } from 'react-router-dom';

export const reservationPageSize = 6;

export interface ReservationFilters {
  view: 'upcoming' | 'history';
  page: number;
  roomId: string;
  organizerId: string;
  status: string;
  from: string;
  to: string;
}

function localDate(value: string | null) {
  return value && Number.isFinite(new Date(value).getTime()) ? value : '';
}

export function useReservationFilters() {
  const [search, setSearch] = useSearchParams();
  const requestedPage = Number(search.get('page') ?? 1);
  const view = search.get('view') === 'history' ? 'history' : 'upcoming';
  const status = search.get('status');
  const filters: ReservationFilters = {
    view,
    page:
      Number.isSafeInteger(requestedPage) && requestedPage > 0
        ? requestedPage
        : 1,
    roomId: search.get('roomId') ?? '',
    organizerId: search.get('organizerId') ?? '',
    status:
      view === 'history' && (status === 'Completed' || status === 'Cancelled')
        ? status
        : '',
    from: localDate(search.get('from')),
    to: localDate(search.get('to')),
  };

  function updateFilters(patch: Partial<ReservationFilters>, replace = false) {
    setSearch(
      (previous) => {
        const next = new URLSearchParams(previous);
        for (const [key, value] of Object.entries(patch)) {
          if (
            value === '' ||
            (key === 'view' && value === 'upcoming') ||
            (key === 'page' && value === 1)
          )
            next.delete(key);
          else next.set(key, String(value));
        }
        return next;
      },
      { replace },
    );
  }

  return { filters, updateFilters };
}
