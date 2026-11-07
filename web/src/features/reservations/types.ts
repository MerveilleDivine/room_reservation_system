import type { Reservation } from '../../api/contracts';

export interface SavedBooking {
  reservation: Reservation;
  label: string;
}
