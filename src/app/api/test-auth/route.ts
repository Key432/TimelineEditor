import { NextResponse } from "next/server";
import { z } from "zod";

import { isTestAuthEnabled } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

const credentialsSchema = z.object({
  email: z.email(),
  password: z.string().min(8),
});

export async function POST(request: Request) {
  const configuredSecret = process.env.E2E_TEST_AUTH_SECRET;
  const suppliedSecret = request.headers.get("x-test-auth-secret");

  if (
    !isTestAuthEnabled() ||
    !configuredSecret ||
    suppliedSecret !== configuredSecret
  ) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const parsed = credentialsSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid input" }, { status: 400 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 401 },
    );
  }

  return new NextResponse(null, { status: 204 });
}
