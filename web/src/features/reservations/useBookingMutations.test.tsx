import type { ReactNode } from 'react';
import { act, renderHook } from '@testing-library/react';
import { QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi } from 'vitest';
import { reservation } from '../../test/fixtures';
import { createApiQueryClient } from '../../shared/api/queryClient';
import { useBookingMutations } from './useBookingMutations';

function setup() {
  const client = createApiQueryClient();
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  return { client, wrapper };
}

describe('booking mutations', () => {
  it('does not retry a rejected lifecycle action and invalidates only its profile', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          code: 'RESERVATION_NOT_ACTIVE',
          detail: 'Already ended.',
        }),
        { status: 409 },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const { client, wrapper } = setup();
    const key = ['profile', 'member', '/reservation-feed'] as const;
    const otherKey = ['profile', 'other-member', '/reservation-feed'] as const;
    client.setQueryData(key, { items: [reservation] });
    client.setQueryData(otherKey, { items: [] });
    const { result } = renderHook(() => useBookingMutations('member'), {
      wrapper,
    });

    await act(async () => {
      await expect(
        result.current.action.mutateAsync({
          id: reservation.id,
          action: 'end',
        }),
      ).rejects.toMatchObject({ code: 'RESERVATION_NOT_ACTIVE' });
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      new Headers((fetchMock.mock.calls[0]![1] as RequestInit).headers).get(
        'X-Roomwise-Profile',
      ),
    ).toBe('member');
    expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(otherKey)?.isInvalidated).toBe(false);
  });

  it('marks existing feeds stale after saving so the focused confirmation can load fresh data', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(reservation)));
    vi.stubGlobal('fetch', fetchMock);
    const { client, wrapper } = setup();
    const feedKey = [
      'profile',
      'member',
      '/reservation-feed?view=upcoming',
    ] as const;
    const roomKey = ['profile', 'member', '/rooms'] as const;
    client.setQueryData(feedKey, { items: [] });
    client.setQueryData(roomKey, []);
    const { result } = renderHook(() => useBookingMutations('member'), {
      wrapper,
    });

    await act(async () => {
      await expect(
        result.current.save.mutateAsync({
          booking: reservation,
          submissionKey: 'same-request',
        }),
      ).resolves.toMatchObject({ id: reservation.id });
    });

    expect(client.getQueryState(feedKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(roomKey)?.isInvalidated).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
