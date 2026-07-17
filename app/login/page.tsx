"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";

export default function LoginPage() {
  const [googleLoading, setGoogleLoading] = useState(false);
  const [guestLoading, setGuestLoading]   = useState(false);

  async function signInWithGoogle() {
    if (googleLoading) return;
    setGoogleLoading(true);
    try {
      const supabase = createSupabaseBrowser();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    } finally {
      setGoogleLoading(false);
    }
  }

  async function signInAsGuest() {
    if (guestLoading) return;
    setGuestLoading(true);
    try {
      const supabase = createSupabaseBrowser();
      const { data, error } = await supabase.auth.signInAnonymously();
      if (error || !data.user) {
        console.error("Guest login failed", error);
        return;
      }
      await fetch("/api/guest/seed", { method: "POST" });
      window.location.href = "/";
    } finally {
      setGuestLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
      <div className="flex flex-col items-center gap-8 px-8 py-10 rounded-2xl
                      bg-[var(--bg-sidebar)]/80 backdrop-blur-xl
                      border border-white/5 ring-1 ring-inset ring-white/5
                      w-full max-w-sm">
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            LinguaCoach
          </span>
          <span className="text-sm text-[var(--text-dim)]">
            AI Spanish Coach
          </span>
        </div>

        <div className="w-full flex flex-col gap-3">
          <button
            onClick={signInWithGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl
                       border border-[var(--border)] bg-[var(--bg-elevated)]
                       hover:border-[var(--accent-border)] hover:bg-[var(--accent-10)]
                       text-[var(--text-secondary)] hover:text-[var(--accent-text)]
                       transition-all duration-150 text-sm font-medium
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <Loader2 size={16} className="animate-spin flex-shrink-0" />
            ) : (
              <GoogleIcon />
            )}
            {googleLoading ? "Signing in..." : "Sign in with Google"}
          </button>

          <button
            onClick={signInAsGuest}
            disabled={guestLoading}
            className="w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl
                       border border-[var(--border)] bg-transparent
                       hover:bg-[var(--bg-elevated)]
                       text-[var(--text-dim)] hover:text-[var(--text-secondary)]
                       transition-all duration-150 text-sm font-medium
                       disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {guestLoading ? "Signing in..." : "Try as Guest"}
          </button>
          <p className="text-center text-xs text-[var(--text-dim)]">
            Guest data will be deleted after 24 hours
          </p>
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="w-4 h-4 flex-shrink-0" viewBox="0 0 24 24">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  );
}
