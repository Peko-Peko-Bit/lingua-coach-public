"use client";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createSupabaseBrowser } from "@/lib/supabase-browser";
import { useUser } from "@/hooks/useUser";

export function UserAuthSection() {
  const { user, loading } = useUser();
  const [isSigningIn, setIsSigningIn] = useState(false);

  async function signInWithGoogle() {
    if (isSigningIn) return;
    setIsSigningIn(true);
    try {
      const supabase = createSupabaseBrowser();
      await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
    } finally {
      setIsSigningIn(false);
    }
  }

  async function signOut() {
    const supabase = createSupabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  if (loading) {
    return (
      <div className="h-10 rounded-xl bg-[var(--bg-elevated)] animate-pulse" />
    );
  }

  if (!user) {
    return (
      <button
        onClick={signInWithGoogle}
        disabled={isSigningIn}
        className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 rounded-xl
                   border border-[var(--border)] bg-[var(--bg-elevated)]
                   hover:border-[var(--accent-border)] hover:bg-[var(--accent-10)]
                   text-[var(--text-secondary)] hover:text-[var(--accent-text)]
                   transition-all duration-150 text-sm font-medium
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isSigningIn ? (
          <Loader2 size={16} className="animate-spin flex-shrink-0" />
        ) : (
          <GoogleIcon />
        )}
        {isSigningIn ? "Signing in..." : "Sign in with Google"}
      </button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {user.user_metadata?.avatar_url ? (
        <img
          src={user.user_metadata.avatar_url}
          alt="avatar"
          className="w-8 h-8 rounded-full flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-[var(--accent-10)] flex items-center justify-center text-xs font-bold text-[var(--accent-text)] flex-shrink-0">
          {(user.email?.[0] ?? "U").toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-[var(--text-secondary)] truncate">
          {user.user_metadata?.full_name ?? user.email}
        </p>
        <p className="text-[10px] text-[var(--text-dim)] truncate">{user.email}</p>
      </div>
      <button
        onClick={signOut}
        className="flex-shrink-0 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold
                   text-[var(--text-dim)] hover:text-red-400
                   hover:bg-red-500/10 transition-all duration-150"
      >
        Sign out
      </button>
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
