"use client";

import { ChevronRight } from "lucide-react";
import type { GrammarTopic } from "@/lib/db/grammar";

interface TopicSelectorProps {
  topics:          GrammarTopic[];
  level:           string;
  onSelectTopic:   (topic: GrammarTopic) => void;
}

export function TopicSelector({ topics, onSelectTopic }: TopicSelectorProps) {
  // Group by chapter
  const grouped = topics.reduce<Record<string, GrammarTopic[]>>((acc, topic) => {
    const key = topic.chapter ?? "";
    if (!acc[key]) acc[key] = [];
    acc[key].push(topic);
    return acc;
  }, {});

  const chapters = Object.keys(grouped).sort();

  return (
    <div className="flex flex-col gap-4">
      {chapters.map((chapter) => (
        <div key={chapter}>
          {chapter && (
            <p className="text-xs font-semibold text-indigo-400/60 uppercase tracking-widest mb-2 px-1">
              {chapter}
            </p>
          )}
          <div className="flex flex-col gap-1.5">
            {grouped[chapter].map((topic) => (
              <button
                key={topic.id}
                onClick={() => onSelectTopic(topic)}
                className="flex items-center justify-between w-full px-4 py-3 rounded-xl
                           bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/40
                           hover:bg-slate-800 transition-colors text-left group min-h-[44px]"
              >
                <div className="flex items-start gap-3 min-w-0">
                  <span className="text-xs font-mono text-indigo-400/70 flex-shrink-0 mt-0.5">{topic.topic_id}</span>
                  <div className="min-w-0">
                    <span className="text-sm text-slate-300 group-hover:text-white transition-colors truncate block">
                      {topic.topic_name ?? topic.topic_id}
                    </span>
                    {topic.examples.length > 0 && (
                      <div className="mt-0.5 space-y-0.5">
                        {topic.examples.slice(0, 2).map((ex, i) => (
                          <p key={i} className="text-xs text-slate-600 truncate italic">{ex}</p>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <ChevronRight size={16} strokeWidth={2} className="flex-shrink-0 ml-2 mt-0.5 text-slate-600 group-hover:text-indigo-400 transition-colors" />
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
