import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

const allowedDestinations = new Set(["/dashboard", "/update-password"]);

function safeDestination(requested: string) {
  return allowedDestinations.has(requested) ? requested : "/dashboard";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  const destination = safeDestination(url.searchParams.get("next") ?? "/dashboard");

  if (!tokenHash || type !== "recovery") {
    return NextResponse.redirect(new URL("/login?error=invalid_callback", url.origin));
  }

  const supabase = await createServerSupabaseClient();
  const { error } = await supabase.auth.verifyOtp({
    token_hash: tokenHash,
    type: "recovery",
  });

  if (error) {
    return NextResponse.redirect(new URL("/login?error=invalid_or_expired_recovery", url.origin));
  }

  return NextResponse.redirect(new URL(destination, url.origin));
}
