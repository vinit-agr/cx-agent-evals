"use client";

import { EvalMode, StrategyType, Dimension } from "@/lib/types";
import { StrategySelector } from "./StrategySelector";
import { DimensionSummary } from "./DimensionSummary";

export interface GenerateSettings {
  questionsPerDoc: number;
  chunkSize: number;
  chunkOverlap: number;
}

export function GenerateConfig({
  mode,
  settings,
  onChange,
  onGenerate,
  disabled,
  generating,
  strategy,
  onStrategyChange,
  dimensions,
  totalQuestions,
  onOpenWizard,
}: {
  mode: EvalMode;
  settings: GenerateSettings;
  onChange: (settings: GenerateSettings) => void;
  onGenerate: () => void;
  disabled: boolean;
  generating: boolean;
  strategy: StrategyType;
  onStrategyChange: (strategy: StrategyType) => void;
  dimensions: Dimension[];
  totalQuestions: number;
  onOpenWizard: () => void;
}) {
  function updateField(field: keyof GenerateSettings, value: number) {
    onChange({ ...settings, [field]: value });
  }

  const dimensionsConfigured = dimensions.length > 0;
  const canGenerate =
    strategy === "simple" ||
    (strategy === "dimension-driven" && dimensionsConfigured);

  return (
    <div className="animate-fade-in">
      <div className="mb-4">
        <span className="text-xs text-text-dim uppercase tracking-wider">
          Generation config
        </span>
      </div>

      <div className="space-y-4">
        <StrategySelector value={strategy} onChange={onStrategyChange} />

        <div className="border-t border-border pt-3">
          {strategy === "simple" && (
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] text-text-muted mb-1">
                  Questions per document
                </label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={settings.questionsPerDoc}
                  onChange={(e) =>
                    updateField(
                      "questionsPerDoc",
                      parseInt(e.target.value) || 1,
                    )
                  }
                  className="w-full bg-bg-surface border border-border rounded px-3 py-1.5 text-sm text-text
                             focus:outline-none focus:border-accent/50 transition-colors"
                />
              </div>
            </div>
          )}

          {strategy === "dimension-driven" && (
            <div className="space-y-3">
              {dimensionsConfigured ? (
                <DimensionSummary
                  dimensions={dimensions}
                  totalQuestions={totalQuestions}
                  onEdit={onOpenWizard}
                />
              ) : (
                <button
                  onClick={onOpenWizard}
                  className="w-full py-2.5 rounded border border-dashed border-accent/30 text-xs text-accent
                             hover:bg-accent/5 hover:border-accent/50 transition-all cursor-pointer"
                >
                  Set Up Dimensions
                </button>
              )}
            </div>
          )}
        </div>

        {mode === "chunk" && (
          <div className="space-y-3 border-t border-border pt-3">
            <div>
              <label className="block text-[11px] text-text-muted mb-1">
                Chunk size (characters)
              </label>
              <input
                type="number"
                min={100}
                max={10000}
                step={100}
                value={settings.chunkSize}
                onChange={(e) =>
                  updateField("chunkSize", parseInt(e.target.value) || 100)
                }
                className="w-full bg-bg-surface border border-border rounded px-3 py-1.5 text-sm text-text
                           focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
            <div>
              <label className="block text-[11px] text-text-muted mb-1">
                Chunk overlap (characters)
              </label>
              <input
                type="number"
                min={0}
                max={settings.chunkSize - 1}
                step={50}
                value={settings.chunkOverlap}
                onChange={(e) =>
                  updateField("chunkOverlap", parseInt(e.target.value) || 0)
                }
                className="w-full bg-bg-surface border border-border rounded px-3 py-1.5 text-sm text-text
                           focus:outline-none focus:border-accent/50 transition-colors"
              />
            </div>
          </div>
        )}
      </div>

      <button
        onClick={onGenerate}
        disabled={disabled || generating || !canGenerate}
        className="mt-5 w-full py-2.5 rounded border text-xs font-semibold uppercase tracking-wider
                   transition-all cursor-pointer
                   disabled:opacity-30 disabled:cursor-not-allowed
                   bg-accent/10 border-accent/30 text-accent
                   hover:bg-accent/20 hover:border-accent/50"
      >
        {generating ? (
          <span className="flex items-center justify-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse-dot" />
            Generating...
          </span>
        ) : (
          "Generate Questions"
        )}
      </button>
    </div>
  );
}
