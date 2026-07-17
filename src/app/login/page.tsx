import { redirect } from "next/navigation";

import { LoginCard } from "@/features/auth/login-card";
import { createClient } from "@/lib/supabase/server";

type LoginPageProps = {
  searchParams: Promise<{ error?: string }>;
};

const errorMessages: Record<string, string> = {
  callback: "認証を完了できませんでした。もう一度お試しください。",
  oauth: "Googleログインを開始できませんでした。設定をご確認ください。",
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims?.sub) {
    redirect("/projects");
  }

  const { error } = await searchParams;

  return (
    <main className="grid min-h-svh place-items-center px-4 py-12">
      <div className="flex w-full flex-col items-center gap-6">
        <div className="flex items-center gap-3" aria-label="Chronology Studio">
          <div className="size-3 bg-primary" />
          <span className="text-lg font-semibold tracking-tight">
            Chronology Studio
          </span>
        </div>
        <LoginCard errorMessage={error ? errorMessages[error] : undefined} />
      </div>
    </main>
  );
}
