import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getPublicEnv } from "@/lib/env";

const robotsValue = "noindex, nofollow, noarchive, nosnippet, noimageindex";

function withNoIndex(response: NextResponse) {
  response.headers.set("X-Robots-Tag", robotsValue);
  return response;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = withNoIndex(NextResponse.next({ request }));
  const env = getPublicEnv();

  const supabase = createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          supabaseResponse = withNoIndex(NextResponse.next({ request }));
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options);
          });
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();

  return {
    claims: data?.claims,
    response: supabaseResponse,
  };
}
