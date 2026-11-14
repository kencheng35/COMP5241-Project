import { createClient } from "@/lib/supabase/server";
import { database } from "@/lib/learning-server";

export async function GET() {
  const supabase = await createClient();
  const authentication = await supabase.auth.getUser();
  const user = authentication.data.user;
  if (authentication.error || !user) return Response.json({ avatar: null });
  const { data } = await database().from("profiles").select("avatar_url").eq("id", user.id).maybeSingle();
  const avatar = typeof data?.avatar_url === "string" && data.avatar_url.startsWith("data:image/") ? data.avatar_url : null;
  return Response.json({ avatar });
}
