"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, Authenticated, Unauthenticated, AuthLoading } from "convex/react";
import { SignInButton, useOrganization, OrganizationSwitcher } from "@clerk/nextjs";
import { api } from "@/lib/convex";
import { Id } from "@convex/_generated/dataModel";
import { Header } from "@/components/Header";
import { KBSelector } from "@/components/KBSelector";
import { GenerateConfig, GenerateSettings } from "@/components/GenerateConfig";
import { QuestionList } from "@/components/QuestionList";
import { DocumentViewer } from "@/components/DocumentViewer";
import { DimensionWizard } from "@/components/DimensionWizard";
import { RealWorldQuestionsModal } from "@/components/RealWorldQuestionsModal";
import { StrategyType, Dimension, DocumentInfo, GeneratedQuestion } from "@/lib/types";

function OrgRequired({ children }: { children: React.ReactNode }) {
  const { organization, isLoaded } = useOrganization();

  if (!isLoaded) {
    return (
      <div className="flex flex-col h-screen">
        <Header mode="generate" />
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  if (!organization) {
    return (
      <div className="flex flex-col h-screen">
        <Header mode="generate" />
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center space-y-4">
            <p className="text-text-muted">Select or create an organization to continue</p>
            <OrganizationSwitcher
              afterSelectOrganizationUrl="/generate"
              afterCreateOrganizationUrl="/generate"
              appearance={{
                elements: {
                  rootBox: "mx-auto",
                },
              }}
            />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

function GeneratePageContent() {
  // KB selection
  const [selectedKbId, setSelectedKbId] = useState<Id<"knowledgeBases"> | null>(null);

  // Generation tracking
  const [datasetId, setDatasetId] = useState<Id<"datasets"> | null>(null);
  const [jobId, setJobId] = useState<Id<"jobs"> | null>(null);

  // Questions from Convex (reactive)
  const questionsData = useQuery(
    api.questions.byDataset,
    datasetId ? { datasetId } : "skip",
  );

  // Documents in the selected KB
  const documentsData = useQuery(
    api.documents.listByKb,
    selectedKbId ? { kbId: selectedKbId } : "skip",
  );

  // Job status (reactive — updates as generation progresses)
  const job = useQuery(api.jobs.get, jobId ? { id: jobId } : "skip");

  // Dataset info
  const dataset = useQuery(api.datasets.get, datasetId ? { id: datasetId } : "skip");

  const startGeneration = useMutation(api.generation.start);

  // UI state
  const [selectedQuestion, setSelectedQuestion] = useState<number | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [settings, setSettings] = useState<GenerateSettings>({
    questionsPerDoc: 10,
  });

  // Strategy state
  const [strategy, setStrategy] = useState<StrategyType>("simple");
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [totalQuestions, setTotalQuestions] = useState(50);
  const [wizardOpen, setWizardOpen] = useState(false);
  const [wizardInitialStep, setWizardInitialStep] = useState(1);
  const [realWorldQuestions, setRealWorldQuestions] = useState<string[]>([]);
  const [totalSyntheticQuestions, setTotalSyntheticQuestions] = useState(50);
  const [realWorldModalOpen, setRealWorldModalOpen] = useState(false);

  // Selected document for viewing
  const [selectedDocId, setSelectedDocId] = useState<Id<"documents"> | null>(null);
  const selectedDocData = useQuery(
    api.documents.get,
    selectedDocId ? { id: selectedDocId } : "skip",
  );

  // Derive generating state from job
  const generating = job?.status === "pending" || job?.status === "running";

  // Convert Convex questions to component format
  const questions: GeneratedQuestion[] = (questionsData ?? []).map((q) => ({
    docId: q.sourceDocId,
    query: q.queryText,
    relevantSpans: q.relevantSpans,
  }));

  // Convert Convex documents to DocumentInfo format
  const documents: DocumentInfo[] = (documentsData ?? []).map((d) => ({
    id: d.docId,
    content: "", // Content loaded on demand via selectedDocData
    contentLength: d.contentLength,
  }));

  // Load saved configs from localStorage on mount
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
    try {
      const saved = localStorage.getItem("rag-eval:real-world-questions");
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRealWorldQuestions(parsed);
        }
      }
    } catch {
      // Ignore corrupted localStorage
    }
  }, []);

  function handleReset() {
    setDatasetId(null);
    setJobId(null);
    setSelectedQuestion(null);
    setGenError(null);
    setSelectedDocId(null);
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

  function handleRealWorldSave(qs: string[]) {
    setRealWorldQuestions(qs);
    setRealWorldModalOpen(false);
    try {
      localStorage.setItem("rag-eval:real-world-questions", JSON.stringify(qs));
    } catch {
      // localStorage full or unavailable
    }
  }

  async function handleGenerate() {
    if (!selectedKbId || generating) return;

    setGenError(null);
    setSelectedQuestion(null);
    setSelectedDocId(null);

    const strategyConfig: Record<string, unknown> = {};

    if (strategy === "simple") {
      strategyConfig.queriesPerDoc = settings.questionsPerDoc;
    } else if (strategy === "dimension-driven") {
      strategyConfig.dimensions = dimensions;
      strategyConfig.totalQuestions = totalQuestions;
    } else if (strategy === "real-world-grounded") {
      strategyConfig.questions = realWorldQuestions;
      strategyConfig.totalSyntheticQuestions = totalSyntheticQuestions;
    }

    try {
      const result = await startGeneration({
        kbId: selectedKbId,
        name: `${strategy}-${Date.now()}`,
        strategy,
        strategyConfig,
      });

      setDatasetId(result.datasetId);
      setJobId(result.jobId);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "Failed to start generation");
    }
  }

  // When a question is selected, load its source document
  const selectedQ = selectedQuestion !== null ? questions[selectedQuestion] : null;
  useEffect(() => {
    if (selectedQ && documentsData) {
      const doc = documentsData.find((d) => d.docId === selectedQ.docId);
      if (doc) {
        setSelectedDocId(doc._id);
      }
    }
  }, [selectedQ, documentsData]);

  // Build doc info for DocumentViewer
  const selectedDoc: DocumentInfo | null = selectedDocData
    ? {
        id: selectedDocData.docId,
        content: selectedDocData.content,
        contentLength: selectedDocData.contentLength,
      }
    : null;

  // Phase status from job progress
  const phaseStatus = job?.progress?.message ?? (job?.phase ? `${job.phase}...` : null);
  const totalDone = job?.status === "completed" ? (questions.length || null) : null;

  const hasDocuments = (documentsData ?? []).length > 0;
  const hasQuestions = questions.length > 0;

  return (
    <div className="flex flex-col h-screen">
      <Header mode="generate" onReset={handleReset} />

      <div className="flex flex-1 overflow-hidden max-w-full">
        {/* Left sidebar: KB selector + config */}
        <div className="w-80 flex-shrink-0 border-r border-border bg-bg-elevated overflow-y-auto">
          <div className="p-4 space-y-6">
            <KBSelector selectedKbId={selectedKbId} onSelect={setSelectedKbId} />

            {hasDocuments && (
              <div className="pt-2 border-t border-border">
                <GenerateConfig
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
                  realWorldQuestions={realWorldQuestions}
                  totalSyntheticQuestions={totalSyntheticQuestions}
                  onTotalSyntheticChange={setTotalSyntheticQuestions}
                  onOpenRealWorldModal={() => setRealWorldModalOpen(true)}
                />
              </div>
            )}

            {genError && (
              <div className="p-3 rounded border border-error/30 bg-error/5 animate-fade-in">
                <p className="text-xs text-error">{genError}</p>
              </div>
            )}

            {job?.error && (
              <div className="p-3 rounded border border-error/30 bg-error/5 animate-fade-in">
                <p className="text-xs text-error">{job.error}</p>
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
          <DocumentViewer doc={selectedDoc} question={selectedQ} />
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

      {/* Real-World Questions Modal */}
      {realWorldModalOpen && (
        <RealWorldQuestionsModal
          initialQuestions={realWorldQuestions}
          onSave={handleRealWorldSave}
          onClose={() => setRealWorldModalOpen(false)}
        />
      )}
    </div>
  );
}

export default function GeneratePage() {
  return (
    <>
      <AuthLoading>
        <div className="flex flex-col h-screen">
          <Header mode="generate" />
          <div className="flex-1 flex items-center justify-center">
            <div className="w-5 h-5 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
          </div>
        </div>
      </AuthLoading>
      <Unauthenticated>
        <div className="flex flex-col h-screen">
          <Header mode="generate" />
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center space-y-4">
              <p className="text-text-muted">Sign in to generate questions</p>
              <SignInButton mode="modal">
                <button className="px-6 py-2 bg-accent text-bg-elevated rounded-lg hover:bg-accent/90 transition-colors font-medium">
                  Sign In
                </button>
              </SignInButton>
            </div>
          </div>
        </div>
      </Unauthenticated>
      <Authenticated>
        <OrgRequired>
          <GeneratePageContent />
        </OrgRequired>
      </Authenticated>
    </>
  );
}
