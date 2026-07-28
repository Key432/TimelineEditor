export type DiffLine = {
  kind: "context" | "removed" | "added";
  value: string;
};

const MAX_DIFF_LINES = 300;

export function createLineDiff(before: string, after: string): DiffLine[] {
  const beforeLines = before.split("\n");
  const afterLines = after.split("\n");
  if (beforeLines.length + afterLines.length > MAX_DIFF_LINES) {
    return [
      ...beforeLines.map((value) => ({ kind: "removed" as const, value })),
      ...afterLines.map((value) => ({ kind: "added" as const, value })),
    ];
  }

  const lengths = Array.from({ length: beforeLines.length + 1 }, () =>
    Array<number>(afterLines.length + 1).fill(0),
  );
  for (let left = beforeLines.length - 1; left >= 0; left -= 1) {
    for (let right = afterLines.length - 1; right >= 0; right -= 1) {
      lengths[left]![right] =
        beforeLines[left] === afterLines[right]
          ? 1 + lengths[left + 1]![right + 1]!
          : Math.max(lengths[left + 1]![right]!, lengths[left]![right + 1]!);
    }
  }

  const result: DiffLine[] = [];
  let left = 0;
  let right = 0;
  while (left < beforeLines.length && right < afterLines.length) {
    if (beforeLines[left] === afterLines[right]) {
      result.push({ kind: "context", value: beforeLines[left]! });
      left += 1;
      right += 1;
    } else if (lengths[left + 1]![right]! >= lengths[left]![right + 1]!) {
      result.push({ kind: "removed", value: beforeLines[left]! });
      left += 1;
    } else {
      result.push({ kind: "added", value: afterLines[right]! });
      right += 1;
    }
  }
  while (left < beforeLines.length) {
    result.push({ kind: "removed", value: beforeLines[left++]! });
  }
  while (right < afterLines.length) {
    result.push({ kind: "added", value: afterLines[right++]! });
  }
  return result;
}
