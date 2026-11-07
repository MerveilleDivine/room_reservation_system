import { QueryClient } from '@tanstack/react-query';

export function createApiQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        refetchInterval: false,
        refetchOnWindowFocus: false,
        refetchOnReconnect: false,
        refetchOnMount: 'always',
        staleTime: 0,
      },
      mutations: { retry: false },
    },
  });
}
