import { NextResponse } from "next/server";
import { currentUser } from "@/lib/auth";
import { plaidErrorMessage } from "@/lib/plaid/client";
import { linkItem } from "@/lib/plaid/link";

// Body: { public_token: string }. Called once after a successful Plaid Link.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Not signed in." }, { status: 401 });

  const body = (await request.json().catch(() => ({}))) as {
    public_token?: unknown;
  };
  if (typeof body.public_token !== "string" || !body.public_token) {
    return NextResponse.json({ error: "Missing public_token." }, { status: 400 });
  }

  try {
    const result = await linkItem(user.id, body.public_token);
    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json({ error: plaidErrorMessage(err) }, { status: 502 });
  }
}
