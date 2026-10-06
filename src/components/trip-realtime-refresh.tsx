"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createBrowserSupabaseClient } from "@/src/lib/supabase/client";
import type { SupabasePublicConfig } from "@/src/lib/supabase/config";

const allowedTables = new Set([
  "expenses",
  "expense_categories",
  "checklists",
  "checklist_items",
]);

type TripRealtimeRefreshProps = {
  tripId: string;
  tables: string[];
  supabaseConfig: SupabasePublicConfig;
};

export function TripRealtimeRefresh({ tripId, tables, supabaseConfig }: TripRealtimeRefreshProps) {
  const router = useRouter();
  const tableKey = tables.join(",");

  useEffect(() => {
    const selectedTables = tableKey.split(",").filter((table) => allowedTables.has(table));
    if (!tripId || !selectedTables.length) return;

    const supabase = createBrowserSupabaseClient(supabaseConfig);
    let refreshTimer: ReturnType<typeof setTimeout> | undefined;
    const scheduleRefresh = () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => router.refresh(), 350);
    };
    let channel = supabase.channel(`trip:${tripId}:${selectedTables.join("-")}`);

    for (const table of selectedTables) {
      channel = channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table, filter: `trip_id=eq.${tripId}` },
        scheduleRefresh,
      );
    }
    channel.subscribe();

    // Reconcile once when the user returns to the tab instead of forcing a
    // complete Server Component refresh every few seconds while they use it.
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") scheduleRefresh();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      void supabase.removeChannel(channel);
    };
  }, [router, supabaseConfig, tableKey, tripId]);

  return null;
}
