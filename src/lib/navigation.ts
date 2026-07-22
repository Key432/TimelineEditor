export function safeRelativePath(
  candidate: string | null | undefined,
  fallback = "/projects",
) {
  if (
    !candidate ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return fallback;
  }

  return candidate;
}

export function safeSearchReturnPath(candidate: string | null | undefined) {
  const safe = safeRelativePath(candidate, "");
  return safe === "/search" || safe.startsWith("/search?") ? safe : null;
}

export function withSearchReturn(detailPath: string, returnTo: string) {
  const separator = detailPath.includes("?") ? "&" : "?";
  return `${detailPath}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}
