"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import type { GrammarUnit, GrammarTopic, GrammarSettings } from "@/lib/db/grammar";
import type { ThreadRecord } from "@/lib/db";
import { PROGRESS_EXCLUDED_UNITS } from "@/lib/grammar-config";

type ContinueMode =
  | { kind: "loading" }
  | { kind: "resume";  topicName: string | null; threadId: string }
  | { kind: "next";    topicName: string | null; topicId: string; level: string }
  | { kind: "none" };
import { ChevronLeft, BookOpen, CirclePlay, ChevronRight, ArrowRight, AlignJustify, MessageSquare } from "lucide-react";
import { UnitSelector } from "@/components/grammar/UnitSelector";
import { TopicSelector } from "@/components/grammar/TopicSelector";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { Spinner } from "@/components/ui/Spinner";
import { AppNav } from "@/components/shared/AppNav";

type View = "home" | "units" | "topics";

export default function GrammarPage() {
  const router = useRouter();

  const [level, setLevel]               = useState<"B1" | "B2">("B1");
  const [units, setUnits]               = useState<GrammarUnit[]>([]);
  const [topics, setTopics]             = useState<GrammarTopic[]>([]);
  const [selectedUnit, setSelectedUnit] = useState<GrammarUnit | null>(null);
  const [view, setView]                 = useState<View>("home");
  const [isLoading, setIsLoading]           = useState(true);
  const [error, setError]                   = useState<string | null>(null);
  const [grammarThreads, setGrammarThreads] = useState<ThreadRecord[]>([]);
  const [continueMode, setContinueMode]     = useState<ContinueMode>({ kind: "loading" });

  // Initialize: fetch settings (keyed by the authenticated user server-side)
  useEffect(() => {
    (async () => {
      try {
        const [settingsRes, threadsRes] = await Promise.all([
          fetch(`/api/grammar/settings?lang=es`),
          fetch("/api/grammar/threads"),
        ]);
        if (!settingsRes.ok) throw new Error("Failed to load settings");
        const data: GrammarSettings = await settingsRes.json();
        setLevel((data.level as "B1" | "B2") ?? "B1");
        if (threadsRes.ok) {
          const threads: ThreadRecord[] = await threadsRes.json();
          setGrammarThreads(threads);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  // Compute "Resume" mode once grammarThreads is determined
  useEffect(() => {
    if (isLoading) return; // Wait while initially loading

    const latest = grammarThreads[0];
    if (!latest) {
      setContinueMode({ kind: "none" });
      return;
    }

    if (!latest.completed) {
      setContinueMode({ kind: "resume", topicName: latest.title, threadId: latest.id });
      return;
    }

    // Latest thread is complete → find next incomplete topic
    if (!latest.grammarTopicId || !latest.grammarLevel) {
      setContinueMode({ kind: "none" });
      return;
    }

    setContinueMode({ kind: "loading" });
    fetch(
      `/api/grammar/next-topic?topic_id=${encodeURIComponent(latest.grammarTopicId)}&level=${encodeURIComponent(latest.grammarLevel)}&lang=es`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.topic) {
          setContinueMode({
            kind:      "next",
            topicName: data.topic.topic_name,
            topicId:   data.topic.topic_id,
            level:     latest.grammarLevel ?? "B1",
          });
        } else {
          setContinueMode({ kind: "none" });
        }
      })
      .catch(() => setContinueMode({ kind: "none" }));
  }, [grammarThreads, isLoading]);

  // Completed topic count per unit (unit.name_ja → completed count)
  const completedByUnit = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const t of grammarThreads) {
      if (!t.grammarUnitName || !t.grammarTopicId || !t.completed) continue;
      if (!map.has(t.grammarUnitName)) map.set(t.grammarUnitName, new Set());
      map.get(t.grammarUnitName)!.add(t.grammarTopicId);
    }
    const result = new Map<string, number>();
    for (const [name, set] of map) result.set(name, set.size);
    return result;
  }, [grammarThreads]);

  // Overall progress rate (completed / total topics excluding ignored units)
  const overallProgress = useMemo(() => {
    if (units.length === 0) return null;
    const excluded = PROGRESS_EXCLUDED_UNITS[level] ?? [];
    const included = units.filter((u) => !excluded.includes(u.unit_id));
    const total     = included.reduce((s, u) => s + u.topic_count, 0);
    const completed = included.reduce((s, u) => s + (completedByUnit.get(u.name_ja) ?? 0), 0);
    const pct       = total > 0 ? Math.round((completed / total) * 100) : 0;
    const label     = excluded.length > 0 ? `(${excluded.join("·")} excluded)` : "";
    return { pct, completed, total, label };
  }, [units, completedByUnit, level]);

  // Fetch unit list
  const loadUnits = async () => {
    setError(null);
    setIsLoading(true);
    try {
      const res = await fetch(`/api/grammar/units?lang=es&level=${level}`);
      if (!res.ok) throw new Error("Failed to load units");
      const data: GrammarUnit[] = await res.json();
      setUnits(data);
      setView("units");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch topic list
  const loadTopics = async (unit: GrammarUnit) => {
    setError(null);
    setIsLoading(true);
    setSelectedUnit(unit);
    try {
      const res = await fetch(`/api/grammar/topics?lang=es&unit_id=${encodeURIComponent(unit.unit_id)}&level=${level}`);
      if (!res.ok) throw new Error("Failed to load topics");
      const data: GrammarTopic[] = await res.json();
      setTopics(data);
      setView("topics");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const handleTopicSelect = (topic: GrammarTopic) => {
    router.push(`/grammar/session?topic_id=${encodeURIComponent(topic.topic_id)}&level=${level}`);
  };

if (isLoading && view === "home") {
    return <FullScreenLoader />;
  }

  return (
    <div className="flex flex-col h-[var(--app-height)] bg-slate-950 text-slate-100">
      {/* Header */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-3.5 border-b border-indigo-500/20 bg-slate-900/85 backdrop-blur-xl">
        {view !== "home" ? (
          <button
            onClick={() => {
              if (view === "topics") setView("units");
              else setView("home");
            }}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
        ) : (
          <button
            onClick={() => router.push("/")}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <ChevronLeft size={16} strokeWidth={2} />
          </button>
        )}

        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-indigo-500/20 flex items-center justify-center">
            <BookOpen size={16} strokeWidth={1.8} className="text-indigo-400" />
          </div>
          <div>
            <p className="text-white text-sm font-semibold leading-none">Grammar Learning Mode</p>
            {view === "topics" && selectedUnit && (
              <p className="text-indigo-400/70 text-xs mt-0.5">{selectedUnit.unit_id} {selectedUnit.name_ja}</p>
            )}
          </div>
        </div>
        <div className="ml-auto">
          <AppNav current="grammar" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-5">
        {error && (
          <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
            {error}
          </div>
        )}

        {/* Home */}
        {view === "home" && (
          <div className="flex flex-col gap-4 max-w-lg mx-auto">
            {/* Level display */}
            <div className="flex items-center justify-between px-4 py-3 bg-slate-800/50 border border-slate-700/40 rounded-xl">
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500 uppercase tracking-widest">Level</span>
                <span className="text-sm font-semibold text-indigo-300">{level}</span>
              </div>
              <div className="flex gap-1">
                {(["B1", "B2"] as const).map((l) => (
                  <button
                    key={l}
                    onClick={() => setLevel(l)}
                    className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors min-h-[32px] ${
                      level === l
                        ? "bg-indigo-600 text-white"
                        : "text-slate-400 hover:text-slate-200 hover:bg-slate-700"
                    }`}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            {/* Resume / Next Topic */}
            {continueMode.kind === "resume" && (
              <button
                onClick={() =>
                  router.push(
                    `/grammar/session?topic_id=${encodeURIComponent(
                      grammarThreads[0]?.grammarTopicId ?? ""
                    )}&level=${grammarThreads[0]?.grammarLevel ?? level}&thread_id=${continueMode.threadId}`
                  )
                }
                className="flex items-center justify-between w-full px-5 py-4 rounded-2xl
                           bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/30
                           hover:border-indigo-500/60 transition-colors group min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <CirclePlay size={16} strokeWidth={2} className="text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">Resume</p>
                    <p className="text-indigo-400/70 text-xs mt-0.5 truncate max-w-[200px]">
                      {continueMode.topicName ?? grammarThreads[0]?.grammarTopicId}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} strokeWidth={2} className="text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            {continueMode.kind === "next" && (
              <button
                onClick={() =>
                  router.push(
                    `/grammar/session?topic_id=${encodeURIComponent(continueMode.topicId)}&level=${encodeURIComponent(continueMode.level)}`
                  )
                }
                className="flex items-center justify-between w-full px-5 py-4 rounded-2xl
                           bg-indigo-600/20 border border-indigo-500/40 hover:bg-indigo-600/30
                           hover:border-indigo-500/60 transition-colors group min-h-[44px]"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center">
                    <ArrowRight size={16} strokeWidth={2} className="text-indigo-400" />
                  </div>
                  <div className="text-left">
                    <p className="text-white text-sm font-semibold">Next Topic</p>
                    <p className="text-indigo-400/70 text-xs mt-0.5 truncate max-w-[200px]">
                      {continueMode.topicName ?? continueMode.topicId}
                    </p>
                  </div>
                </div>
                <ChevronRight size={16} strokeWidth={2} className="text-indigo-400 group-hover:translate-x-0.5 transition-transform" />
              </button>
            )}

            {/* Browse topics */}
            <button
              onClick={loadUnits}
              disabled={isLoading}
              className="flex items-center justify-between w-full px-5 py-4 rounded-2xl
                         bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/40
                         hover:bg-slate-800 transition-colors group min-h-[44px] disabled:opacity-50"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-700/60 flex items-center justify-center">
                  <AlignJustify size={16} strokeWidth={1.8} className="text-slate-400" />
                </div>
                <p className="text-slate-200 text-sm font-medium group-hover:text-white transition-colors">
                  Select any topic
                </p>
              </div>
              <ChevronRight size={16} strokeWidth={2} className="text-slate-500 group-hover:text-indigo-400 group-hover:translate-x-0.5 transition-all" />
            </button>

            {/* History */}
            {grammarThreads.length > 0 && (
              <div className="mt-2">
                <p className="text-xs text-slate-500 uppercase tracking-widest mb-3 px-1">History</p>
                <div className="flex flex-col gap-2">
                  {grammarThreads.map((thread) => (
                    <button
                      key={thread.id}
                      onClick={() =>
                        router.push(
                          `/grammar/session?topic_id=${encodeURIComponent(thread.grammarTopicId ?? "")}&level=${thread.grammarLevel ?? "B1"}&thread_id=${thread.id}`
                        )
                      }
                      className="flex items-center justify-between w-full px-4 py-3 rounded-xl
                                 bg-slate-800/40 border border-slate-700/30 hover:border-indigo-500/30
                                 hover:bg-slate-800/70 transition-colors group min-h-[44px]"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-7 h-7 flex-shrink-0 rounded-lg bg-indigo-500/10 flex items-center justify-center">
                          <MessageSquare size={14} strokeWidth={2} className="text-indigo-400/70" />
                        </div>
                        <div className="text-left min-w-0">
                          <p className="text-slate-200 text-sm font-medium truncate">{thread.title}</p>
                          {thread.grammarUnitName && (
                            <p className="text-slate-400 text-xs mt-0.5 truncate">{thread.grammarUnitName}</p>
                          )}
                          <p className="text-slate-500 text-xs mt-0.5">
                            {thread.grammarLevel} · {new Date(thread.lastUpdatedAt).toLocaleDateString("en-US", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                      </div>
                      <ChevronRight size={14} strokeWidth={2} className="text-slate-600 group-hover:text-indigo-400 flex-shrink-0 ml-2 group-hover:translate-x-0.5 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Unit list */}
        {view === "units" && (
          <div className="max-w-lg mx-auto">
            <div className="flex items-baseline justify-between mb-4 px-1">
              <p className="text-xs text-slate-500 uppercase tracking-widest">Select unit</p>
              {overallProgress && (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-sm font-semibold text-indigo-300">{overallProgress.pct}%</span>
                  <span className="text-xs text-slate-500">{overallProgress.completed}/{overallProgress.total}</span>
                  {overallProgress.label && (
                    <span className="text-[10px] text-slate-600">{overallProgress.label}</span>
                  )}
                </div>
              )}
            </div>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : (
              <UnitSelector units={units} onSelectUnit={loadTopics} completedByUnit={completedByUnit} />
            )}
          </div>
        )}

        {/* Topic list */}
        {view === "topics" && (
          <div className="max-w-lg mx-auto">
            <p className="text-xs text-slate-500 uppercase tracking-widest mb-4 px-1">
              Select topic
            </p>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Spinner />
              </div>
            ) : (
              <TopicSelector topics={topics} level={level} onSelectTopic={handleTopicSelect} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
