import Link from "next/link";

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
              <p>
                <span className="font-medium">{citation.source.title}</span>
                {citation.source.authors.length
                  ? ` — ${citation.source.authors.join("、")}`
                  : ""}
                {citation.source.publicationYear !== null
                  ? ` (${citation.source.publicationYear})`
                  : ""}
              </p>
              {[citation.chapter, citation.pages && `p. ${citation.pages}`]
                .filter(Boolean)
                .join(" · ") ? (
                <p className="text-sm text-muted-foreground">
                  {[citation.chapter, citation.pages && `p. ${citation.pages}`]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              ) : null}
              {citation.quote ? (
                <blockquote className="mt-2 border-l-2 pl-3 text-sm">
                  {citation.quote}
                </blockquote>
              ) : null}
              {safeExternalUrl(citation.source.url) ? (
                <a
                  className="text-sm text-primary underline underline-offset-4"
                  href={safeExternalUrl(citation.source.url)!}
                  rel="noreferrer noopener"
                  target="_blank"
                >
                  資料URLを開く
                </a>
              ) : null}
              {!readOnly ? (
                <Link
                  className="ml-3 text-sm text-primary underline underline-offset-4"
                  href={`/projects/${projectId}/sources#source-${citation.sourceId}`}
                >
                  資料マスタで確認
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}
