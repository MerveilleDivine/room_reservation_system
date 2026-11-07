import { useOutletContext } from 'react-router-dom';
import type { Person, Room } from '../api/contracts';
import type { ApiResource } from '../hooks/useApi';
import type { ReservationWorkflow } from './useReservationWorkflow';

type WorkspaceContext = {
  profile: string;
  allRooms: ApiResource<Room[]>;
  people: ApiResource<Person[]>;
  revision: number;
  canBook: boolean;
  workflow: ReservationWorkflow;
  refresh: () => void;
};

export function useWorkspace() {
  return useOutletContext<WorkspaceContext>();
}
