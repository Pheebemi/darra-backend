/**
 * Pull a status and a human message out of an axios-style rejection.
 *
 * The route handlers all need the same two things from a failed backend call,
 * and typing the shape here keeps them from each reaching for `any`.
 */
interface ApiErrorShape {
  response?: { status?: number; data?: { message?: string; detail?: string } };
  message?: string;
}

export function apiError(error: unknown, fallback: string) {
  const err = (error ?? {}) as ApiErrorShape;
  return {
    status: err.response?.status ?? 500,
    message: err.response?.data?.message || err.response?.data?.detail || err.message || fallback,
  };
}

/** Message from a thrown value, for client-side catch blocks. */
export function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}
