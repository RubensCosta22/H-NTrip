import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/src/lib/supabase/server";

const allowedDestinations = new Set(["/dashboard", "/update-password"]);

function safeDestination(requested: string) {
  if (allowedDestinations.has(requested)) return requested;
  const match = requested.match(/^\/accept-invite\/complete\?token=([a-f0-9]{64})$/);
  return match ? requested : "/dashboard";
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requestedDestination = url.searchParams.get("next") ?? "/dashboard";
  const destination = safeDestination(requestedDestination);

  if (code) {
    const supabase = await createServerSupabaseClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(destination, url.origin));
  }

  return NextResponse.redirect(new URL("/login?error=invalid_callback", url.origin));
}
