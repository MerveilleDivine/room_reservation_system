import { useQueryClient } from '@tanstack/react-query';

export function useApiCache() {
  const client = useQueryClient();
  return {
    async clearProfile(profile: string) {
      const queryKey = ['profile', profile] as const;
      await client.cancelQueries({ queryKey });
      client.removeQueries({ queryKey });
    },
    invalidateProfile(profile: string) {
      return client.invalidateQueries({ queryKey: ['profile', profile] });
    },
  };
}
