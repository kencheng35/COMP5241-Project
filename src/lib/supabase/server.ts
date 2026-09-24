import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicConfig } from "../public-config";

export async function createClient() {
  const cookieStore = await cookies();
  const settings = publicConfig(process.env);

  if (!settings) {
    throw new Error("Learning service configuration is unavailable. Check the public Supabase URL, anon key and site origin.");
  }

  return createServerClient(settings.supabaseUrl, settings.anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (items) => {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // Server Components cannot write cookies; middleware refreshes the session.
        }
      },
    },
  });
}