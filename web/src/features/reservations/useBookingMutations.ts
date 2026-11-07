import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { BookingRequest } from '../../api/contracts';
import {
  isReservationFeedPath,
  reservationAction,
  reserveAdditionalTime,
  saveReservation,
} from './api';
import type { LifecycleAction } from './api';

/** Mutations capture the submitting profile for the write and receipt lookup. */
export function useBookingMutations(profile: string) {
  const client = useQueryClient();
  const refresh = async (focusSavedBooking = false) => {
    const queryKey = ['profile', profile] as const;
    if (focusSavedBooking) {
      // The caller changes the feed to the saved reservation's focus query.
      // Mark old feeds stale without fetching the page being left behind.
      await client.invalidateQueries({ queryKey, refetchType: 'none' });
      await client.invalidateQueries({
        queryKey,
        predicate: (query) => !isReservationFeedPath(query.queryKey[2]),
      });
    } else {
      await client.invalidateQueries({ queryKey });
    }
  };
  const save = useMutation({
    mutationFn: ({
      booking,
      id,
      submissionKey,
    }: {
      booking: BookingRequest;
      id?: string;
      submissionKey: string;
    }) => saveReservation(booking, id, submissionKey, profile),
    retry: false,
    onSettled: (_data, error) => refresh(error === null),
  });
  const continueBooking = useMutation({
    mutationFn: ({
      id,
      additionalMinutes,
      submissionKey,
    }: {
      id: string;
      additionalMinutes: number;
      submissionKey: string;
    }) => reserveAdditionalTime(id, additionalMinutes, submissionKey, profile),
    retry: false,
    onSettled: (_data, error) => refresh(error === null),
  });
  const action = useMutation({
    mutationFn: ({ id, action }: { id: string; action: LifecycleAction }) =>
      reservationAction(id, action, profile),
    retry: false,
    onSettled: () => refresh(),
  });
  return { save, continueBooking, action };
}
