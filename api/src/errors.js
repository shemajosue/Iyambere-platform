/** An error that carries the HTTP status and message the client should see. */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Postgres rejects malformed input (a non-numeric id, an unknown enum value)
 * with these codes. They are the caller's mistake, not a server fault, so
 * they become a 400 with a readable message instead of a generic 500.
 */
const CLIENT_PG_ERRORS = {
  '22P02': 'One of the values sent is not in the expected format.',
  '22003': 'One of the numbers sent is out of range.',
  '23503': 'That refers to a record that does not exist.',
  '23505': 'That record already exists.',
};

export function toHttpError(error) {
  if (error instanceof HttpError) return error;
  if (error?.code && CLIENT_PG_ERRORS[error.code]) {
    return new HttpError(400, CLIENT_PG_ERRORS[error.code]);
  }
  return null;
}
