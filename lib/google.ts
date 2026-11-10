// Sign-in with Google, optional: only when GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET are set. Google confirms the
// email; the person must already be registered in Team with that same email.
export const googleEnabled = () => !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

export function googleAuthUrl(hub: string, state: string): string {
  const u = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  u.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: `${hub}/auth/google/callback`, response_type: "code",
    scope: "openid email", state, prompt: "select_account",
  }).toString();
  return u.toString();
}

/** Exchanges the code for the verified email of the account. Returns null if anything does not match. */
export async function googleEmail(hub: string, code: string): Promise<string | null> {
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      redirect_uri: `${hub}/auth/google/callback`, grant_type: "authorization_code",
    }),
    signal: AbortSignal.timeout(15000),
  });
  const t = (await r.json().catch(() => ({}))) as { access_token?: string };
  if (!r.ok || !t.access_token) return null;
  const u = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${t.access_token}` }, signal: AbortSignal.timeout(15000) });
  const d = (await u.json().catch(() => ({}))) as { email?: string; email_verified?: boolean };
  return u.ok && d.email && d.email_verified ? d.email.toLowerCase() : null;
}
