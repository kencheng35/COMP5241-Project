import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const pathname = request.nextUrl.pathname;
  const privatePath = pathname === "/" || ["/dashboard", "/profile", "/progress", "/catalog", "/courses", "/studio", "/reports", "/admin", "/api"].some(path => pathname === path || pathname.startsWith(`${path}/`));
  if (!url || !key) return privatePath ? new NextResponse("Authentication is not configured.", { status: 503 }) : response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (items) => {
        items.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data: { user } } = await supabase.auth.getUser();
  if (privatePath && !user) {
    if (pathname.startsWith("/api/")) return NextResponse.json({ error: "Authentication required." }, { status: 401 });
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set("message", "Please log in to view your private learning space.");
    const denied = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach(cookie => denied.cookies.set(cookie));
    return denied;
  }

  return response;
}