import { useRef, useState } from 'react';
import { ApiError } from '../../shared/api/ApiError';
import type { BookingRequest } from '../../api/contracts';
import { toUtc } from '../../lib/dates';
import { useSubmissionKey } from '../../hooks/useSubmissionKey';
import { createBookingSelection, buildSuggestionQuery } from './bookingForm';
import type { BookingDialogProps } from './types';

export function useBookingForm({
  organizerId,
  rooms,
  initial,
  preferredRoomId,
  preferredStartUtc,
  preferredEndUtc,
  requiredEquipment = [],
  onSave,
}: BookingDialogProps) {
  const [error, setError] = useState<Error | null>(null);
  const [saving, setSaving] = useState(false);
  const pendingRequest = useRef<BookingRequest | null>(null);
  const submissionKey = useSubmissionKey();
  const unconfirmed = error instanceof ApiError && error.outcomeUnknown;
  const [selection, setSelection] = useState(() =>
    createBookingSelection({
      organizerId,
      rooms,
      initial,
      preferredRoomId,
      preferredStartUtc,
      preferredEndUtc,
    }),
  );
  const suggestionQuery =
    !saving && !unconfirmed
      ? buildSuggestionQuery(selection, rooms, requiredEquipment, initial?.id)
      : null;

  async function submit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const request: BookingRequest =
      unconfirmed && pendingRequest.current
        ? pendingRequest.current
        : {
            title: String(form.get('title')),
            roomId: String(form.get('roomId')),
            organizerId: String(form.get('organizerId')),
            startUtc: toUtc(String(form.get('start'))),
            endUtc: toUtc(String(form.get('end'))),
            attendees: Number(form.get('attendees')),
          };
    pendingRequest.current = request;
    setSaving(true);
    setError(null);
    try {
      await onSave(
        request,
        initial?.id,
        submissionKey({ request, id: initial?.id }),
      );
    } catch (failure) {
      setError(
        failure instanceof Error
          ? failure
          : new Error('Could not save this reservation.'),
      );
    } finally {
      setSaving(false);
    }
  }

  return {
    selection,
    setSelection,
    suggestionQuery,
    error,
    saving,
    unconfirmed,
    submit,
  };
}
