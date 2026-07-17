import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const response = NextResponse.next({ request });
  const domain = process.env.NEXT_PUBLIC_COOKIE_DOMAIN;

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            request.cookies.set(name, value);
            response.cookies.set(name, value, { ...options, domain });
          });
        },
      },
    }
  );

  // Refreshes the session if the access token is expired.
  const { data: { user } } = await supabase.auth.getUser();

  // Public paths: skip auth check
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    // If already logged in and visiting /login, redirect to home
    if (pathname.startsWith("/login") && user) {
      return NextResponse.redirect(new URL("/", request.url));
    }
    return response;
  }

  // Unauthenticated: API routes get 401 JSON (fetch clients can't handle HTML redirects),
  // pages redirect to /login
  if (!user) {
    if (pathname.startsWith("/api")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
