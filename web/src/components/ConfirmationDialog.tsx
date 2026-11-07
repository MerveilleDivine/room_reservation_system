import type { Reservation } from '../api/contracts';
import { ModalDialog } from './ModalDialog';

interface Props {
  reservation: Reservation;
  action: 'cancel' | 'end';
  pending: boolean;
  error: Error | null;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmationDialog({
  reservation,
  action,
  pending,
  error,
  onConfirm,
  onClose,
}: Props) {
  const title =
    action === 'cancel' ? 'Cancel reservation?' : 'End meeting now?';
  return (
    <ModalDialog
      labelledBy="confirmation-heading"
      pending={pending}
      onClose={onClose}
    >
      <div className="dialog-heading">
        <h2 id="confirmation-heading">{title}</h2>
      </div>
      <p>
        {action === 'cancel'
          ? `Cancel “${reservation.title}” and release its reserved time?`
          : `End “${reservation.title}” now and release the room?`}
      </p>
      {error ? (
        <div className="notice error" role="alert">
          {error.message}
        </div>
      ) : null}
      <div className="dialog-actions">
        <button
          className="button secondary"
          autoFocus
          disabled={pending}
          onClick={onClose}
        >
          Go back
        </button>
        <button
          className="button primary"
          disabled={pending}
          onClick={onConfirm}
        >
          {pending
            ? 'Updating…'
            : action === 'cancel'
              ? 'Cancel reservation'
              : 'End meeting'}
        </button>
      </div>
    </ModalDialog>
  );
}
