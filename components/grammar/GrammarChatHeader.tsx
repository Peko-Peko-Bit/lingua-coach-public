"use client";

import { ChevronLeft } from "lucide-react";

interface GrammarChatHeaderProps {
  topicId:         string;
  topicName:       string | null;
  explanationLang: "ja" | "es";
  onLangToggle:    () => void;
  onBack:          () => void;
  onEnd:           () => void;
}

export function GrammarChatHeader({
  topicId,
  topicName,
  explanationLang,
  onLangToggle,
  onBack,
  onEnd,
}: GrammarChatHeaderProps) {
  return (
    <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-indigo-500/20 bg-slate-900/85 backdrop-blur-xl">
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-slate-400 hover:text-slate-200 transition-colors p-1.5 rounded-lg hover:bg-slate-800 min-w-[44px] min-h-[44px]"
        aria-label="Back"
      >
        <ChevronLeft size={16} strokeWidth={2} />
        <span className="text-sm hidden sm:inline">Back</span>
      </button>

      <div className="flex flex-col items-center min-w-0 px-2">
        <span className="text-xs font-mono text-indigo-400/70">{topicId}</span>
        {topicName && (
          <span className="text-sm font-medium text-slate-200 truncate max-w-[160px] sm:max-w-xs">
            {topicName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        {/* Explanation language toggle */}
        <button
          onClick={onLangToggle}
          title="Toggle explanation language"
          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold
                     border border-slate-700/60 bg-slate-800/60 text-slate-400
                     hover:border-indigo-500/40 hover:text-indigo-300 transition-colors min-h-[44px]"
        >
          <span className={explanationLang === "ja" ? "text-white" : "text-slate-600"}>JA</span>
          <span className="text-slate-600">/</span>
          <span className={explanationLang === "es" ? "text-white" : "text-slate-600"}>ES</span>
        </button>

        <button
          onClick={onEnd}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                     border border-indigo-500/30 bg-indigo-500/10 text-indigo-300
                     hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-colors min-h-[44px]"
        >
          End
        </button>
      </div>
    </div>
  );
}
