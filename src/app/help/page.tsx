import type { Metadata } from "next";
import Link from "next/link";

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { HELP_TOPICS } from "@/features/help/help-topics";

export const metadata: Metadata = {
  title: "ヘルプ",
  description: "Chronology Studioの使い方を確認できます。",
};

export default function HelpPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight">ヘルプ</h1>
        <p className="text-muted-foreground">
          Chronology Studioの機能と使い方を確認できます。
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {HELP_TOPICS.map((topic) => (
          <Link
            key={topic.slug}
            className="rounded-xl focus-visible:outline-offset-4"
            href={`/help/${topic.slug}`}
          >
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardHeader>
                <CardTitle>{topic.title}</CardTitle>
                <CardDescription>{topic.summary}</CardDescription>
              </CardHeader>
              <CardContent className="text-sm font-medium text-primary">
                ヘルプを開く
              </CardContent>
            </Card>
          </Link>
        ))}
        <Link
          className="rounded-xl focus-visible:outline-offset-4"
          href="/help/markdown"
        >
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader>
              <CardTitle>Markdown記法</CardTitle>
              <CardDescription>
                本文で利用できる見出し、強調、表、コールアウトなどの書き方
              </CardDescription>
            </CardHeader>
            <CardContent className="text-sm font-medium text-primary">
              ヘルプを開く
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
