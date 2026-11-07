/** A confirmed API failure or a write whose outcome still needs confirmation. */
export class ApiError extends Error {
  readonly code: string;
  readonly outcomeUnknown: boolean;

  constructor(
    message: string,
    code = 'REQUEST_FAILED',
    outcomeUnknown = false,
  ) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.outcomeUnknown = outcomeUnknown;
  }
}
