import { OAuthReturn } from "./oauth-return";

// The address registered with Plaid as the OAuth redirect (PLAID_REDIRECT_URI).
// Banks send you here after you sign in on their site. It needs your session, so
// the usual sign-in protection applies.
export const metadata = { title: "Finishing connection" };

export default function PlaidOAuth() {
  return <OAuthReturn />;
}
