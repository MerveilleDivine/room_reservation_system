import { useEffect, useState } from 'react';
import { request } from '../api/client';

export interface ApiResource<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}
interface Snapshot<T> extends ApiResource<T> {
  path: string | null;
  revision: number;
}

export function useApi<T>(
  path: string | null,
  revision: number,
): ApiResource<T> {
  const [snapshot, setSnapshot] = useState<Snapshot<T>>({
    path: null,
    revision: -1,
    data: null,
    error: null,
    loading: false,
  });
  useEffect(() => {
    if (path === null) return;
    const controller = new AbortController();
    setSnapshot({ path, revision, data: null, error: null, loading: true });
    void request<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setSnapshot({ path, revision, data, error: null, loading: false });
      })
      .catch((failure: unknown) => {
        if (!controller.signal.aborted)
          setSnapshot({
            path,
            revision,
            data: null,
            error:
              failure instanceof Error ? failure : new Error('Request failed.'),
            loading: false,
          });
      });
    return () => controller.abort();
  }, [path, revision]);
  if (snapshot.path !== path || snapshot.revision !== revision)
    return { data: null, error: null, loading: path !== null };
  return snapshot;
}
