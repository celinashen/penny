import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

let client: PlaidApi | undefined;

export function plaid(): PlaidApi {
  if (client) return client;

  const clientId = process.env.PLAID_CLIENT_ID;
  const secret = process.env.PLAID_SECRET;
  const env = process.env.PLAID_ENV ?? "sandbox";
  if (!clientId || !secret) {
    throw new Error("Missing PLAID_CLIENT_ID or PLAID_SECRET.");
  }
  const basePath = PlaidEnvironments[env];
  if (!basePath) throw new Error(`Unknown PLAID_ENV "${env}".`);

  client = new PlaidApi(
    new Configuration({
      basePath,
      baseOptions: {
        headers: { "PLAID-CLIENT-ID": clientId, "PLAID-SECRET": secret },
      },
    }),
  );
  return client;
}

/** Plaid's error_code from a failed API call, if there is one. */
export function plaidErrorCode(err: unknown): string | undefined {
  return (err as { response?: { data?: { error_code?: string } } })?.response
    ?.data?.error_code;
}

export function plaidErrorMessage(err: unknown): string {
  const data = (
    err as { response?: { data?: { error_message?: string } } }
  )?.response?.data;
  return data?.error_message ?? (err instanceof Error ? err.message : "Unknown error");
}
