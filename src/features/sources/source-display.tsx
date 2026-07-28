import { ChevronDown } from "lucide-react";

import type { SourceCitation } from "@/features/sources/types";

function safeExternalUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function LinkedText({ value }: { value: string | null }) {
  if (!value) return null;
  return (
    <p className="whitespace-pre-wrap">
      {value.split(/(https?:\/\/[^\s]+)/g).map((part, index) => {
        if (!part.startsWith("http://") && !part.startsWith("https://"))
          return part;
        try {
          const url = new URL(part);
          return (
            <a
              key={`${url.href}-${index}`}
              className="text-primary underline underline-offset-4"
              href={url.href}
              rel="noreferrer noopener"
              target="_blank"
            >
              {part}
            </a>
          );
        } catch {
          return part;
        }
      })}
    </p>
  );
}

export function SourceDisplay({
  projectId,
  sourceText,
  citations = [],
  readOnly = false,
}: {
  projectId: string;
  sourceText: string | null;
  citations?: SourceCitation[];
  readOnly?: boolean;
}) {
  if (!sourceText && !citations.length) {
    return <p className="text-muted-foreground">—</p>;
  }
  return (
    <div className="space-y-4">
      <LinkedText value={sourceText} />
      {citations.length ? (
        <ol className="list-decimal space-y-3 pl-5">
          {citations.map((citation) => (
            <li key={citation.sourceId} id={`source-${citation.sourceId}`}>
              <details className="group rounded-lg border px-3 py-2">
                <summary className="flex cursor-pointer list-none items-start justify-between gap-3 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                  <span>
                    <span className="font-medium">{citation.source.title}</span>
                    {citation.source.authors.length
                      ? ` — ${citation.source.authors.join("、")}`
                      : ""}
                    {citation.source.publicationYear !== null
                      ? ` (${citation.source.publicationYear})`
                      : ""}
                  </span>
                  <span className="mt-1 shrink-0 transition-transform group-open:rotate-180">
                    <ChevronDown aria-hidden="true" className="size-4" />
                  </span>
                </summary>
                <div className="mt-3 space-y-3 border-t pt-3 text-sm">
                  <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[7rem_1fr]">
                    {citation.source.publisher ? (
                      <>
                        <dt className="text-muted-foreground">出版社</dt>
                        <dd>{citation.source.publisher}</dd>
                      </>
                    ) : null}
                    {citation.source.isbn ? (
                      <>
                        <dt className="text-muted-foreground">ISBN</dt>
                        <dd>{citation.source.isbn}</dd>
                      </>
                    ) : null}
                    {citation.source.accessedOn ? (
                      <>
                        <dt className="text-muted-foreground">参照日</dt>
                        <dd>{citation.source.accessedOn}</dd>
                      </>
                    ) : null}
                    {citation.source.citationKey ? (
                      <>
                        <dt className="text-muted-foreground">引用キー</dt>
                        <dd>{citation.source.citationKey}</dd>
                      </>
                    ) : null}
                    {citation.chapter ? (
                      <>
                        <dt className="text-muted-foreground">章</dt>
                        <dd>{citation.chapter}</dd>
                      </>
                    ) : null}
                    {citation.pages ? (
                      <>
                        <dt className="text-muted-foreground">ページ</dt>
                        <dd>{citation.pages}</dd>
                      </>
                    ) : null}
                    {citation.source.notes ? (
                      <>
                        <dt className="text-muted-foreground">資料注記</dt>
                        <dd className="whitespace-pre-wrap">
                          {citation.source.notes}
                        </dd>
                      </>
                    ) : null}
                    {citation.notes ? (
                      <>
                        <dt className="text-muted-foreground">引用注記</dt>
                        <dd className="whitespace-pre-wrap">
                          {citation.notes}
                        </dd>
                      </>
                    ) : null}
                  </dl>
                  {citation.quote ? (
                    <blockquote className="border-l-2 pl-3">
                      {citation.quote}
                    </blockquote>
                  ) : null}
                  <div className="flex flex-wrap gap-x-3 gap-y-1">
                    {safeExternalUrl(citation.source.url) ? (
                      <a
                        className="text-primary underline underline-offset-4"
                        href={safeExternalUrl(citation.source.url)!}
                        rel="noreferrer noopener"
                        target="_blank"
                      >
                        資料URLを開く
                      </a>
                    ) : null}
                    {!readOnly ? (
                      <a
                        className="text-primary underline underline-offset-4"
                        href={`/projects/${projectId}/sources#source-${citation.sourceId}`}
                      >
                        資料マスタで確認
                      </a>
                    ) : null}
                  </div>
                </div>
              </details>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
