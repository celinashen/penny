import { NextResponse } from "next/server";
import { DEMO_BLOCKED_MESSAGE, currentUser, isDemoUser } from "@/lib/auth";
import { plaidErrorMessage } from "@/lib/plaid/client";
import { linkItem } from "@/lib/plaid/link";

// The first sync of a new bank can be large, so allow the longest request time.
export const maxDuration = 60;

// Body: { public_token: string, kind?: "bank" | "investment" }. Called once after a
// successful Plaid Link.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  // Belt and suspenders: /api/plaid/link-token already refuses the demo
  // account before it can ever get this far with a real public_token.
  if (isDemoUser(user)) {
    return NextResponse.json({ error: DEMO_BLOCKED_MESSAGE }, { status: 403 });
  }

  const body = (await request.json().catch(() => ({}))) as {
    public_token?: unknown;
    kind?: unknown;
  };
  if (typeof body.public_token !== "string" || !body.public_token) {
    return NextResponse.json({ error: "Missing public_token." }, { status: 400 });
  }

  try {
    const result = await linkItem(
      user.id,
      body.public_token,
      body.kind === "investment" ? "investment" : "bank",
    );
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: plaidErrorMessage(err) }, { status: 502 });
  }
}
