"use client";

import { useState } from "react";

interface WizardStepRealWorldProps {
  questions: string[];
  onChange: (questions: string[]) => void;
  onNext: () => void;
  onSkip: () => void;
}

export function WizardStepRealWorld({ questions, onChange, onNext, onSkip }: WizardStepRealWorldProps) {
  const [text, setText] = useState(questions.join("\n"));

  const handleChange = (value: string) => {
    setText(value);
    const parsed = value.split("\n").map(l => l.trim()).filter(Boolean);
    onChange(parsed);
  };

  const count = text.split("\n").map(l => l.trim()).filter(Boolean).length;

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-text-dim uppercase tracking-wider">Real-World Questions</span>
          {count > 0 && (
            <span className="text-xs px-2 py-0.5 rounded-full bg-accent-dim text-accent-bright">
              {count} question{count !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-text-dim mb-3">
          Paste real questions from your users (one per line). These help generate more realistic evaluation questions.
        </p>
      </div>

      <textarea
        value={text}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="How do I reset my API key?\nWhat's the rate limit on the free plan?\nCan I upgrade mid-billing cycle?"
        className="w-full h-40 bg-bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-text font-mono resize-none focus:outline-none focus:border-accent-dim"
      />

      <div className="flex justify-end gap-2">
        <button
          onClick={onSkip}
          className="px-3 py-1.5 text-xs text-text-dim hover:text-text transition-colors"
        >
          Skip
        </button>
        <button
          onClick={onNext}
          disabled={count === 0}
          className="px-3 py-1.5 text-xs rounded bg-accent-dim text-accent-bright hover:bg-accent/20 transition-colors disabled:opacity-40"
        >
          Next →
        </button>
      </div>
    </div>
  );
}
