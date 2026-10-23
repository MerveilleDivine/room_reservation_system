import { useRef } from 'react';

/** Keep a request's identity across retries; different input describes a new operation. */
export function useSubmissionKey() {
  const lastSubmission = useRef<{ payload: string; key: string } | null>(null);

  return (payload: unknown) => {
    const serialized = JSON.stringify(payload);
    if (lastSubmission.current?.payload !== serialized) {
      lastSubmission.current = {
        payload: serialized,
        key: crypto.randomUUID(),
      };
    }
    return lastSubmission.current.key;
  };
}
