"use client";

import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import type { AnalyzeMode, AnalyzeResponse } from "@/lib/types";

type WorkflowStep = "documents" | "configure" | "results";

const STEPS: { id: WorkflowStep; label: string; description: string }[] = [
  { id: "documents", label: "Documents", description: "Upload or paste your documents" },
  { id: "configure", label: "Configure", description: "Set analysis parameters" },
  { id: "results", label: "Results", description: "View analysis output" },
];

function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14,2 14,8 20,8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10,9 9,9 8,9" />
    </svg>
  );
}

function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}

function SparkleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0L14.59 8.41L23 11L14.59 13.59L12 22L9.41 13.59L1 11L9.41 8.41L12 0Z" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
      <polyline points="20,6 9,17 4,12" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="9,18 15,12 9,6" />
    </svg>
  );
}

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polyline points="15,18 9,12 15,6" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className ?? "h-4 w-4"}`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

type LogEntry = {
  message: string;
  type: "info" | "success" | "error" | "dim";
  timestamp: number;
};

function Terminal({ logs, isRunning }: { logs: LogEntry[]; isRunning: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  const getLogColor = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return "text-green-400";
      case "error": return "text-red-400";
      case "dim": return "text-slate-500";
      default: return "text-slate-300";
    }
  };

  const getLogPrefix = (type: LogEntry["type"]) => {
    switch (type) {
      case "success": return "✓";
      case "error": return "✗";
      case "dim": return " ";
      default: return "›";
    }
  };

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-slate-700 bg-slate-900 font-mono text-sm">
      {/* Terminal header */}
      <div className="flex items-center gap-2 border-b border-slate-700 bg-slate-800 px-4 py-2">
        <div className="flex gap-1.5">
          <div className="h-3 w-3 rounded-full bg-red-500/80" />
          <div className="h-3 w-3 rounded-full bg-yellow-500/80" />
          <div className="h-3 w-3 rounded-full bg-green-500/80" />
        </div>
        <span className="ml-2 text-xs text-slate-400">Analysis Log</span>
        {isRunning && (
          <div className="ml-auto flex items-center gap-2">
            <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
            <span className="text-xs text-green-400">Running</span>
          </div>
        )}
      </div>

      {/* Terminal content */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 text-xs leading-relaxed"
      >
        {logs.length === 0 ? (
          <div className="text-slate-500">
            <span className="text-slate-400">$</span> Waiting for analysis to start...
          </div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`${getLogColor(log.type)} flex`}>
              <span className="mr-2 w-4 flex-shrink-0 text-center">{getLogPrefix(log.type)}</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
        {isRunning && (
          <div className="mt-1 flex items-center text-slate-400">
            <span className="mr-2 w-4 flex-shrink-0 text-center">›</span>
            <span className="animate-pulse">_</span>
          </div>
        )}
      </div>
    </div>
  );
}

function StepIndicator({
  steps,
  currentStep,
  onStepClick,
  completedSteps,
}: {
  steps: typeof STEPS;
  currentStep: WorkflowStep;
  onStepClick: (step: WorkflowStep) => void;
  completedSteps: Set<WorkflowStep>;
}) {
  const currentIndex = steps.findIndex((s) => s.id === currentStep);

  return (
    <div className="flex items-center justify-center gap-2">
      {steps.map((step, index) => {
        const isActive = step.id === currentStep;
        const isCompleted = completedSteps.has(step.id);
        const isPast = index < currentIndex;
        const isClickable = isCompleted || isPast || index === currentIndex;

        return (
          <div key={step.id} className="flex items-center">
            <button
              onClick={() => isClickable && onStepClick(step.id)}
              disabled={!isClickable}
              className={`group flex items-center gap-3 rounded-full px-4 py-2.5 transition-all ${
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/20"
                  : isCompleted || isPast
                    ? "bg-primary/10 text-primary hover:bg-primary/20"
                    : "bg-muted/50 text-muted-foreground"
              } ${isClickable ? "cursor-pointer" : "cursor-not-allowed opacity-60"}`}
            >
              <span
                className={`flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                  isActive
                    ? "bg-primary-foreground/20"
                    : isCompleted
                      ? "bg-primary/20"
                      : "bg-muted"
                }`}
              >
                {isCompleted && !isActive ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </span>
              <span className="font-medium">{step.label}</span>
            </button>

            {index < steps.length - 1 && (
              <div
                className={`mx-2 h-0.5 w-8 rounded-full transition-colors ${
                  isPast || isCompleted ? "bg-primary/40" : "bg-border"
                }`}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Home() {
  const [currentStep, setCurrentStep] = useState<WorkflowStep>("documents");
  const [completedSteps, setCompletedSteps] = useState<Set<WorkflowStep>>(new Set());

  const [documents, setDocuments] = useState([
    { id: "contract-1", text: "" },
  ]);
  const [question, setQuestion] = useState(
    "Summarize key risks, obligations, and any missing clauses.",
  );
  const [mode, setMode] = useState<AnalyzeMode>("rlm");
  const [chunkSize, setChunkSize] = useState(1800);
  const [topK, setTopK] = useState(8);
  const [maxSubcalls, setMaxSubcalls] = useState(24);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [uploadingIndex, setUploadingIndex] = useState<number | null>(null);
  const [uploadErrors, setUploadErrors] = useState<Record<number, string>>({});
  const [collapsedDocs, setCollapsedDocs] = useState<Set<number>>(new Set());
  const [logs, setLogs] = useState<LogEntry[]>([]);

  const totalChars = documents.reduce((sum, doc) => sum + doc.text.length, 0);
  const hasDocuments = documents.some((doc) => doc.text.trim().length > 0);

  const markStepComplete = (step: WorkflowStep) => {
    setCompletedSteps((prev) => new Set([...prev, step]));
  };

  const goToStep = (step: WorkflowStep) => {
    setCurrentStep(step);
  };

  const goNext = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      markStepComplete(currentStep);
      setCurrentStep(STEPS[currentIndex + 1].id);
    }
  };

  const goBack = () => {
    const currentIndex = STEPS.findIndex((s) => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
    }
  };

  const updateDocument = (index: number, field: "id" | "text", value: string) => {
    setDocuments((docs) =>
      docs.map((doc, docIndex) =>
        docIndex === index ? { ...doc, [field]: value } : doc,
      ),
    );
  };

  const addDocument = () => {
    setDocuments((docs) => [
      ...docs,
      { id: `contract-${docs.length + 1}`, text: "" },
    ]);
  };

  const removeDocument = (index: number) => {
    setDocuments((docs) => docs.filter((_, docIndex) => docIndex !== index));
    // Clean up collapsed state and re-index
    setCollapsedDocs((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1);
      });
      return next;
    });
  };

  const handleFileUpload = async (index: number, file: File | null) => {
    if (!file) return;

    setUploadingIndex(index);
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[index];
      return next;
    });

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/parse", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();

      if (!response.ok) {
        setUploadErrors((prev) => ({
          ...prev,
          [index]: data.error ?? "Upload failed.",
        }));
        return;
      }

      const filename = typeof data.filename === "string" ? data.filename : file.name;
      const baseId = filename.replace(/\.[^.]+$/, "");

      setDocuments((docs) =>
        docs.map((doc, docIndex) => {
          if (docIndex !== index) return doc;
          return {
            ...doc,
            id: doc.id?.trim() ? doc.id : baseId || `contract-${index + 1}`,
            text: typeof data.text === "string" ? data.text : doc.text,
          };
        }),
      );
      // Auto-collapse after successful upload
      setCollapsedDocs((prev) => new Set([...prev, index]));
    } catch (err) {
      setUploadErrors((prev) => ({
        ...prev,
        [index]: err instanceof Error ? err.message : "Upload failed.",
      }));
    } finally {
      setUploadingIndex(null);
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResult(null);
    setLogs([]);

    // Move to results step immediately to show terminal
    markStepComplete("configure");
    setCurrentStep("results");

    try {
      const response = await fetch("/api/analyze-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          documents,
          question,
          mode,
          options: { chunkSize, topK, maxSubcalls },
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        setError(data.error ?? "Analysis failed.");
        setLoading(false);
        return;
      }

      const reader = response.body?.getReader();
      if (!reader) {
        setError("Failed to start streaming.");
        setLoading(false);
        return;
      }

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

              if (data.type === "log") {
                setLogs((prev) => [...prev, {
                  message: data.message,
                  type: data.logType,
                  timestamp: data.timestamp,
                }]);
              } else if (data.type === "result") {
                setResult(data.data as AnalyzeResponse);
              } else if (data.type === "error") {
                setError(data.error);
              }
            } catch {
              // Skip malformed JSON
            }
          }
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Analysis failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Animated background orbs */}
      <div className="bg-orb bg-orb-1" aria-hidden="true" />
      <div className="bg-orb bg-orb-2" aria-hidden="true" />
      <div className="bg-orb bg-orb-3" aria-hidden="true" />

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 lg:px-8">
        {/* Header */}
        <header className="flex flex-col items-center gap-4 text-center animate-fade-in-up">
          <Badge className="badge-glow rounded-full bg-gradient-to-r from-primary/90 to-primary px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-primary-foreground shadow-lg shadow-primary/20">
            <SparkleIcon className="mr-1.5 h-3 w-3" />
            Document Analysis
          </Badge>
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-tight text-foreground md:text-5xl">
            Analyze documents with <span className="gradient-text">RLM</span>
          </h1>
          <p className="max-w-xl text-base text-muted-foreground md:text-lg">
            Upload documents, configure your analysis, and get comprehensive insights with citations.
          </p>
        </header>

        {/* Step Indicator */}
        <div className="animate-fade-in-up animate-delay-1">
          <StepIndicator
            steps={STEPS}
            currentStep={currentStep}
            onStepClick={goToStep}
            completedSteps={completedSteps}
          />
        </div>

        {/* Step Content */}
        <div className="animate-fade-in-up animate-delay-2">
          {/* Documents Step */}
          {currentStep === "documents" && (
            <Card className="glass-card glass-card-slate overflow-hidden rounded-2xl border-0">
              <CardHeader className="flex flex-row items-start justify-between gap-4 border-b border-border/30 pb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100">
                    <FileIcon className="h-5 w-5 text-slate-600" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold">Document Set</CardTitle>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Upload PDF, DOCX, TXT files or paste text directly.
                    </p>
                  </div>
                </div>
                <Button
                  variant="secondary"
                  onClick={addDocument}
                  className="rounded-xl bg-white/60 px-4 shadow-sm backdrop-blur transition-all hover:bg-white/80 hover:shadow"
                >
                  <span className="mr-1.5 text-lg leading-none">+</span>
                  Add document
                </Button>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {documents.map((doc, index) => (
                  <div
                    key={`${doc.id}-${index}`}
                    className="group space-y-4 rounded-xl border border-border/40 bg-white/40 p-5 transition-all hover:border-border/60 hover:bg-white/60"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-100 text-sm font-semibold text-slate-600">
                          {index + 1}
                        </div>
                        <Input
                          value={doc.id}
                          onChange={(e) => updateDocument(index, "id", e.target.value)}
                          className="max-w-[200px] rounded-lg border-border/50 bg-white/70 font-medium focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                          placeholder={`doc-${index + 1}`}
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        {uploadingIndex === index && (
                          <Badge variant="secondary" className="animate-pulse gap-1.5 rounded-lg">
                            <LoadingSpinner className="h-3 w-3" />
                            Parsing...
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={`rounded-lg border-border/50 bg-white/50 font-mono text-xs ${
                            doc.text.length > 0 ? "border-primary/30 text-primary" : ""
                          }`}
                        >
                          {doc.text.length.toLocaleString()} chars
                        </Badge>
                        {documents.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => removeDocument(index)}
                            className="h-8 rounded-lg px-2 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                          >
                            Remove
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Input
                        type="file"
                        accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                        onChange={(e) => {
                          const file = e.target.files?.[0] ?? null;
                          handleFileUpload(index, file);
                          e.currentTarget.value = "";
                        }}
                        className="cursor-pointer rounded-lg border-dashed border-border/60 bg-white/50 file:mr-3 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-1 file:text-xs file:font-medium file:text-primary hover:border-primary/40 hover:bg-white/70"
                      />
                      {uploadErrors[index] && (
                        <p className="flex items-center gap-1.5 text-xs text-destructive">
                          <span className="inline-block h-1.5 w-1.5 rounded-full bg-destructive" />
                          {uploadErrors[index]}
                        </p>
                      )}
                    </div>

                    {collapsedDocs.has(index) && doc.text.length > 0 ? (
                      <div className="rounded-xl border border-primary/30 bg-primary/5 p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                              <CheckIcon className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-foreground">Document loaded</p>
                              <p className="text-xs text-muted-foreground">
                                {doc.text.length.toLocaleString()} characters ready for analysis
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setCollapsedDocs((prev) => {
                              const next = new Set(prev);
                              next.delete(index);
                              return next;
                            })}
                            className="h-8 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                          >
                            View content
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <Textarea
                          value={doc.text}
                          onChange={(e) => updateDocument(index, "text", e.target.value)}
                          placeholder="Or paste document text here..."
                          className="max-h-[200px] min-h-[140px] overflow-y-auto rounded-xl border-border/50 bg-white/70 text-sm leading-relaxed placeholder:text-muted-foreground/60 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                        />
                        {doc.text.length > 0 && (
                          <div className="flex justify-end">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setCollapsedDocs((prev) => new Set([...prev, index]))}
                              className="h-7 rounded-lg text-xs text-muted-foreground hover:text-foreground"
                            >
                              Collapse
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Summary bar */}
                <div className="flex items-center justify-between rounded-xl bg-muted/30 px-5 py-4">
                  <div className="flex items-center gap-6 text-sm">
                    <div>
                      <span className="font-semibold text-foreground">{documents.length}</span>
                      <span className="ml-1 text-muted-foreground">document{documents.length !== 1 ? "s" : ""}</span>
                    </div>
                    <Separator orientation="vertical" className="h-5" />
                    <div>
                      <span className="font-semibold text-foreground">{totalChars.toLocaleString()}</span>
                      <span className="ml-1 text-muted-foreground">total characters</span>
                    </div>
                  </div>
                  <Button
                    onClick={goNext}
                    disabled={!hasDocuments}
                    className="btn-primary gap-2 rounded-xl px-6"
                  >
                    Continue
                    <ChevronRightIcon className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Configure Step */}
          {currentStep === "configure" && (
            <Card className="glass-card glass-card-sage overflow-hidden rounded-2xl border-0">
              <CardHeader className="border-b border-border/30 pb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                    <SettingsIcon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-xl font-semibold">Analysis Configuration</CardTitle>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      Define your question and set analysis parameters.
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6 pt-6">
                {/* Question */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    What would you like to analyze?
                  </label>
                  <Textarea
                    value={question}
                    onChange={(e) => setQuestion(e.target.value)}
                    placeholder="Ask a targeted question or request a comprehensive review..."
                    className="min-h-[120px] rounded-xl border-border/50 bg-white/70 text-sm leading-relaxed focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                {/* Mode */}
                <div className="space-y-3">
                  <label className="text-sm font-medium text-foreground">
                    Analysis Mode
                  </label>
                  <Tabs value={mode} onValueChange={(v) => setMode(v as AnalyzeMode)}>
                    <TabsList className="grid w-full grid-cols-3 rounded-xl bg-white/50 p-1">
                      <TabsTrigger
                        value="base"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      >
                        <div className="flex flex-col items-center gap-0.5 py-1">
                          <span className="font-medium">Base</span>
                          <span className="text-[10px] text-muted-foreground">Direct LLM</span>
                        </div>
                      </TabsTrigger>
                      <TabsTrigger
                        value="retrieval"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      >
                        <div className="flex flex-col items-center gap-0.5 py-1">
                          <span className="font-medium">Retrieval</span>
                          <span className="text-[10px] text-muted-foreground">Top-K chunks</span>
                        </div>
                      </TabsTrigger>
                      <TabsTrigger
                        value="rlm"
                        className="rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
                      >
                        <div className="flex flex-col items-center gap-0.5 py-1">
                          <span className="font-medium">RLM</span>
                          <span className="text-[10px] text-muted-foreground">Recursive</span>
                        </div>
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>

                {/* Advanced Parameters - shown only for modes that use them */}
                {mode !== "base" && (
                  <div className="space-y-3">
                    <label className="text-sm font-medium text-foreground">
                      Advanced Parameters
                    </label>
                    <div className={`grid gap-4 ${mode === "rlm" ? "md:grid-cols-2" : "md:grid-cols-2"}`}>
                      {/* Chunk size - used by retrieval and rlm */}
                      <div className="space-y-2 rounded-xl border border-border/40 bg-white/40 p-4">
                        <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                          Chunk size
                        </label>
                        <Input
                          type="number"
                          value={chunkSize}
                          onChange={(e) => setChunkSize(Number(e.target.value))}
                          min={500}
                          max={5000}
                          className="rounded-lg border-border/50 bg-white/70 font-mono text-sm"
                        />
                        <p className="text-xs text-muted-foreground">Characters per chunk</p>
                      </div>

                      {/* Top K - only used by retrieval */}
                      {mode === "retrieval" && (
                        <div className="space-y-2 rounded-xl border border-border/40 bg-white/40 p-4">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Top K
                          </label>
                          <Input
                            type="number"
                            value={topK}
                            onChange={(e) => setTopK(Number(e.target.value))}
                            min={2}
                            max={40}
                            className="rounded-lg border-border/50 bg-white/70 font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">Top ranked chunks to use</p>
                        </div>
                      )}

                      {/* Max subcalls - only used by rlm */}
                      {mode === "rlm" && (
                        <div className="space-y-2 rounded-xl border border-border/40 bg-white/40 p-4">
                          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                            Max subcalls
                          </label>
                          <Input
                            type="number"
                            value={maxSubcalls}
                            onChange={(e) => setMaxSubcalls(Number(e.target.value))}
                            min={2}
                            max={120}
                            className="rounded-lg border-border/50 bg-white/70 font-mono text-sm"
                          />
                          <p className="text-xs text-muted-foreground">Max chunks to analyze</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Error */}
                {error && (
                  <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                    <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                      <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                      {error}
                    </p>
                  </div>
                )}

                {/* Navigation */}
                <div className="flex items-center justify-between rounded-xl bg-muted/30 px-5 py-4">
                  <Button
                    variant="ghost"
                    onClick={goBack}
                    className="gap-2 rounded-xl"
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                    Back
                  </Button>
                  <Button
                    onClick={runAnalysis}
                    disabled={loading || !question.trim()}
                    className="btn-primary gap-2 rounded-xl px-6"
                  >
                    {loading ? (
                      <>
                        <LoadingSpinner className="h-4 w-4" />
                        Analyzing...
                      </>
                    ) : (
                      <>
                        <SparkleIcon className="h-4 w-4" />
                        Run Analysis
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Results Step */}
          {currentStep === "results" && (
            <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
              {/* Main content */}
              <Card className="glass-card glass-card-mist overflow-hidden rounded-2xl border-0">
                <CardHeader className="border-b border-border/30 pb-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <SparkleIcon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-xl font-semibold">Analysis Results</CardTitle>
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          Findings with citations and diagnostic metrics.
                        </p>
                      </div>
                    </div>
                    {result && (
                      <div className="flex flex-wrap gap-2">
                        <Badge className="rounded-lg bg-primary/10 text-primary">
                          {result.mode}
                        </Badge>
                        {result.debug?.chunksTotal && (
                          <Badge variant="outline" className="rounded-lg border-border/50 bg-white/50 font-mono text-xs">
                            {result.debug.chunksUsed}/{result.debug.chunksTotal} chunks
                          </Badge>
                        )}
                        {result.usage?.totalTokens && (
                          <Badge variant="outline" className="rounded-lg border-border/50 bg-white/50 font-mono text-xs">
                            {result.usage.totalTokens.toLocaleString()} tokens
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-6 pt-6">
                  {error && (
                    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4">
                      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
                        <span className="inline-block h-2 w-2 rounded-full bg-destructive" />
                        {error}
                      </p>
                    </div>
                  )}

                  {result ? (
                    <div className="markdown max-h-[500px] overflow-y-auto rounded-xl border border-border/40 bg-white/60 p-6 text-sm leading-relaxed backdrop-blur">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {result.answer}
                      </ReactMarkdown>
                    </div>
                  ) : loading ? (
                    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-white/30 p-8 text-center">
                      <LoadingSpinner className="h-8 w-8 text-primary" />
                      <p className="mt-4 text-sm font-medium text-muted-foreground">
                        Analysis in progress...
                      </p>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
                        Watch the terminal for real-time status updates.
                      </p>
                    </div>
                  ) : (
                    <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border/50 bg-white/30 p-8 text-center">
                      <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-muted/50">
                        <SparkleIcon className="h-6 w-6 text-muted-foreground/60" />
                      </div>
                      <p className="text-sm font-medium text-muted-foreground">
                        No results yet
                      </p>
                      <p className="mt-1 max-w-sm text-xs text-muted-foreground/70">
                        Go back to configure and run an analysis to see results here.
                      </p>
                    </div>
                  )}

                  {/* Navigation */}
                  <div className="flex items-center justify-between rounded-xl bg-muted/30 px-5 py-4">
                    <Button
                      variant="ghost"
                      onClick={goBack}
                      disabled={loading}
                      className="gap-2 rounded-xl"
                    >
                      <ChevronLeftIcon className="h-4 w-4" />
                      Back to Configure
                    </Button>
                    <Button
                      variant="secondary"
                      disabled={loading}
                      onClick={() => {
                        setResult(null);
                        setError(null);
                        setLogs([]);
                        setCurrentStep("documents");
                        setCompletedSteps(new Set());
                      }}
                      className="gap-2 rounded-xl"
                    >
                      Start New Analysis
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Terminal panel */}
              <div className="h-[600px] lg:sticky lg:top-6">
                <Terminal logs={logs} isRunning={loading} />
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <footer className="mt-4 flex items-center justify-center gap-2 text-xs text-muted-foreground/60">
          <span>Powered by</span>
          <span className="font-medium text-muted-foreground">Recursive Language Models</span>
        </footer>
      </main>
    </div>
  );
}
