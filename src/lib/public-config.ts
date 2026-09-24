function endpoint(value: string | undefined) {
  if (!value) return null;
  try {
    const url = new URL(value);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((url.protocol !== "https:" && !(local && url.protocol === "http:")) || url.username || url.password || url.search || url.hash) return null;
    return url;
  } catch {
    return null;
  }
}

export function publicConfig(env: Record<string, string | undefined>) {
  const supabase = endpoint(env.NEXT_PUBLIC_SUPABASE_URL);
  const site = endpoint(env.NEXT_PUBLIC_SITE_URL);
  if (!supabase || !site || !env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() || supabase.pathname !== "/" || site.pathname !== "/") return null;
  return { supabaseUrl: supabase.href, anonKey: env.NEXT_PUBLIC_SUPABASE_ANON_KEY, siteOrigin: site.origin };
}