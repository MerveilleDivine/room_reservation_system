import { withQuery } from '../../shared/api/paths';

export const roomsApi = {
  listPath: (query?: URLSearchParams) => withQuery('/rooms', query),
  availabilityPath: (query: URLSearchParams) =>
    withQuery('/room-availability', query),
  suggestionsPath: (query: URLSearchParams) =>
    withQuery('/room-suggestions', query),
};
