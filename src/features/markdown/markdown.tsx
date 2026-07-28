"use client";

import Link from "next/link";
import {
  cloneElement,
  isValidElement,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { UseFormRegisterReturn } from "react-hook-form";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  getInternalLinkCandidates,
  resolveInternalLinks,
} from "@/features/internal-links/api";
import {
  extractInternalLinkReferences,
  internalLinkToken,
  renderInternalLinks,
} from "@/features/internal-links/markdown";
import type { InternalLinkCandidate } from "@/features/internal-links/types";
import type { SourceCitation } from "@/features/sources/types";
import { cn } from "@/lib/utils";

const ALLOWED_ELEMENTS = [
  "a",
  "blockquote",
  "br",
  "code",
  "del",
  "em",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "hr",
  "li",
  "ol",
  "p",
  "pre",
  "strong",
  "table",
  "tbody",
  "td",
  "th",
  "thead",
  "tr",
  "ul",
] as const;

const SANITIZE_SCHEMA = {
  ...defaultSchema,
  tagNames: [...ALLOWED_ELEMENTS],
  attributes: {
    a: ["href"],
  },
  protocols: {
    href: ["http", "https"],
  },
};

const CALLOUT_LABELS = {
  NOTE: "注記",
  TIP: "ヒント",
  IMPORTANT: "重要",
  WARNING: "警告",
  CAUTION: "注意",
} as const;

type CalloutType = keyof typeof CALLOUT_LABELS;

function textContent(node: ReactNode): string {
  if (typeof node === "string" || typeof node === "number") {
    return String(node);
  }
  if (Array.isArray(node)) return node.map(textContent).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return textContent(node.props.children);
  }
  return "";
}

