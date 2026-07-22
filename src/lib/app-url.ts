const localHosts = new Set(["localhost", "127.0.0.1", "[::1]"]);

export function getAppUrl() {
  const configured = process.env.APP_URL?.trim();

  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("APP_URL is required in production.");
    }
    return "http://localhost:3000";
  }

  let url: URL;
  try {
    url = new URL(configured);
  } catch {
    throw new Error("APP_URL must be an absolute URL.");
  }

  if (url.username || url.password || url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) {
    throw new Error("APP_URL must contain only scheme and host.");
  }

  const isLocal = localHosts.has(url.hostname);
  if (url.protocol !== "https:" && !(url.protocol === "http:" && isLocal && process.env.NODE_ENV !== "production")) {
    throw new Error("APP_URL must use HTTPS outside local development.");
  }

  return url.origin;
}
