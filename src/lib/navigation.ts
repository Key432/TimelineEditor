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
