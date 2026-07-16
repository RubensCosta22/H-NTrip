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
      refreshTimer = setTimeout(() => router.refresh(), 250);
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

    // Some managed browsers can keep the Realtime socket connected while
    // delaying postgres_changes delivery. A bounded visible-page refresh keeps
    // the shared trip convergent without polling private data in the background.
    const fallbackTimer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 4000);

    return () => {
      if (refreshTimer) clearTimeout(refreshTimer);
      clearInterval(fallbackTimer);
      void supabase.removeChannel(channel);
    };
  }, [router, supabaseConfig, tableKey, tripId]);

  return null;
}
