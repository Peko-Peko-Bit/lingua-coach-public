import Link from "next/link";

export default async function AuthErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>;
}) {
  const { reason } = await searchParams;
  const notAllowed = reason === "not_allowed";

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
      <div className="flex flex-col items-center gap-6 px-8 py-10 rounded-2xl
                      bg-[var(--bg-sidebar)]/80 backdrop-blur-xl
                      border border-white/5 ring-1 ring-inset ring-white/5
                      w-full max-w-sm">
        <div className="flex flex-col items-center gap-2">
          <span className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            LinguaCoach
          </span>
          <span className="text-sm text-[var(--text-dim)]">
            {notAllowed ? "Access restricted" : "Sign-in failed"}
          </span>
        </div>

        <p className="text-center text-sm text-[var(--text-secondary)]">
          {notAllowed ? (
            <>
              Google sign-in is limited to approved accounts.
              <br />
              Try the guest mode to explore the app.
            </>
          ) : (
            <>
              Something went wrong while signing you in.
              <br />
              Please try again.
            </>
          )}
        </p>

        <Link
          href="/login"
          className="w-full flex items-center justify-center px-5 py-3 rounded-xl
                     border border-[var(--border)] bg-[var(--bg-elevated)]
                     hover:border-[var(--accent-border)] hover:bg-[var(--accent-10)]
                     text-[var(--text-secondary)] hover:text-[var(--accent-text)]
                     transition-all duration-150 text-sm font-medium"
        >
          Back to login
        </Link>
      </div>
    </div>
  );
}
