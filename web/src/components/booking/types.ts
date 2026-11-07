import type {
  BookingRequest,
  Equipment,
  Person,
  Reservation,
  Room,
} from '../../api/contracts';

export interface BookingDialogProps {
  organizerId?: string;
  rooms: Room[];
  people: Person[];
  initial: Reservation | null;
  preferredRoomId?: string;
  preferredStartUtc?: string;
  preferredEndUtc?: string;
  requiredEquipment?: Equipment[];
  onSave: (
    request: BookingRequest,
    id: string | undefined,
    submissionKey: string,
  ) => Promise<void>;
  onClose: () => void;
}
