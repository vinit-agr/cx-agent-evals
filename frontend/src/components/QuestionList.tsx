"use client";

import { GeneratedQuestion } from "@/lib/types";

export function QuestionList({
  questions,
  selectedIndex,
  onSelect,
  generating,
  totalDone,
}: {
  questions: GeneratedQuestion[];
  selectedIndex: number | null;
  onSelect: (index: number) => void;
  generating: boolean;
  totalDone: number | null;
}) {
  // Group by docId
  const grouped = new Map<string, { question: GeneratedQuestion; index: number }[]>();
  questions.forEach((q, i) => {
    const list = grouped.get(q.docId) || [];
    list.push({ question: q, index: i });
    grouped.set(q.docId, list);
  });

  if (questions.length === 0 && !generating) {
    return (
      <div className="flex items-center justify-center h-full text-text-dim text-xs">
        Questions will appear here
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-bg-elevated/50">
        <span className="text-[11px] text-text-dim uppercase tracking-wider">
          Questions
        </span>
        <span className="text-[11px] text-text-muted">
          {generating ? (
            <span className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-accent animate-pulse-dot" />
              {questions.length} generated
            </span>
          ) : totalDone !== null ? (
            `${totalDone} total`
          ) : (
            `${questions.length}`
          )}
        </span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {[...grouped.entries()].map(([docId, items]) => (
          <div key={docId}>
            <div className="px-3 py-1.5 bg-bg-surface/50 border-b border-border/50 sticky top-0">
              <span className="text-[10px] text-accent font-medium">
                {docId}
              </span>
            </div>
            {items.map(({ question, index }) => (
              <button
                key={index}
                onClick={() => onSelect(index)}
                className={`w-full text-left px-3 py-2.5 border-b border-border/30 transition-colors
                           cursor-pointer animate-slide-in
                           ${
                             selectedIndex === index
                               ? "bg-accent/8 border-l-2 border-l-accent"
                               : "hover:bg-bg-hover border-l-2 border-l-transparent"
                           }`}
                style={{ animationDelay: `${(index % 10) * 30}ms` }}
              >
                <p className="text-xs text-text leading-relaxed">
                  {question.query}
                </p>
                <span className="text-[10px] text-text-dim mt-1 block">
                  {question.relevantChunkIds
                    ? `${question.relevantChunkIds.length} chunk${question.relevantChunkIds.length !== 1 ? "s" : ""}`
                    : question.relevantSpans
                      ? `${question.relevantSpans.length} span${question.relevantSpans.length !== 1 ? "s" : ""}`
                      : ""}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
