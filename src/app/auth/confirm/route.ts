import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeDestination } from "@/lib/learning";
import { publicConfig } from "@/lib/public-config";

const verificationType = z.enum(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

function redirectTo(origin: string, path: string) {
  const response = NextResponse.redirect(new URL(path, origin));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const origin = publicConfig(process.env)?.siteOrigin;
  if (!origin) return new NextResponse("Learning service is unavailable.", { status: 503, headers: { "Cache-Control": "no-store" } });
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = verificationType.safeParse(request.nextUrl.searchParams.get("type"));
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = safeDestination(requestedNext, origin);
  const invalid = "/login?error=Verification%20link%20is%20invalid%20or%20expired.";
  if ((code && tokenHash) || (!code && (!tokenHash || !type.success))) return redirectTo(origin, invalid);
  try {
    const supabase = await createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return redirectTo(origin, next);
    } else if (tokenHash && type.success) {
      const { error } = await supabase.auth.verifyOtp({ type: type.data, token_hash: tokenHash });
      if (!error) return redirectTo(origin, next);
    }
  } catch {
    return redirectTo(origin, "/login?error=Verification%20is%20temporarily%20unavailable.%20Please%20try%20again.");
  }
  return redirectTo(origin, invalid);
}