import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { plaidErrorMessage } from "@/lib/plaid/client";
import { createLinkToken } from "@/lib/plaid/link";

// Body: { itemId?: string, kind?: "bank" | "investment", addInvestments?: boolean }.
// With itemId, reopens that connection (update mode) to repair it, add an
// account, or (addInvestments) grant the Investments product to a connection
// linked without it; otherwise kind says what a new one is for.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    itemId?: unknown;
    kind?: unknown;
    addInvestments?: unknown;
  };
  const itemId = typeof body.itemId === "string" ? body.itemId : undefined;
  const kind = body.kind === "investment" ? "investment" : "bank";
  const addInvestments = body.addInvestments === true;

  try {
    const link_token = await createLinkToken(user.id, itemId, kind, addInvestments);
    return NextResponse.json({ link_token });
  } catch (err) {
    return NextResponse.json({ error: plaidErrorMessage(err) }, { status: 502 });
  }
}
