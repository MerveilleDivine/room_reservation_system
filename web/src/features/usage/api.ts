import { withQuery } from '../../shared/api/paths';

export const usageApi = {
  reportPath: (query: URLSearchParams | string) => withQuery('/usage', query),
};
