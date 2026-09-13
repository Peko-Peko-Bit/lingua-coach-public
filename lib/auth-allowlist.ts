/**
 * Google sign-in is restricted to a pre-approved set of addresses.
 * Set ALLOWED_EMAILS to a comma-separated list (matched case-insensitively).
 * Guest (anonymous) sign-in never goes through here and is unaffected.
 */
export function isEmailAllowed(email: string | null | undefined): boolean {
  if (!email) return false;

  const raw = process.env.ALLOWED_EMAILS;
  if (!raw?.trim()) {
    console.error("[auth] ALLOWED_EMAILS is not set; rejecting all Google sign-ins");
    return false;
  }

  const allowed = raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  return allowed.includes(email.trim().toLowerCase());
}
