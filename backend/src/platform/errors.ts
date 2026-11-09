/** An expected failure with a stable code. The Worker turns it into a plain message, never a stack trace. */
export class PlatformError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
  }
}
