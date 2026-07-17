import { NextResponse } from "next/server";
import { createAuthServerClient } from "@/lib/supabase-auth-server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  const authClient = await createAuthServerClient();
  const { data: { user } } = await authClient.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (user.app_metadata?.provider !== "anonymous") {
    return NextResponse.json({ message: "Not a guest user" }, { status: 200 });
  }

  const { data: existing } = await supabase
    .from("threads")
    .select("id")
    .eq("user_id", user.id)
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ message: "Already seeded" }, { status: 200 });
  }

  // TODO: add sample data seeding logic here

  return NextResponse.json({ message: "Seeded" }, { status: 200 });
}
