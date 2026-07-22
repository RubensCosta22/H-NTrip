const missingConfigMessage =
  "Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY.";

const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

function validateSupabaseUrl(rawUrl: string) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must be an absolute URL.");
  }

  const isLocal = localHosts.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal && process.env.NODE_ENV !== "production")) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL must use HTTPS outside local development.");
  }

  return url.origin;
}

function assertPublicSupabaseKey(key: string) {
  if (key.startsWith("sb_secret_")) {
    throw new Error("A Supabase secret key must never be exposed through NEXT_PUBLIC_* variables.");
  }

  const jwtPayload = key.split(".")[1];
  if (!jwtPayload) return;

  try {
    const normalized = jwtPayload.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = JSON.parse(Buffer.from(normalized, "base64").toString("utf8")) as { role?: string };
    if (decoded.role === "service_role") {
      throw new Error("A Supabase service-role key must never be exposed through NEXT_PUBLIC_* variables.");
    }
  } catch (error) {
    if (error instanceof Error && error.message.includes("must never be exposed")) throw error;
  }
}

export function getSupabasePublicConfig() {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const publishableKey = (
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  )?.trim();

  if (!rawUrl || !publishableKey) {
    throw new Error(missingConfigMessage);
  }

  assertPublicSupabaseKey(publishableKey);
  return { url: validateSupabaseUrl(rawUrl), publishableKey };
}

export type SupabasePublicConfig = ReturnType<typeof getSupabasePublicConfig>;

export function isSupabaseConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
      (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
  );
}
