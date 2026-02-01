"use client";

import { useState, useCallback, useEffect } from "react";
import { Header } from "@/components/Header";
import { ModeSelect } from "@/components/ModeSelect";
import { CorpusLoader } from "@/components/CorpusLoader";
import { GenerateConfig, GenerateSettings } from "@/components/GenerateConfig";
import { QuestionList } from "@/components/QuestionList";
import { DocumentViewer } from "@/components/DocumentViewer";
import { DimensionWizard } from "@/components/DimensionWizard";
import { EvalMode, StrategyType, Dimension, DocumentInfo, GeneratedQuestion } from "@/lib/types";

export default function Home() {
  const [mode, setMode] = useState<EvalMode | null>(null);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [folderPath, setFolderPath] = useState("");
  const [questions, setQuestions] = useState<GeneratedQuestion[]>([]);
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);
  const [generating, setGenerating] = useState(false);
  const [totalDone, setTotalDone] = useState<number | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [settings, setSettings] = useState<GenerateSettings>({
    questionsPerDoc: 10,
    chunkSize: 1000,
    chunkOverlap: 200,
  });

  // Strategy state
  const [strategy, setStrategy] = useState<StrategyType>("simple");
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(50);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState(1);
  const [phaseStatus, setPhaseStatus] = useState<string | null>(null);

  // Load saved dimension config from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("rag-eval:dimension-config");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed.dimensions) && parsed.dimensions.length > 0) {
          setDimensions(parsed.dimensions);
          setTotalQuestions(parsed.totalQuestions ?? 50);
          setStrategy("dimension-driven");
        }
      }
    } catch {
      // Ignore corrupted localStorage
    }
  }, []);

  function handleReset() {
    setMode(null);
    setDocuments([]);
    setQuestions([]);
    setSelectedQuestion(null);
    setTotalDone(null);
    setGenError(null);
  }

  function handleCorpusLoaded(docs: DocumentInfo[], path: string) {
    setDocuments(docs);
    setFolderPath(path);
    setQuestions([]);
    setSelectedQuestion(null);
    setTotalDone(null);
  }

  function handleOpenWizard() {
    if (dimensions.length > 0) {
      setWizardInitialStep(2);
    } else {
      setWizardInitialStep(1);
    }
    setWizardOpen(true);
  }

  function handleWizardSave(dims: Dimension[], total: number) {
    setDimensions(dims);
    setTotalQuestions(total);
    setWizardOpen(false);
    try {
      localStorage.setItem(
        "rag-eval:dimension-config",
        JSON.stringify({ dimensions: dims, totalQuestions: total }),
      );
    } catch {
      // localStorage full or unavailable
    }
  }

  const handleGenerate = useCallback(async () => {
    if (!mode || !folderPath || generating) return;

    setGenerating(true);
    setQuestions([]);
    setSelectedQuestion(null);
    setTotalDone(null);
    setGenError(null);
    setPhaseStatus(null);

    try {
      const body: Record<string, unknown> = {
        folderPath,
        mode,
        strategy,
        ...(mode === "chunk"
          ? {
              chunkSize: settings.chunkSize,
              chunkOverlap: settings.chunkOverlap,
            }
          : {}),
      };

      if (strategy === "simple") {
        body.questionsPerDoc = settings.questionsPerDoc;
      } else {
        body.dimensions = dimensions;
        body.totalQuestions = totalQuestions;
      }

      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = await res.json();
        setGenError(data.error || "Generation failed");
        setGenerating(false);
        return;
      }

      const reader = res.body?.getReader();
      if (!reader) {
        setGenError("No response stream");
        setGenerating(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const match = line.match(/^data:\s*(.+)$/m);
          if (!match) continue;

          try {
            const event = JSON.parse(match[1]);

            if (event.type === "phase") {
              const phaseLabels: Record<string, string | null> = {
                filtering: "Filtering dimension combinations...",
                summarizing: `Summarizing ${event.totalDocs ?? ""} documents...`,
                assigning: "Analyzing document relevance...",
                sampling: `Sampling ${event.totalQuestions ?? ""} questions...`,
                generating: `Generating for ${event.docId ?? "document"} (${(event.docIndex ?? 0) + 1}/${event.totalDocs ?? "?"})...`,
                "ground-truth-start": "Assigning ground truth...",
                "ground-truth": `Ground truth for ${event.docId ?? "document"}...`,
                done: null,
              };
              setPhaseStatus(phaseLabels[event.phase] ?? null);
            } else if (event.type === "question") {
              setQuestions((prev) => [
                ...prev,
                {
                  docId: event.docId,
                  query: event.query,
                  relevantChunkIds: event.relevantChunkIds,
                  chunks: event.chunks,
                  relevantSpans: event.relevantSpans,
                },
              ]);
            } else if (event.type === "done") {
              setTotalDone(event.totalQuestions);
              setPhaseStatus(null);
            } else if (event.type === "error") {
              setGenError(event.error);
              setPhaseStatus(null);
            }
          } catch {
            // Skip malformed JSON
          }
        }
      }
    } catch {
      setGenError("Connection lost — check server logs");
    } finally {
      setGenerating(false);
    }
  }, [mode, folderPath, generating, settings, strategy, dimensions, totalQuestions]);

  // Find selected question's document
  const selectedQ = selectedQuestion !== null ? questions[selectedQuestion] : null;
  const selectedDoc = selectedQ
    ? documents.find((d) => d.id === selectedQ.docId) ?? null
    : null;

  // Mode selection screen
  if (!mode) {
    return (
      <>
        <Header mode={null} onReset={handleReset} />
        <ModeSelect onSelect={setMode} />
      </>
    );
  }

  // Main workspace
  const hasDocuments = documents.length > 0;
  const hasQuestions = questions.length > 0;

  return (
    <div className="flex flex-col h-screen">
      <Header mode={mode} onReset={handleReset} />

      <div className="flex flex-1 overflow-hidden max-w-full">
        {/* Left sidebar: corpus + config */}
        <div className="w-80 flex-shrink-0 border-r border-border bg-bg-elevated overflow-y-auto">
          <div className="p-4 space-y-6">
            <CorpusLoader documents={documents} onLoaded={handleCorpusLoaded} />

            {hasDocuments && (
              <div className="pt-2 border-t border-border">
                <GenerateConfig
                  mode={mode}
                  settings={settings}
                  onChange={setSettings}
                  onGenerate={handleGenerate}
                  disabled={!hasDocuments}
                  generating={generating}
                  strategy={strategy}
                  onStrategyChange={setStrategy}
                  dimensions={dimensions}
                  totalQuestions={totalQuestions}
                  onOpenWizard={handleOpenWizard}
                />
              </div>
            )}

            {genError && (
              <div className="p-3 rounded border border-error/30 bg-error/5 animate-fade-in">
                <p className="text-xs text-error">{genError}</p>
              </div>
            )}
          </div>
        </div>

        {/* Center: question list */}
        {(hasQuestions || generating) && (
          <div className="w-80 flex-shrink-0 border-r border-border bg-bg">
            <QuestionList
              questions={questions}
              selectedIndex={selectedQuestion}
              onSelect={setSelectedQuestion}
              generating={generating}
              totalDone={totalDone}
              phaseStatus={phaseStatus}
            />
          </div>
        )}

        {/* Right: document viewer */}
        <div className="flex-1 min-w-0 bg-bg overflow-hidden">
          <DocumentViewer doc={selectedDoc} question={selectedQ} mode={mode} />
        </div>
      </div>

      {/* Dimension Wizard Modal */}
      {wizardOpen && (
        <DimensionWizard
          initialDimensions={dimensions.length > 0 ? dimensions : undefined}
          initialTotalQuestions={totalQuestions}
          initialStep={wizardInitialStep}
          onSave={handleWizardSave}
          onClose={() => setWizardOpen(false)}
        />
      )}
    </div>
  );
}
