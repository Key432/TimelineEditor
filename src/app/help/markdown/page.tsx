import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Markdown記法",
  description: "Chronology Studioの本文で利用できるMarkdown記法の一覧です。",
};

const examples = [
  {
    title: "見出し",
    description: "行頭の # の数で見出しの大きさを指定します。",
    code: "# 見出し1\n## 見出し2\n### 見出し3",
  },
  {
    title: "強調と打ち消し線",
    description: "太字、斜体、打ち消し線を利用できます。",
    code: "**太字**\n*斜体*\n~~打ち消し線~~",
  },
  {
    title: "リスト",
    description: "箇条書きと番号付きリストを利用できます。",
    code: "- 項目1\n- 項目2\n\n1. 最初\n2. 次",
  },
  {
    title: "引用と水平線",
    description: "引用は >、水平線は --- を使います。",
    code: "> 引用文\n\n---",
  },
  {
    title: "コード",
    description: "短いコードは `、複数行のコードは ``` で囲みます。",
    code: "`year = 1867`\n\n```ts\nconst year = 1867;\n```",
  },
  {
    title: "外部リンク",
    description: "リンク先には http または https のURLを指定します。",
    code: "[資料名](https://example.com/source)",
  },
  {
    title: "表",
    description: "見出し行の下に区切り行を置きます。",
    code: "| 名前 | 年 |\n| --- | ---: |\n| 夏目漱石 | 1867 |",
  },
] as const;

const callouts = ["NOTE", "TIP", "IMPORTANT", "WARNING", "CAUTION"] as const;

export default function MarkdownHelpPage() {
  return (
    <article className="space-y-10">
      <div className="space-y-4">
        <Link
          className="text-sm text-primary underline underline-offset-4"
          href="/help"
        >
          ヘルプ一覧へ戻る
        </Link>
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight">
            Markdown記法
          </h1>
          <p className="text-muted-foreground">
            タイムラインアイテムとイベントアイテムの本文で利用できる記法です。
          </p>
        </div>
      </div>

      <div className="space-y-8">
        {examples.map((example) => (
          <section className="space-y-3" key={example.title}>
            <div className="space-y-1">
              <h2 className="text-xl font-semibold">{example.title}</h2>
              <p className="text-sm text-muted-foreground">
                {example.description}
              </p>
            </div>
            <pre className="overflow-x-auto rounded-lg bg-foreground p-4 text-sm text-background">
              <code>{example.code}</code>
            </pre>
          </section>
        ))}

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">プロジェクト内リンク</h2>
            <p className="text-sm text-muted-foreground">
              本文で [[
              に続けて名称または別名を入力し、同じプロジェクト内の候補から選択します。
            </p>
            <p className="text-sm text-muted-foreground">
              候補には種類、日付、親アイテムが表示されます。
            </p>
            <p className="text-sm text-muted-foreground">
              選択すると安定したIDを含む記法が挿入されるため、参照先の名称や別名を変更してもリンクは維持されます。削除された参照先はリンク切れとして表示されます。
            </p>
          </div>
          <pre className="overflow-x-auto rounded-lg bg-foreground p-4 text-sm text-background">
            <code>[[夏目漱石]]</code>
          </pre>
        </section>

        <section className="space-y-3">
          <div className="space-y-1">
            <h2 className="text-xl font-semibold">コールアウト</h2>
            <p className="text-sm text-muted-foreground">
              引用の先頭へ種類を指定すると、注記や警告として表示されます。
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {callouts.map((callout) => (
              <pre
                className="overflow-x-auto rounded-lg bg-foreground p-4 text-sm text-background"
                key={callout}
              >
                <code>{`> [!${callout}]\n> 内容を入力`}</code>
              </pre>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-xl font-semibold">画像・HTML・埋め込み</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            Markdown画像、raw
            HTML、script、style、iframe、video、audio、SVG、ファイル添付は表示されません。JavaScript
            URLとdata URLも利用できません。
          </p>
        </section>
      </div>
    </article>
  );
}
