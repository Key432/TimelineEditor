import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { HELP_TOPICS, findHelpTopic } from "@/features/help/help-topics";

export const dynamic = "force-static";
export const dynamicParams = false;

type HelpTopicPageProps = {
  params: Promise<{ slug: string }>;
};

export function generateStaticParams() {
  return HELP_TOPICS.map((topic) => ({ slug: topic.slug }));
}

export async function generateMetadata({
  params,
}: HelpTopicPageProps): Promise<Metadata> {
  const topic = findHelpTopic((await params).slug);
  return topic
    ? { title: `${topic.title} | ヘルプ`, description: topic.summary }
    : { title: "ヘルプ" };
}

export default async function HelpTopicPage({ params }: HelpTopicPageProps) {
  const topic = findHelpTopic((await params).slug);
  if (!topic) notFound();

  return (
    <article className="space-y-8">
      <header className="space-y-3 border-b pb-6">
        <p className="text-sm font-medium text-primary">機能別ヘルプ</p>
        <h1 className="text-3xl font-semibold tracking-tight">{topic.title}</h1>
        <p className="text-muted-foreground">{topic.summary}</p>
      </header>

      {topic.sections.map((section) => (
        <section key={section.heading} className="space-y-3">
          <h2 className="text-xl font-semibold">{section.heading}</h2>
          {section.paragraphs.map((paragraph) => (
            <p key={paragraph} className="leading-7 text-foreground/90">
              {paragraph}
            </p>
          ))}
        </section>
      ))}

      <Link
        className="inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
        href="/help"
      >
        ヘルプ一覧へ戻る
      </Link>
    </article>
  );
}
