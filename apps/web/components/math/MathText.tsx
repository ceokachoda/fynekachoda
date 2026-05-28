"use client";

// Web port of apps/mobile/components/quiz/MathText.tsx.
//
// D-178 + W-15: only mount the KaTeX renderer when math delimiters are
// detected in the input. Plain-text questions render as a `<span>` and never
// pay the KaTeX cost. The mobile heuristic + delimiter list are preserved
// verbatim so the same source markdown renders identically on both surfaces.
//
// Delimiters: `$inline$`, `$$display$$`, `\(inline\)`, `\[display\]`.
// Inside `$…$` / `\(…\)` we render an `InlineMath`; inside `$$…$$` / `\[…\]`
// we render a `BlockMath`. Plain runs are rendered as a `<span>` with simple
// **bold** / *italic* / \n handling — matching the mobile inline-md helper.

import { useMemo } from "react";
import { InlineMath, BlockMath } from "react-katex";

type Run =
  | { kind: "text"; value: string }
  | { kind: "inline-math"; value: string }
  | { kind: "block-math"; value: string };

// Matches: $...$, $$...$$, \(...\), \[...\]
// `[\s\S]` so the body can span newlines (block math). Non-greedy so multiple
// math runs on one line don't collapse together.
const TOKEN_RE = /\$\$([\s\S]+?)\$\$|\$([^$\n]+?)\$|\\\(([\s\S]+?)\\\)|\\\[([\s\S]+?)\\\]/g;

export function detectMath(markdown: string): boolean {
  return /\$\$?[^$]+\$\$?|\\\(|\\\[/.test(markdown);
}

export function splitMathRuns(markdown: string): Run[] {
  if (!detectMath(markdown)) {
    return [{ kind: "text", value: markdown }];
  }
  const runs: Run[] = [];
  let lastIndex = 0;
  // Re-create the regex per call so state from a prior parse doesn't leak.
  const re = new RegExp(TOKEN_RE.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(markdown)) !== null) {
    if (m.index > lastIndex) {
      runs.push({ kind: "text", value: markdown.slice(lastIndex, m.index) });
    }
    if (m[1] !== undefined) {
      runs.push({ kind: "block-math", value: m[1] });
    } else if (m[2] !== undefined) {
      runs.push({ kind: "inline-math", value: m[2] });
    } else if (m[3] !== undefined) {
      runs.push({ kind: "inline-math", value: m[3] });
    } else if (m[4] !== undefined) {
      runs.push({ kind: "block-math", value: m[4] });
    }
    lastIndex = m.index + m[0].length;
  }
  if (lastIndex < markdown.length) {
    runs.push({ kind: "text", value: markdown.slice(lastIndex) });
  }
  return runs;
}

// Render plain runs with the same lightweight inline-md formatting as the
// mobile WebView path: `**bold**`, `*italic*`, and `\n` → line break.
function renderTextRun(value: string, key: number): React.ReactNode {
  if (!value) return null;
  const lines = value.split("\n");
  return (
    <span key={`t-${key}`}>
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 ? <br /> : null}
          {renderInlineLine(line)}
        </span>
      ))}
    </span>
  );
}

function renderInlineLine(line: string): React.ReactNode[] {
  // Walk the line once, splitting at the next bold/italic marker. Bold wins
  // over italic when both could match (so `***x***` reads as bold-italic from
  // outside in — same as the mobile reducer).
  const out: React.ReactNode[] = [];
  let i = 0;
  let buf = "";
  let key = 0;
  const flush = () => {
    if (buf) {
      out.push(buf);
      buf = "";
    }
  };
  while (i < line.length) {
    if (line[i] === "*" && line[i + 1] === "*") {
      const end = line.indexOf("**", i + 2);
      if (end > i + 2) {
        flush();
        out.push(<strong key={`b-${key++}`}>{renderInlineLine(line.slice(i + 2, end))}</strong>);
        i = end + 2;
        continue;
      }
    }
    if (line[i] === "*") {
      const end = line.indexOf("*", i + 1);
      if (end > i + 1) {
        flush();
        out.push(<em key={`i-${key++}`}>{line.slice(i + 1, end)}</em>);
        i = end + 1;
        continue;
      }
    }
    buf += line[i];
    i += 1;
  }
  flush();
  return out;
}

interface Props {
  markdown: string;
  inline?: boolean;
  className?: string;
}

export function MathText({ markdown, inline = false, className }: Props) {
  const runs = useMemo(() => splitMathRuns(markdown), [markdown]);
  const first = runs[0];
  if (runs.length === 1 && first && first.kind === "text") {
    // Fast path — no KaTeX bundle work, no DOM churn. Use renderTextRun so
    // `\n` becomes <br/> identically to the multi-run path.
    return <span className={className}>{renderTextRun(first.value, 0)}</span>;
  }
  const Wrapper = inline ? "span" : "div";
  return (
    <Wrapper className={className}>
      {runs.map((run, i) => {
        if (run.kind === "text") return renderTextRun(run.value, i);
        if (run.kind === "inline-math") {
          return (
            <InlineMath key={`im-${i}`} math={run.value} errorColor="#dc2626" />
          );
        }
        return <BlockMath key={`bm-${i}`} math={run.value} errorColor="#dc2626" />;
      })}
    </Wrapper>
  );
}
