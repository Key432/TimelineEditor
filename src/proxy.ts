import { NextResponse, type NextRequest } from "next/server";

import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { claims, response, supabase } = await updateSession(request);
  const isAuthenticated = Boolean(claims?.sub);
  const isProtected = request.nextUrl.pathname.startsWith("/projects");

  const publicId = request.nextUrl.pathname.match(
    /^\/public\/([a-f0-9]{32})(?:\/|$)/,
  )?.[1];
  if (publicId) {
    const { data, error } = await supabase
      .from("projects")
      .select("id")
      .eq("public_id", publicId)
      .eq("visibility", "public")
      .maybeSingle();
    if (error || !data) {
      return new NextResponse("Not Found", {
        status: 404,
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "X-Robots-Tag":
            "noindex, nofollow, noarchive, nosnippet, noimageindex",
        },
      });
    }
  }

  if (isProtected && !isAuthenticated) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = "";
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    const redirectResponse = NextResponse.redirect(loginUrl);
    redirectResponse.headers.set(
      "X-Robots-Tag",
      "noindex, nofollow, noarchive, nosnippet, noimageindex",
    );
    return redirectResponse;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
