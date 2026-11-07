import type { Person, Room } from '../api/contracts';
import { BookingDialog } from '../components/BookingDialog';
import { ContinuationDialog } from '../components/ContinuationDialog';
import { ConfirmationDialog } from '../components/ConfirmationDialog';
import type { ReservationWorkflow } from './useReservationWorkflow';

export function WorkspaceDialogs({
  profile,
  rooms,
  people,
  workflow,
}: {
  profile: string;
  rooms: Room[] | null;
  people: Person[] | null;
  workflow: ReservationWorkflow;
}) {
  const dialog = workflow.dialog;
  if (dialog.kind === 'booking' && rooms && people)
    return (
      <BookingDialog
        organizerId={profile === 'admin' ? undefined : profile}
        rooms={rooms}
        people={people}
        initial={dialog.form.reservation}
        preferredRoomId={dialog.form.roomId}
        preferredStartUtc={dialog.form.startUtc}
        preferredEndUtc={dialog.form.endUtc}
        requiredEquipment={dialog.form.requiredEquipment}
        onSave={workflow.save}
        onClose={workflow.closeDialog}
      />
    );
  if (dialog.kind === 'continuation')
    return (
      <ContinuationDialog
        reservation={dialog.reservation}
        onSave={workflow.saveContinuation}
        onClose={workflow.closeDialog}
      />
    );
  if (dialog.kind === 'confirmation')
    return (
      <ConfirmationDialog
        reservation={dialog.reservation}
        action={dialog.action}
        pending={workflow.pending}
        error={workflow.actionError}
        onConfirm={workflow.confirmAction}
        onClose={workflow.closeDialog}
      />
    );
  return null;
}
