"use client";

import { useEffect, useRef } from "react";
import { DocumentInfo, GeneratedQuestion, EvalMode } from "@/lib/types";

const HIGHLIGHT_COLORS = [
  "var(--color-chunk-1)",
  "var(--color-chunk-2)",
  "var(--color-chunk-3)",
  "var(--color-chunk-4)",
  "var(--color-chunk-5)",
];

interface HighlightSpan {
  start: number;
  end: number;
  colorIndex: number;
}

function computeHighlights(
  doc: DocumentInfo,
  question: GeneratedQuestion,
  mode: EvalMode,
): HighlightSpan[] {
  const spans: HighlightSpan[] = [];

  if (mode === "chunk" && question.chunks) {
    question.chunks.forEach((chunk, i) => {
      // Find the chunk text in the document
      const idx = doc.content.indexOf(chunk.content);
      if (idx !== -1) {
        spans.push({
          start: idx,
          end: idx + chunk.content.length,
          colorIndex: i % HIGHLIGHT_COLORS.length,
        });
      }
    });
  } else if (mode === "token" && question.relevantSpans) {
    question.relevantSpans.forEach((span, i) => {
      if (String(span.docId) === doc.id) {
        spans.push({
          start: span.start,
          end: span.end,
          colorIndex: i % HIGHLIGHT_COLORS.length,
        });
      }
    });
  }

  // Sort by start position
  spans.sort((a, b) => a.start - b.start);
  return spans;
}

function renderHighlightedText(content: string, highlights: HighlightSpan[]) {
  if (highlights.length === 0) {
    return <span>{content}</span>;
  }

  const parts: React.ReactNode[] = [];
  let lastEnd = 0;

  highlights.forEach((span, i) => {
    // Text before this highlight
    if (span.start > lastEnd) {
      parts.push(
        <span key={`t-${i}`}>{content.slice(lastEnd, span.start)}</span>,
      );
    }

    // Highlighted text
    parts.push(
      <mark
        key={`h-${i}`}
        data-highlight={i}
        className={i === 0 ? "first-highlight" : ""}
        style={{
          backgroundColor: HIGHLIGHT_COLORS[span.colorIndex],
          color: "var(--color-text)",
        }}
      >
        {content.slice(span.start, span.end)}
      </mark>,
    );

    lastEnd = span.end;
  });

  // Remaining text
  if (lastEnd < content.length) {
    parts.push(<span key="tail">{content.slice(lastEnd)}</span>);
  }

  return <>{parts}</>;
}

export function DocumentViewer({
  doc,
  question,
  mode,
}: {
  doc: DocumentInfo | null;
  question: GeneratedQuestion | null;
  mode: EvalMode;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const firstMark = containerRef.current.querySelector(".first-highlight");
    if (firstMark) {
      firstMark.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [question]);

  if (!doc) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-xs">
        Select a question to view its source document
      </div>
    );
  }

  const highlights =
    question ? computeHighlights(doc, question, mode) : [];

  const noHighlights = question && highlights.length === 0;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border bg-bg-elevated/50">
        <span className="text-xs text-accent font-medium">{doc.id}</span>
        <div className="flex items-center gap-3">
          {highlights.length > 0 && (
            <span className="text-[10px] text-text-muted">
              {highlights.length} highlight{highlights.length !== 1 ? "s" : ""}
            </span>
          )}
          <span className="text-[10px] text-text-dim">
            {doc.contentLength.toLocaleString()} chars
          </span>
        </div>
      </div>

      {noHighlights && (
        <div className="px-4 py-2 bg-warn/5 border-b border-warn/20">
          <span className="text-[11px] text-warn">
            No relevant {mode === "chunk" ? "chunks" : "spans"} found for this
            question
          </span>
        </div>
      )}

      <div ref={containerRef} className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        {question && (
          <div className="mb-4 pb-3 border-b border-border/50 animate-fade-in">
            <span className="text-[10px] text-text-dim uppercase tracking-wider block mb-1">
              Question
            </span>
            <p className="text-xs text-accent-bright leading-relaxed">
              {question.query}
            </p>
          </div>
        )}

        <pre className="text-xs text-text-muted leading-[1.8] whitespace-pre-wrap break-all font-[inherit] max-w-full overflow-hidden">
          {renderHighlightedText(doc.content, highlights)}
        </pre>
      </div>
    </div>
  );
}
