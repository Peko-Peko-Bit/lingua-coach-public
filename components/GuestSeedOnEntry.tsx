"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useUser } from "@/hooks/useUser";

/**
 * Seeds a guest who arrived without passing through our login page.
 *
 * The usual path already seeds: app/login/page.tsx POSTs /api/guest/seed right
 * after anonymous sign-in. But LinguaGym shares this Supabase project, so a
 * guest created over there arrives here already authenticated — and proxy.ts
 * bounces an authenticated user away from /login, so that POST never happens.
 * They would land on an empty LinguaCoach.
 *
 * LinguaGym solves the same problem in its `/` server component, but that shape
 * does not transfer: this app's `/` is a client component, and LinguaGym's nav
 * links to /, /grammar and /dashboard directly, so there is no single server
 * render to hang it on. Mounting this in the root layout covers all three.
 *
 * It is a no-op for everyone except a guest on their first entry.
 */

/** Survives React's double-invoked effects in development. */
const inFlight = new Set<string>();

const storageKey = (userId: string) => `linguacoach:guest-seed:${userId}`;

export default function GuestSeedOnEntry() {
  const { user } = useUser();
  const pathname = usePathname();

  useEffect(() => {
    // This app has a single layout, so we are mounted on /login too — where the
    // sign-in button is already POSTing the seed itself. Firing here as well
    // races it: both requests pass the "already seeded?" check and the guest
    // gets two of everything. Nothing is lost by staying quiet, because a guest
    // signing in here reaches `/` a moment later and we run there.
    if (pathname?.startsWith("/login")) return;

    if (user?.is_anonymous !== true) return;

    const key = storageKey(user.id);
    // Keyed by user id, not a bare flag: a guest can sign out and back in as a
    // different guest in the same tab.
    if (sessionStorage.getItem(key)) return;
    if (inFlight.has(user.id)) return;
    inFlight.add(user.id);

    // Written BEFORE the request, not after. If the reload below fires, the
    // remounted component must find the key already set — otherwise it seeds,
    // reloads, and loops forever.
    sessionStorage.setItem(key, "1");

    (async () => {
      try {
        const response = await fetch("/api/guest/seed", { method: "POST" });
        const result = (await response.json()) as { seeded?: boolean };

        // Only when rows were actually inserted. Every hook on this page fetched
        // its data on mount, and router.refresh() does not re-run a client
        // fetch, so a full reload is what makes the new rows appear. On the
        // normal login path the seed already happened and this is skipped.
        if (result.seeded === true) window.location.reload();
      } catch (err) {
        // Demo data is a nice-to-have; a working empty account beats an error.
        console.warn("Guest demo data could not be seeded", err);
      } finally {
        inFlight.delete(user.id);
      }
    })();
  }, [user, pathname]);

  return null;
}

/**
 * Lets the login page record that it has already seeded, so this component
 * skips its request on the common path instead of paying a round trip to be
 * told "already seeded".
 */
export function markGuestSeeded(userId: string) {
  try {
    sessionStorage.setItem(storageKey(userId), "1");
  } catch {
    // Private-mode sessionStorage failures just cost one redundant request.
  }
}
