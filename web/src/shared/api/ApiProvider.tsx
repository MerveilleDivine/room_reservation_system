import { useState } from 'react';
import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { createApiQueryClient } from './queryClient';

export function ApiProvider({ children }: { children: ReactNode }) {
  const [client] = useState(createApiQueryClient);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
