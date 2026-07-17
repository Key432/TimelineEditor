"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";

import {
  buildOAuthCallbackUrl,
  resolveOAuthOrigin,
} from "@/features/auth/origin";
import { getPublicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export async function signInWithGoogle() {
  const supabase = await createClient();
  const env = getPublicEnv();
  const requestHeaders = await headers();
  const appOrigin = resolveOAuthOrigin({
    configuredAppUrl: env.NEXT_PUBLIC_APP_URL,
    nodeEnv: process.env.NODE_ENV,
    requestHost:
      requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host"),
    requestOrigin: requestHeaders.get("origin"),
  });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: buildOAuthCallbackUrl(appOrigin),
    },
  });

  if (error || !data.url) {
    redirect("/login?error=oauth");
  }

  redirect(data.url);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
