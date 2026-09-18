import { createClient } from "@supabase/supabase-js";
import WebSocket from "ws";
import { supabaseUrl } from "./env";

/**
 * Service-role client: bypasses row-level security. Server-only, and only for
 * work with no signed-in user (the daily sync) or that touches server-only
 * columns (Plaid tokens). Callers must always scope queries to a user id.
 */
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) {
    throw new Error("Missing environment variable SUPABASE_SERVICE_ROLE_KEY.");
  }
  return createClient(supabaseUrl(), key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Node before v22 has no built-in WebSocket, which the client insists on
    // even though we never use realtime.
    realtime: { transport: WebSocket as unknown as typeof globalThis.WebSocket },
  });
}
