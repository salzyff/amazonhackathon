import { NextResponse } from "next/server";
import { serverClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const requested = url.searchParams.get("next") ?? "/";
  const next =
    requested.startsWith("/") && !requested.startsWith("//") && !requested.includes("\\")
      ? requested
      : "/";
  if (code) {
    const { error } = await (await serverClient()).auth.exchangeCodeForSession(code);
    if (!error) {
      const r = NextResponse.redirect(new URL(next, url.origin));
      r.headers.set("Cache-Control", "private, no-store");
      return r;
    }
  }
  const r = NextResponse.redirect(new URL("/login?error=confirmation", url.origin));
  r.headers.set("Cache-Control", "private, no-store");
  return r;
}
