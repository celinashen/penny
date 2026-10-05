/**
 * fetch that retries reads once when the request never got a response.
 *
 * After the server sits idle for a while, the first request often goes out on
 * a pooled connection that Supabase has already closed, and fails with
 * "fetch failed" before reaching the database. A second attempt opens a fresh
 * connection and succeeds. Only GET and HEAD are retried, so a write can never
 * be applied twice.
 */
export const fetchWithRetry: typeof fetch = async (input, init) => {
  const method = (
    init?.method ?? (input instanceof Request ? input.method : "GET")
  ).toUpperCase();
  try {
    return await fetch(input, init);
  } catch (error) {
    const idempotent = method === "GET" || method === "HEAD";
    if (!idempotent || init?.signal?.aborted) throw error;
    return fetch(input, init);
  }
};
