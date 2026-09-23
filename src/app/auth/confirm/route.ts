import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { safeDestination } from "@/lib/learning";

const verificationType = z.enum(["signup", "invite", "magiclink", "recovery", "email_change", "email"]);

function redirectTo(request: NextRequest, path: string) {
  const response = NextResponse.redirect(new URL(path, request.url));
  response.headers.set("Cache-Control", "private, no-store");
  response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = verificationType.safeParse(request.nextUrl.searchParams.get("type"));
  const requestedNext = request.nextUrl.searchParams.get("next");
  const next = safeDestination(requestedNext, request.nextUrl.origin);
  const invalid = "/login?error=Verification%20link%20is%20invalid%20or%20expired.";
  if ((code && tokenHash) || (!code && (!tokenHash || !type.success))) return redirectTo(request, invalid);
  try {
    const supabase = await createClient();
    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return redirectTo(request, next);
    } else if (tokenHash && type.success) {
      const { error } = await supabase.auth.verifyOtp({ type: type.data, token_hash: tokenHash });
      if (!error) return redirectTo(request, next);
    }
  } catch {
    return redirectTo(request, "/login?error=Verification%20is%20temporarily%20unavailable.%20Please%20try%20again.");
  }
  return redirectTo(request, invalid);
}