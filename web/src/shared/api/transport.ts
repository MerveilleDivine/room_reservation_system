import axios from 'axios';
import { readProfile } from '../../lib/profile';
import { ApiError } from './ApiError';

export const profileHeader = 'X-Roomwise-Profile';
export const submissionHeader = 'Idempotency-Key';

/** One same-origin transport; deployments may explicitly override the API base. */
export const transport = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  adapter: 'fetch',
  // Axios supports runtimes without Request. Passing URL/init also supports
  // relative same-origin URLs directly at the HTTP boundary.
  env: {
    Request: null as unknown as typeof Request,
    fetch: (...args) => globalThis.fetch(...args),
  },
  responseType: 'text',
  transformResponse: [(body: string) => body],
  validateStatus: () => true,
});

export interface RequestOptions
  extends Pick<
    RequestInit,
    'method' | 'headers' | 'body' | 'signal' | 'cache'
  > {
  profile?: string;
}

interface Problem {
  detail?: unknown;
  code?: unknown;
}

function parseJson(body: string): unknown {
  return JSON.parse(body) as unknown;
}

function readProblem(body: string): Problem {
  try {
    const parsed = parseJson(body);
    return typeof parsed === 'object' && parsed !== null ? parsed : {};
  } catch {
    return {};
  }
}

export async function request<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const method = options.method ?? 'GET';
  const isWrite = !['GET', 'HEAD'].includes(method.toUpperCase());
  const headers = new Headers(options.headers);
  headers.set('Content-Type', 'application/json');
  if (!headers.has(profileHeader))
    headers.set(profileHeader, options.profile ?? readProfile());

  let response;
  try {
    response = await transport.request<string>({
      url: path,
      method,
      data: options.body,
      headers: Object.fromEntries(headers),
      signal: options.signal ?? undefined,
      fetchOptions: { cache: options.cache },
    });
  } catch (error) {
    if (axios.isCancel(error)) {
      const reason: unknown = options.signal?.reason;
      throw reason instanceof Error
        ? reason
        : new DOMException('The request was cancelled.', 'AbortError');
    }
    if (error instanceof DOMException && error.name === 'AbortError')
      throw error;
    if (
      axios.isAxiosError(error) &&
      error.cause instanceof DOMException &&
      error.cause.name === 'AbortError'
    )
      throw error.cause;
    throw new ApiError(
      'Cannot reach the booking service. Refresh the page or try again shortly.',
      'API_UNAVAILABLE',
      isWrite,
    );
  }

  if (response.status < 200 || response.status >= 300) {
    const problem = readProblem(response.data);
    throw new ApiError(
      typeof problem.detail === 'string'
        ? problem.detail
        : response.status >= 500
          ? 'The booking service is unavailable. Please try again shortly.'
          : `Request failed (${response.status}). Please try again.`,
      typeof problem.code === 'string' ? problem.code : 'REQUEST_FAILED',
      isWrite && response.status >= 500,
    );
  }

  try {
    return parseJson(response.data) as T;
  } catch {
    throw new ApiError(
      'The booking service returned an unreadable response. Please try again.',
      'INVALID_RESPONSE',
      isWrite,
    );
  }
}