function stripCalloutMarker(node: ReactNode): ReactNode {
  let removed = false;
  function visit(candidate: ReactNode): ReactNode {
    if (typeof candidate === "string") {
      if (removed) return candidate;
      const next = candidate.replace(
        /^\s*\[!(?:NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]\s*/i,
        "",
      );
      if (next !== candidate) removed = true;
      return next;
    }
    if (Array.isArray(candidate)) return candidate.map(visit);
    if (isValidElement<{ children?: ReactNode }>(candidate)) {
      return cloneElement(
        candidate,
        undefined,
        visit(candidate.props.children),
      );
    }
    return candidate;
  }
  return visit(node);
}

function safeExternalUrl(href: string | undefined) {
  if (!href) return null;
  try {
    const url = new URL(href);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.href
      : null;
  } catch {
    return null;
  }
}

const COMPONENTS: Components = {
  a({ children, href }) {
    if (href?.startsWith("#")) {
      return (
        <a className="text-primary underline underline-offset-4" href={href}>
          {children}
        </a>
      );
    }
    if (href?.startsWith("/") && !href.startsWith("//")) {
      return (
        <Link className="text-primary underline underline-offset-4" href={href}>
          {children}
        </Link>
      );
    }
    const safeHref = safeExternalUrl(href);
    return safeHref ? (
      <a
        className="text-primary underline underline-offset-4"
        href={safeHref}
        rel="noreferrer noopener"
        target="_blank"
      >
        {children}
      </a>
    ) : (
      <>{children}</>
    );
  },
  blockquote({ children }) {
    const match = textContent(children).match(
      /^\s*\[!(NOTE|TIP|IMPORTANT|WARNING|CAUTION)\]/i,
    );
    if (!match) {
      return (
        <blockquote className="border-l-4 border-border pl-4 text-muted-foreground">
          {children}
        </blockquote>
      );
    }
    const type = match[1]!.toUpperCase() as CalloutType;
    return (
      <aside
        aria-label={CALLOUT_LABELS[type]}
        className={cn(
          "my-4 rounded-md border-l-4 bg-muted/50 px-4 py-3",
          type === "TIP" && "border-l-success",
          type === "WARNING" && "border-l-warning",
          type === "CAUTION" && "border-l-destructive",
          (type === "NOTE" || type === "IMPORTANT") && "border-l-primary",
        )}
        role="note"
      >
        <strong className="mb-1 block text-sm">{CALLOUT_LABELS[type]}</strong>
        <div>{stripCalloutMarker(children)}</div>
      </aside>
    );
  },
  code({ children, className }) {
    return (
      <code
        className={cn(
          "rounded bg-muted px-1 py-0.5 font-mono text-[0.9em]",
          className,
        )}
      >
        {children}
      </code>
    );
  },
  h1: ({ children }) => (
    <h1 className="mt-8 mb-4 text-3xl font-semibold">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="mt-7 mb-3 text-2xl font-semibold">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-6 mb-2 text-xl font-semibold">{children}</h3>
  ),
  h4: ({ children }) => (
    <h4 className="mt-5 mb-2 text-lg font-semibold">{children}</h4>
  ),
  h5: ({ children }) => <h5 className="mt-4 mb-2 font-semibold">{children}</h5>,
  h6: ({ children }) => (
    <h6 className="mt-4 mb-2 text-sm font-semibold">{children}</h6>
  ),
  hr: () => <hr className="my-6 border-border" />,
  li: ({ children }) => <li className="my-1 pl-1">{children}</li>,
  ol: ({ children }) => (
    <ol className="my-4 list-decimal space-y-1 pl-6">{children}</ol>
  ),
  p: ({ children }) => <p className="my-3 whitespace-pre-wrap">{children}</p>,
  pre: ({ children }) => (
    <pre className="my-4 overflow-x-auto rounded-md bg-foreground p-4 text-sm text-background [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  table: ({ children }) => (
    <div className="my-4 overflow-x-auto">
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  ),
  td: ({ children }) => <td className="border px-3 py-2">{children}</td>,
  th: ({ children }) => (
    <th className="border bg-muted px-3 py-2 text-left font-medium">
      {children}
    </th>
  ),
  ul: ({ children }) => (
    <ul className="my-4 list-disc space-y-1 pl-6">{children}</ul>
  ),
};

function safeUrlTransform(url: string) {
  if (url.startsWith("#")) return url;
  if (url.startsWith("/") && !url.startsWith("//")) return url;
  return safeExternalUrl(url) ?? "";
}

export function MarkdownRenderer({
  value,
  emptyLabel = "—",
  className,
  projectId,
  internalLinkBasePath,
  citations = [],
}: {
  value: string | null;
  emptyLabel?: string;
  className?: string;
  projectId?: string;
  internalLinkBasePath?: string;
  citations?: SourceCitation[];
}) {
  const [resolvedLinks, setResolvedLinks] = useState<{
    key: string;
    targets: Awaited<ReturnType<typeof resolveInternalLinks>>;
  }>({ key: "", targets: [] });
  const references = useMemo(
    () => extractInternalLinkReferences(value ?? ""),
    [value],
  );
  const resolutionKey = projectId
    ? `${projectId}|${references.itemIds.join(",")}|${references.eventIds.join(",")}`
    : "";

  useEffect(() => {
    let active = true;
    if (
      !projectId ||
      (!references.itemIds.length && !references.eventIds.length)
    )
      return;
    resolveInternalLinks(projectId, references.itemIds, references.eventIds)
      .then((targets) => {
        if (active) setResolvedLinks({ key: resolutionKey, targets });
      })
      .catch(() => {
        if (active) setResolvedLinks({ key: resolutionKey, targets: [] });
      });
    return () => {
      active = false;
    };
  }, [projectId, references, resolutionKey]);

  if (!value) {
    return <p className="text-muted-foreground">{emptyLabel}</p>;
  }
  const isResolvingInternalLinks =
    Boolean(projectId) &&
    Boolean(references.itemIds.length || references.eventIds.length) &&
    resolvedLinks.key !== resolutionKey;
  if (isResolvingInternalLinks) {
    return (
      <div
        aria-label="本文を読み込み中"
        className={cn("min-h-20 animate-pulse space-y-3 py-2", className)}
        role="status"
      >
        <div aria-hidden="true" className="h-5 w-2/5 rounded bg-muted" />
        <div aria-hidden="true" className="h-4 w-full rounded bg-muted" />
        <div aria-hidden="true" className="h-4 w-3/4 rounded bg-muted" />
      </div>
    );
  }
  const linkedValue =
    projectId && citations.length
      ? citations.reduce((content, citation) => {
          const key = citation.source.citationKey;
          if (!key) return content;
          const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          return content.replace(
            new RegExp(`\\[@${escaped}\\]`, "g"),
            `[${key}](${internalLinkBasePath?.startsWith("/public/") ? "" : `/projects/${projectId}/sources`}#source-${citation.sourceId})`,
          );
        }, value)
      : value;
  return (
    <div className={cn("markdown-body min-w-0", className)}>
      <ReactMarkdown
        allowedElements={[...ALLOWED_ELEMENTS]}
        components={COMPONENTS}
        rehypePlugins={[[rehypeSanitize, SANITIZE_SCHEMA]]}
        remarkPlugins={[remarkGfm]}
        skipHtml
        unwrapDisallowed
        urlTransform={safeUrlTransform}
      >
        {projectId && resolvedLinks.key === resolutionKey
          ? renderInternalLinks(
              linkedValue,
              resolvedLinks.targets,
              internalLinkBasePath ?? `/projects/${projectId}`,
            )
          : linkedValue}
      </ReactMarkdown>
    </div>
  );
}

type EditorMode = "edit" | "preview";

const MARKDOWN_FIELD_CLASS =
  "min-h-64 w-full border-0 bg-transparent px-0 py-2 text-base shadow-none focus-visible:ring-0 md:text-sm dark:bg-transparent";

export function MarkdownEditor({
  id,
  label,
  registration,
  value,
  rows = 10,
  projectId,
}: {
  id: string;
  label: string;
  registration: UseFormRegisterReturn;
  value: string;
  rows?: number;
  projectId?: string;
}) {
  const [mode, setMode] = useState<EditorMode>("edit");
  const deferredValue = useDeferredValue(value);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [candidateQuery, setCandidateQuery] = useState<string | null>(null);
  const [candidateRange, setCandidateRange] = useState<[number, number] | null>(
    null,
  );
  const [candidates, setCandidates] = useState<InternalLinkCandidate[]>([]);
  const [activeCandidate, setActiveCandidate] = useState(0);

  useEffect(() => {
    let active = true;
    if (!projectId || candidateQuery === null) {
      return;
    }
    getInternalLinkCandidates(projectId, candidateQuery)
      .then((next) => {
        if (active) {
          setCandidates(next);
          setActiveCandidate(0);
        }
      })
      .catch(() => {
        if (active) setCandidates([]);
      });
    return () => {
      active = false;
    };
  }, [candidateQuery, projectId]);

  function updateCandidateQuery(nextValue: string, cursor: number) {
    const prefix = nextValue.slice(0, cursor);
    const match = prefix.match(/\[\[([^\]\r\n|:]*)$/);
    if (!match) {
      setCandidateQuery(null);
      setCandidateRange(null);
      setCandidates([]);
      return;
    }
    setCandidateQuery(match[1] ?? "");
    setCandidates([]);
    setCandidateRange([cursor - match[0].length, cursor]);
  }

  function chooseCandidate(candidate: InternalLinkCandidate) {
    if (!candidateRange) return;
    const next = `${value.slice(0, candidateRange[0])}${internalLinkToken(candidate)}${value.slice(candidateRange[1])}`;
    const cursor = candidateRange[0] + internalLinkToken(candidate).length;
    const changeEvent = {
      target: { name: registration.name, value: next },
      type: "change",
    } as unknown as Parameters<typeof registration.onChange>[0];
    void registration.onChange(changeEvent);
    setCandidateQuery(null);
    setCandidateRange(null);
    setCandidates([]);
    requestAnimationFrame(() => {
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id}>{label}</Label>
        <div className="flex flex-wrap items-center gap-1">
          <Button asChild size="sm" variant="link">
            <Link
              href="/help/markdown"
              rel="noreferrer noopener"
              target="_blank"
            >
              Markdown記法ヘルプ
            </Link>
          </Button>
          <div
            aria-label="Markdown表示モード"
            className="flex gap-1"
            role="group"
          >
            {(["edit", "preview"] as const).map((candidate) => (
              <Button
                key={candidate}
                aria-pressed={mode === candidate}
                size="sm"
                type="button"
                variant={mode === candidate ? "secondary" : "ghost"}
                onClick={() => setMode(candidate)}
              >
                {candidate === "edit" ? "編集" : "プレビュー"}
              </Button>
            ))}
          </div>
        </div>
      </div>
      {mode === "edit" ? (
        <Textarea
          {...registration}
          ref={(element) => {
            textareaRef.current = element;
            registration.ref(element);
          }}
          id={id}
          className={cn(MARKDOWN_FIELD_CLASS, "resize-y")}
          placeholder="Markdownで本文を入力…"
          rows={rows}
          value={value}
          onChange={(event) => {
            void registration.onChange(event);
            updateCandidateQuery(
              event.target.value,
              event.target.selectionStart,
            );
          }}
          onKeyDown={(event) => {
            if (candidateQuery === null || !candidates.length) return;
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setActiveCandidate((current) =>
                event.key === "ArrowDown"
                  ? (current + 1) % candidates.length
                  : (current - 1 + candidates.length) % candidates.length,
              );
            } else if (event.key === "Enter") {
              event.preventDefault();
              chooseCandidate(candidates[activeCandidate]!);
            } else if (event.key === "Escape") {
              event.preventDefault();
              setCandidateQuery(null);
              setCandidates([]);
            }
          }}
        />
      ) : (
        <div
          aria-label="Markdownプレビュー"
          className={cn(MARKDOWN_FIELD_CLASS, "overflow-auto")}
          role="region"
        >
          <MarkdownRenderer
            className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
            emptyLabel="入力するとここにプレビューが表示されます。"
            value={deferredValue}
            projectId={projectId}
          />
        </div>
      )}
      {mode === "edit" && candidateQuery !== null && candidates.length ? (
        <div
          aria-label="プロジェクト内リンク候補"
          className="max-h-64 overflow-y-auto rounded-md border bg-popover p-1 shadow-lg"
          role="listbox"
        >
          {candidates.map((candidate, index) => (
            <button
              key={`${candidate.entityType}:${candidate.entityId}`}
              aria-selected={activeCandidate === index}
              className="flex w-full flex-col rounded-sm px-3 py-2 text-left hover:bg-accent aria-selected:bg-accent"
              role="option"
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => chooseCandidate(candidate)}
            >
              <span className="font-medium">{candidate.title}</span>
              <span className="text-xs text-muted-foreground">
                {[
                  candidate.kindLabel,
                  candidate.dateLabel,
                  candidate.parentTitle,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
