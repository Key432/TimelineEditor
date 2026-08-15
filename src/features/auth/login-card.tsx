import { CircleAlert, LockKeyhole } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { signInWithGoogle } from "@/features/auth/actions";

type LoginCardProps = {
  errorMessage?: string;
  loginAction?: () => Promise<void>;
};

export function LoginCard({
  errorMessage,
  loginAction = signInWithGoogle,
}: LoginCardProps) {
  return (
    <Card className="w-full max-w-md shadow-sm">
      <CardHeader className="space-y-3">
        <div className="flex size-11 items-center justify-center rounded-lg bg-brand-primary-soft text-brand-primary-active">
          <LockKeyhole aria-hidden="true" className="size-5" />
        </div>
        <div className="space-y-1">
          <CardTitle className="text-2xl">ログイン</CardTitle>
          <CardDescription>
            GoogleアカウントでChronology Studioを利用します。
          </CardDescription>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {errorMessage ? (
          <div
            className="flex gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive"
            role="alert"
          >
            <CircleAlert
              aria-hidden="true"
              className="mt-0.5 size-4 shrink-0"
            />
            <span>{errorMessage}</span>
          </div>
        ) : null}
        <form action={loginAction}>
          <Button
            className="w-full bg-primary hover:bg-brand-primary-hover active:bg-brand-primary-active"
            type="submit"
          >
            <span
              aria-hidden="true"
              className="flex size-5 items-center justify-center rounded-sm bg-white text-xs font-bold text-[#4285f4]"
            >
              G
            </span>
            Googleでログイン
          </Button>
        </form>
        <Button asChild className="w-full" variant="outline">
          <Link href="/">ログインせず年表を編集</Link>
        </Button>
        <p className="text-xs leading-5 text-muted-foreground">
          ログインすると、非公開プロジェクトは認証とデータベースの権限制御によって保護されます。
        </p>
      </CardContent>
    </Card>
  );
}
