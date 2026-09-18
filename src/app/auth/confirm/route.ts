import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Landing point for the link in Supabase's confirmation email. Handles both
// the PKCE flow (?code=) and the token-hash flow (?token_hash=&type=).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;

  // Only follow same-site relative redirects.
  const next = searchParams.get("next");
  const destination = next && /^\/(?!\/)/.test(next) ? next : "/";

  const supabase = await createClient();

  let error: unknown = new Error("Missing confirmation parameters.");
  if (code) {
    ({ error } = await supabase.auth.exchangeCodeForSession(code));
  } else if (tokenHash && type) {
    ({ error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    }));
  }

  if (error) {
    return NextResponse.redirect(`${origin}/login`);
  }
  return NextResponse.redirect(`${origin}${destination}`);
}
