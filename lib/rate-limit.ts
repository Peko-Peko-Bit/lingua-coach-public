/**
 * lib/rate-limit.ts
 *
 * Per-user rate limiting for cost-bearing AI routes, backed by the
 * check_rate_limit() SQL function (supabase/migrations/20260710000000_rate_limits.sql).
 * Works on both node and edge runtimes.
 */

import { createClient } from "@supabase/supabase-js";

export type RateLimitBucket = "chat" | "translate" | "word-normalize" | "word-translate";

const WINDOW_SECONDS = 3600;

// Requests allowed per user per window
const LIMITS: Record<RateLimitBucket, number> = {
  chat: 60, // most expensive: chat + grammar check = 2 AI calls
  translate: 120,
  "word-normalize": 120,
  "word-translate": 120,
};

export interface RateLimitResult {
  allowed: boolean;
  retryAfter: number; // seconds until the current window resets
}

export async function checkRateLimit(
  userId: string,
  bucket: RateLimitBucket
): Promise<RateLimitResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  // Fail open: a broken rate limiter must not take down the app itself.
  // Deliberately NOT using lib/supabase-server.ts — its anon-key fallback
  // would make the RPC fail silently under RLS.
  if (!url || !serviceKey) {
    console.error("[rate-limit] SUPABASE_SERVICE_ROLE_KEY not set; rate limiting disabled");
    return { allowed: true, retryAfter: 0 };
  }

  const supabase = createClient(url, serviceKey);
  const { data, error } = await supabase.rpc("check_rate_limit", {
    p_user_id: userId,
    p_bucket: bucket,
    p_limit: LIMITS[bucket],
    p_window_seconds: WINDOW_SECONDS,
  });

  if (error) {
    console.error("[rate-limit] check_rate_limit RPC failed:", error.message);
    return { allowed: true, retryAfter: 0 };
  }

  return {
    allowed: data.allowed === true,
    retryAfter: typeof data.retry_after === "number" ? data.retry_after : 0,
  };
}

export function rateLimitResponse(retryAfter: number): Response {
  return new Response(
    JSON.stringify({
      error: "Too many requests",
      message: "リクエストが多すぎます。しばらく待ってから再度お試しください。",
    }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": String(retryAfter),
      },
    }
  );
}
