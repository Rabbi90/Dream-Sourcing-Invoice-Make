"use client";

import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { formatTerms } from "@/lib/terms-format";

export function TermsContent({ value }: { value: string }) {
  return <div className="terms-content">{value.split("\n").map((line, i) => {
    const bullet = /^\s*[-*] /.test(line);
    const ordered = /^\s*\d+\. /.exec(line);
    const text = line.replace(/^\s*(?:[-*]|\d+\.) /, "");
    return <p key={i} className={bullet || ordered ? "terms-list-line" : undefined}>
      {(bullet || ordered) && <span className="terms-marker">{bullet ? "➢" : ordered![0].trim()}</span>}
      <span>{text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, j) => part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : part.startsWith("*") && part.endsWith("*") ? <em key={j}>{part.slice(1, -1)}</em> : part)}</span>
    </p>;
  })}</div>;
}

export function TermsEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const input = useRef<HTMLTextAreaElement>(null);
  function format(kind: "bold" | "italic" | "bullet" | "number") {
    const el = input.current;
    if (!el) return;
    const next = formatTerms(value, el.selectionStart, el.selectionEnd, kind);
    if (next.value.length > 6000) return;
    onChange(next.value);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(next.start, next.end); });
  }
  return <div className="terms-editor">
    <div className="terms-toolbar" role="toolbar" aria-label="Terms formatting">{(["bold", "italic", "bullet", "number"] as const).map(kind => <Button key={kind} type="button" variant="outline" onClick={() => format(kind)}>{({bold:"Bold",italic:"Italic",bullet:"Bullet list",number:"Numbered list"})[kind]}</Button>)}</div>
    <label>Terms and conditions<textarea ref={input} value={value} maxLength={6000} rows={9} onChange={e => onChange(e.target.value)} /></label>
    <p className="template-help">Select text and use the toolbar. **Bold**, *italic*, and lists are formatted below and in your document.</p>
    <TermsContent value={value} />
  </div>;
}
