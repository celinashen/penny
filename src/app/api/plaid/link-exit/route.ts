import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";

// Plaid Link errors happen in the browser, inside Plaid's own window, so the
// server never sees them. Link reports them here so they land in the logs.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const pick = (k: string) => (typeof body[k] === "string" ? (body[k] as string).slice(0, 500) : null);
  console.error("Plaid Link exited with an error", {
    user_id: user.id,
    item_id: pick("itemId"),
    kind: pick("kind"),
    error_type: pick("error_type"),
    error_code: pick("error_code"),
    error_message: pick("error_message"),
    status: pick("status"),
    institution: pick("institution"),
    link_session_id: pick("link_session_id"),
    request_id: pick("request_id"),
  });
  return NextResponse.json({ ok: true });
}
