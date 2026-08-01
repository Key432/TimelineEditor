export type CsvTable = { headers: string[]; rows: string[][] };

export function parseGenericCsv(source: string): CsvTable {
  const text = source.replace(/^\uFEFF/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index]!;
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else quoted = !quoted;
    } else if (character === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(cell);
      if (row.some((value) => value.length > 0)) rows.push(row);
      row = [];
      cell = "";
    } else cell += character;
  }
  if (quoted) throw new Error("引用符が閉じられていないCSVです。");
  row.push(cell);
  if (row.some((value) => value.length > 0)) rows.push(row);
  const headers = rows.shift()?.map((value) => value.trim()) ?? [];
  if (headers.length === 0) throw new Error("CSVの見出し行がありません。");
  if (new Set(headers).size !== headers.length)
    throw new Error("同じ列名を重複して使用できません。");
  return { headers, rows };
}

export function mappedValue(
  table: CsvTable,
  row: string[],
  mapping: Record<string, string>,
  target: string,
) {
  const source = mapping[target];
  if (!source) return "";
  if (source.startsWith("=")) return source.slice(1);
  const index = table.headers.indexOf(source);
  return index < 0 ? "" : (row[index] ?? "").trim();
}

export function duplicateRowIndexes(
  table: CsvTable,
  mapping: Record<string, string>,
  existingTitles: string[],
) {
  const seen = new Set(
    existingTitles.map((title) => title.trim().toLocaleLowerCase("ja")),
  );
  const duplicates: number[] = [];
  table.rows.forEach((row, index) => {
    const title = mappedValue(table, row, mapping, "title").toLocaleLowerCase(
      "ja",
    );
    if (title && seen.has(title)) duplicates.push(index);
    if (title) seen.add(title);
  });
  return duplicates;
}

export function rowsToCsv(headers: string[], rows: string[][]) {
  const escape = (value: string) =>
    /[",\r\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
  return [headers, ...rows]
    .map((row) => row.map(escape).join(","))
    .join("\r\n");
}
