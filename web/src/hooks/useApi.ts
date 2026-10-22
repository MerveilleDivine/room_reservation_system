import { useEffect, useState } from 'react';
import { request } from '../api/client';

export interface ApiResource<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

export function useApi<T>(
  path: string | null,
  revision: number,
): ApiResource<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    void request<T>(path, { signal: controller.signal })
      .then((result) => {
        if (!controller.signal.aborted) setData(result);
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setError(
            failure instanceof Error ? failure : new Error('Request failed.'),
          );
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [path, revision]);

  return { data, error, loading };
}
