import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { readProfile } from '../lib/profile';
import { normalizePath } from '../shared/api/paths';
import { request } from '../shared/api/transport';

export interface ApiResource<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
}

/** A consistent loading/error view over Query-owned, profile-scoped state. */
export function useApi<T>(
  path: string | null,
  revision: number,
  profile = readProfile(),
): ApiResource<T> {
  const normalizedPath = path === null ? null : normalizePath(path);
  const query = useQuery({
    queryKey: ['profile', profile, normalizedPath],
    queryFn: ({ signal }) => request<T>(path!, { signal, profile }),
    enabled: path !== null,
  });
  const previous = useRef({ path: normalizedPath, profile, revision });
  const { refetch } = query;

  useEffect(() => {
    const before = previous.current;
    previous.current = { path: normalizedPath, profile, revision };
    // Changed inputs start their new query once. Repeating an explicit search
    // with identical inputs still asks for fresh availability.
    if (
      normalizedPath !== null &&
      before.path === normalizedPath &&
      before.profile === profile &&
      before.revision !== revision
    )
      void refetch();
  }, [normalizedPath, profile, revision, refetch]);

  if (path === null) return { data: null, error: null, loading: false };
  return {
    // Keep this resource's data during refresh so forms using rooms/people do
    // not unmount. Distinct profile/filter keys never borrow previous data.
    data: query.data ?? null,
    error: query.isFetching ? null : query.error,
    loading: query.isPending || query.isFetching,
  };
}
