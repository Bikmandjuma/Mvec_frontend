import { QueryClient, useQuery, useQueryClient } from '@tanstack/react-query';
import { extractErrorMessage } from '../API/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
    },
  },
});

/**
 * Loads a screen's data through react-query: cached per key, shared by every
 * screen asking for the same key, and refreshed in the background (on focus,
 * reconnect, or `reload()`). `key` names everything the load depends on,
 * e.g. ['payouts', status, page], so a new value loads new data.
 */
export function useLoader(key, load) {
  const client = useQueryClient();
  // react-query refuses `undefined` results; an empty answer is `null`.
  const query = useQuery({ queryKey: key, queryFn: () => Promise.resolve(load()).then((d) => d ?? null) });
  return {
    data: query.data ?? null,
    loading: query.isPending,
    error: query.error ? extractErrorMessage(query.error) : '',
    notFound: query.error?.response?.status === 404,
    reload: () => query.refetch(),
    setData: (updater) => client.setQueryData(key, updater),
  };
}
