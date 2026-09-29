import { type RefObject, useEffect } from 'react';

/**
 * Closes a popover on Escape, on a pointer press outside `ref`, and when
 * keyboard focus moves outside it. Only listens while `open`.
 */
export function useDismiss(ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    const onPointer = (event: MouseEvent | TouchEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) onClose();
    };
    const onFocusIn = (event: FocusEvent) => {
      if (ref.current && event.target instanceof Node && !ref.current.contains(event.target)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('touchstart', onPointer, { passive: true });
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('touchstart', onPointer);
      document.removeEventListener('focusin', onFocusIn);
    };
  }, [ref, open, onClose]);
}
