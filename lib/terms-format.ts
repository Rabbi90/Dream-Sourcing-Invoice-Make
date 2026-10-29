// Apply list formatting to whole lines, even when only a word is selected.
export function formatTerms(value: string, start: number, end: number, kind: "bold" | "italic" | "bullet" | "number") {
  if (kind === "bullet" || kind === "number") {
    start = value.lastIndexOf("\n", start - 1) + 1;
    const lastSelected = end > start && value[end - 1] === "\n" ? end - 1 : end;
    const nextBreak = value.indexOf("\n", lastSelected);
    end = nextBreak === -1 ? value.length : nextBreak;
  }
  const selected = value.slice(start, end) || "Text";
  const replacement = kind === "bold" ? `**${selected}**` : kind === "italic" ? `*${selected}*` : selected.split("\n").map((line, i) => `${kind === "bullet" ? "-" : `${i + 1}.`} ${line.replace(/^\s*(?:[-*]|\d+\.) /, "")}`).join("\n");
  return { value: value.slice(0, start) + replacement + value.slice(end), start, end: start + replacement.length };
}
