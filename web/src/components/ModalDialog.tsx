import { useEffect, useRef } from 'react';
import type { ReactNode, RefObject } from 'react';

interface Props {
  labelledBy: string;
  pending?: boolean;
  initialFocus?: RefObject<HTMLElement | null>;
  onClose: () => void;
  children: ReactNode;
}

export function ModalDialog({
  labelledBy,
  pending = false,
  initialFocus,
  onClose,
  children,
}: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const previousFocus = useRef(document.activeElement);
  useEffect(() => {
    const element = dialog.current;
    const target = previousFocus.current;
    element?.showModal();
    initialFocus?.current?.focus();
    return () => {
      element?.close();
      if (target instanceof HTMLElement && target.isConnected) target.focus();
    };
  }, [initialFocus]);

  return (
    <dialog
      ref={dialog}
      className="booking-dialog"
      aria-labelledby={labelledBy}
      aria-busy={pending}
      onCancel={(event) => {
        event.preventDefault();
        if (!pending) onClose();
      }}
    >
      {children}
    </dialog>
  );
}
