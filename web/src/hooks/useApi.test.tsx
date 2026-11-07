import type { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { useApi } from './useApi';
import { createApiQueryClient } from '../shared/api/queryClient';
import { useApiCache } from '../shared/api/useApiCache';

function setup() {
  const client = createApiQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('Query-owned API resources', () => {
  it('refreshes an identical search and starts changed inputs only once', async () => {
    const fetchMock = vi.fn(
      async (url: string) => new Response(JSON.stringify({ url })),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper } = setup();
    const { result, rerender } = renderHook(
      ({ path, revision }) => useApi<{ url: string }>(path, revision, 'member'),
      { wrapper, initialProps: { path: '/rooms?floor=1', revision: 0 } },
    );
    await waitFor(() =>
      expect(result.current.data?.url).toBe('/api/rooms?floor=1'),
    );

    rerender({ path: '/rooms?floor=1', revision: 1 });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.loading).toBe(false));

    rerender({ path: '/rooms?floor=2', revision: 2 });
    await waitFor(() =>
      expect(result.current.data?.url).toBe('/api/rooms?floor=2'),
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('cancels and removes the old profile without displaying its delayed response', async () => {
    let resolveOld: (value: Response) => void = () => {};
    const fetchMock = vi.fn(async (_url: string, options: RequestInit) => {
      const profile = new Headers(options.headers).get('X-Roomwise-Profile');
      if (profile === 'old-member')
        return new Promise<Response>((resolve) => {
          resolveOld = resolve;
        });
      return new Response(JSON.stringify({ title: 'New profile booking' }));
    });
    vi.stubGlobal('fetch', fetchMock);
    const { client, wrapper } = setup();
    const { result, rerender } = renderHook(
      ({ profile }) => ({
        resource: useApi<{ title: string }>('/reservation-feed', 0, profile),
        cache: useApiCache(),
      }),
      { wrapper, initialProps: { profile: 'old-member' } },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));
    const oldSignal = (fetchMock.mock.calls[0]![1] as RequestInit).signal;

    rerender({ profile: 'new-member' });
    await act(async () => {
      await result.current.cache.clearProfile('old-member');
    });
    await waitFor(() =>
      expect(result.current.resource.data?.title).toBe('New profile booking'),
    );
    expect(oldSignal?.aborted).toBe(true);
    await act(async () => {
      resolveOld(
        new Response(JSON.stringify({ title: 'Old private booking' })),
      );
    });

    expect(result.current.resource.data?.title).toBe('New profile booking');
    expect(
      client.getQueriesData({ queryKey: ['profile', 'old-member'] }),
    ).toEqual([]);
  });

  it('does not reuse another filter result while the new filter is loading', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(['old room'])))
      .mockImplementationOnce(() => new Promise<Response>(() => {}));
    vi.stubGlobal('fetch', fetchMock);
    const { wrapper } = setup();
    const { result, rerender, unmount } = renderHook(
      ({ path }) => useApi<string[]>(path, 0, 'member'),
      { wrapper, initialProps: { path: '/rooms?floor=1' } },
    );
    await waitFor(() => expect(result.current.data).toEqual(['old room']));
    rerender({ path: '/rooms?floor=2' });
    expect(result.current.data).toBeNull();
    expect(result.current.loading).toBe(true);
    unmount();
  });

  it('treats equivalent query parameter ordering as the same resource', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('[]'));
    vi.stubGlobal('fetch', fetchMock);
    const { client, wrapper } = setup();
    const { result, rerender } = renderHook(
      ({ path }) => useApi<string[]>(path, 0, 'member'),
      { wrapper, initialProps: { path: '/rooms?floor=1&minimumCapacity=4' } },
    );
    await waitFor(() => expect(result.current.data).toEqual([]));
    rerender({ path: '/rooms?minimumCapacity=4&floor=1' });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(client.getQueryCache().getAll()).toHaveLength(1);
  });
});
