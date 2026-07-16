"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabasePublicConfig } from "./config";

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createBrowserSupabaseClient(config: SupabasePublicConfig) {
  if (!browserClient) {
    const { url, publishableKey } = config;
    browserClient = createBrowserClient(url, publishableKey);
  }

  return browserClient;
}
