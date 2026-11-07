import { useEffect, useReducer } from 'react';
import { useLocation, useNavigationType } from 'react-router-dom';
import type {
  BookingRequest,
  Equipment,
  Reservation,
  ReservationAction,
} from '../api/contracts';
import { useBookingMutations } from '../features/reservations/useBookingMutations';
import { canManage } from '../lib/profile';
import type { SavedBooking } from '../features/reservations/types';

type BookingForm = {
  reservation: Reservation | null;
  roomId?: string;
  startUtc?: string;
  endUtc?: string;
  requiredEquipment?: Equipment[];
};

type WorkspaceDialog =
  | { kind: 'closed' }
  | { kind: 'booking'; form: BookingForm }
  | { kind: 'continuation'; reservation: Reservation }
  | {
      kind: 'confirmation';
      reservation: Reservation;
      action: 'cancel' | 'end';
    };

interface State {
  dialog: WorkspaceDialog;
  saved: SavedBooking | null;
  notice: string;
  actionError: Error | null;
}

type Event =
  | { type: 'open'; dialog: WorkspaceDialog }
  | { type: 'reset' }
  | { type: 'close' }
  | { type: 'clear-feedback' }
  | { type: 'dismiss-saved' }
  | { type: 'dismiss-notice' }
  | { type: 'saved'; saved: SavedBooking }
  | { type: 'action-saved'; notice: string }
  | { type: 'action-error'; error: Error };

const initialState: State = {
  dialog: { kind: 'closed' },
  saved: null,
  notice: '',
  actionError: null,
};

function reduceWorkflow(state: State, event: Event): State {
  switch (event.type) {
    case 'reset':
      return initialState;
    case 'close':
      return { ...state, dialog: { kind: 'closed' } };
    case 'open':
      return {
        ...state,
        dialog: event.dialog,
        saved: null,
        notice: '',
        actionError: null,
      };
    case 'clear-feedback':
      return { ...state, saved: null, notice: '', actionError: null };
    case 'dismiss-saved':
      return state.saved ? { ...state, saved: null } : state;
    case 'dismiss-notice':
      return { ...state, notice: '' };
    case 'saved':
      return {
        ...state,
        saved: event.saved,
        dialog: { kind: 'closed' },
        notice: '',
        actionError: null,
      };
    case 'action-saved':
      return {
        ...state,
        dialog: { kind: 'closed' },
        saved: null,
        actionError: null,
        notice: event.notice,
      };
    case 'action-error':
      return { ...state, actionError: event.error };
  }
}

export function useReservationWorkflow(
  profile: string,
  showReservations: () => void,
) {
  const [state, dispatch] = useReducer(reduceWorkflow, initialState);
  const navigationType = useNavigationType();
  const { key: navigationKey } = useLocation();
  useEffect(() => {
    if (navigationType === 'POP') dispatch({ type: 'dismiss-saved' });
  }, [navigationType, navigationKey]);
  const mutations = useBookingMutations(profile);
  const pending =
    mutations.save.isPending ||
    mutations.continueBooking.isPending ||
    mutations.action.isPending;

  async function save(
    booking: BookingRequest,
    id: string | undefined,
    submissionKey: string,
  ) {
    const reservation = await mutations.save.mutateAsync({
      booking,
      id,
      submissionKey,
    });
    dispatch({
      type: 'saved',
      saved: { reservation, label: id ? 'Changes saved' : 'You’re booked' },
    });
    showReservations();
  }

  async function saveContinuation(
    id: string,
    additionalMinutes: number,
    submissionKey: string,
  ) {
    const reservation = await mutations.continueBooking.mutateAsync({
      id,
      additionalMinutes,
      submissionKey,
    });
    dispatch({
      type: 'saved',
      saved: { reservation, label: 'Extra time reserved' },
    });
    showReservations();
  }

  async function performAction(
    reservation: Reservation,
    action: 'cancel' | 'check-in' | 'end',
  ) {
    if (!canManage(profile, reservation.organizerId) || pending) return;
    dispatch({ type: 'clear-feedback' });
    try {
      await mutations.action.mutateAsync({ id: reservation.id, action });
      dispatch({
        type: 'action-saved',
        notice:
          action === 'check-in'
            ? 'Checked in.'
            : action === 'end'
              ? 'Meeting ended. The room is released.'
              : 'Reservation cancelled.',
      });
    } catch (failure) {
      dispatch({
        type: 'action-error',
        error: failure instanceof Error ? failure : new Error('Action failed.'),
      });
    }
  }

  function handleAction(reservation: Reservation, action: ReservationAction) {
    if (!canManage(profile, reservation.organizerId) || pending) return;
    if (action === 'edit')
      dispatch({
        type: 'open',
        dialog: { kind: 'booking', form: { reservation } },
      });
    else if (action === 'reserve-more')
      dispatch({ type: 'open', dialog: { kind: 'continuation', reservation } });
    else if (action === 'check-in') void performAction(reservation, action);
    else
      dispatch({
        type: 'open',
        dialog: { kind: 'confirmation', reservation, action },
      });
  }

  return {
    ...state,
    // Confirmation belongs to the navigation after saving, never a history entry.
    saved: navigationType === 'POP' ? null : state.saved,
    pending,
    save,
    saveContinuation,
    handleAction,
    confirmAction: () => {
      if (state.dialog.kind === 'confirmation')
        void performAction(state.dialog.reservation, state.dialog.action);
    },
    openBooking: (form: BookingForm = { reservation: null }) =>
      dispatch({ type: 'open', dialog: { kind: 'booking', form } }),
    closeDialog: () => {
      if (!pending) dispatch({ type: 'close' });
    },
    reset: () => dispatch({ type: 'reset' }),
    clearFeedback: () => dispatch({ type: 'clear-feedback' }),
    dismissSaved: () => dispatch({ type: 'dismiss-saved' }),
    dismissNotice: () => dispatch({ type: 'dismiss-notice' }),
  };
}

export type ReservationWorkflow = ReturnType<typeof useReservationWorkflow>;
