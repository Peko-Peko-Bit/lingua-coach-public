import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { isEmailAllowed } from "@/lib/auth-allowlist";

/**
 * A user created within this window is treated as brand new, so rejecting them
 * also removes the account Supabase just created. Anyone older was approved at
 * some point and keeps their row (and data) — they are only signed out.
 */
const NEW_USER_WINDOW_MS = 60_000;

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const next = searchParams.get("next") ?? "/";

  if (code) {
    const supabase = await createAuthServerClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error && data.user) {
      if (isEmailAllowed(data.user.email)) {
        return NextResponse.redirect(`${origin}${next}`);
      }

      await supabase.auth.signOut();

      if (Date.now() - new Date(data.user.created_at).getTime() < NEW_USER_WINDOW_MS) {
        const admin = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
        const { error: deleteError } = await admin.auth.admin.deleteUser(data.user.id);
        if (deleteError) {
          console.error("[auth] failed to remove rejected user", deleteError);
        }
      }

      return NextResponse.redirect(`${origin}/auth/error?reason=not_allowed`);
    }
  }

  return NextResponse.redirect(`${origin}/auth/error`);
}
