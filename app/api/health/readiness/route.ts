import { NextResponse } from "next/server";
import { getSupabasePublicConfig } from "@/src/lib/supabase/config";

export const dynamic = "force-dynamic";

export async function GET() {
  const headers = { "Cache-Control": "no-store" };
  try {
    const { url, publishableKey } = getSupabasePublicConfig();
    const response = await fetch(`${url}/rest/v1/rpc/system_health`, {
      method: "POST",
      headers: { apikey: publishableKey, Authorization: `Bearer ${publishableKey}`, "Content-Type": "application/json" },
      body: "{}",
      cache: "no-store",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok || await response.json() !== true) throw new Error("readiness_failed");
    return NextResponse.json({ status: "ready" }, { status: 200, headers });
  } catch {
    return NextResponse.json({ status: "degraded" }, { status: 503, headers });
  }
}
