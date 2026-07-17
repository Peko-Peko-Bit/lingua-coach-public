"use client";

import { ChevronRight } from "lucide-react";
import type { GrammarUnit } from "@/lib/db/grammar";

interface UnitSelectorProps {
  units:                  GrammarUnit[];
  onSelectUnit:           (unit: GrammarUnit) => void;
  completedByUnit?:       Map<string, number>;
}

function RingProgress({ completed, total }: { completed: number; total: number }) {
  const r    = 14;
  const circ = 2 * Math.PI * r;
  const fill = total > 0 ? (completed / total) * circ : 0;
  const done = total > 0 && completed >= total;

  return (
    <div className="relative w-8 h-8 flex-shrink-0">
      <svg viewBox="0 0 36 36" className="w-8 h-8 -rotate-90">
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3.5"
          stroke="currentColor" className="text-slate-700" />
        <circle cx="18" cy="18" r={r} fill="none" strokeWidth="3.5"
          stroke="currentColor" strokeLinecap="round"
          strokeDasharray={`${fill} ${circ}`}
          className={done ? "text-emerald-400" : "text-indigo-400"} />
      </svg>
      <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold
                        ${done ? "text-emerald-300" : "text-slate-300"}`}>
        {completed}
      </span>
    </div>
  );
}

export function UnitSelector({ units, onSelectUnit, completedByUnit }: UnitSelectorProps) {
  // Move advanced units to the end
  const sorted = [...units].sort((a, b) => {
    if (a.advanced !== b.advanced) return a.advanced ? 1 : -1;
    return a.order - b.order;
  });

  return (
    <div className="flex flex-col gap-2">
      {sorted.map((unit) => {
        const completed = completedByUnit?.get(unit.name_ja) ?? 0;
        return (
          <button
            key={unit.unit_id}
            onClick={() => onSelectUnit(unit)}
            className="flex items-center justify-between w-full px-4 py-3.5 rounded-xl
                       bg-slate-800/60 border border-slate-700/50 hover:border-indigo-500/40
                       hover:bg-slate-800 transition-colors text-left group min-h-[44px]"
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className="text-xs font-mono text-indigo-400/70 flex-shrink-0">{unit.unit_id}</span>
              <span className="text-sm text-slate-200 group-hover:text-white transition-colors truncate">
                {unit.name_ja}
              </span>
              {unit.advanced && (
                <span className="flex-shrink-0 text-[10px] font-semibold px-1.5 py-0.5 rounded
                                 bg-amber-500/15 text-amber-400 border border-amber-500/20">
                  Advanced
                </span>
              )}
            </div>
            <div className="flex items-center gap-2.5 flex-shrink-0 ml-2">
              <span className="text-xs text-slate-500">{unit.topic_count} topics</span>
              <RingProgress completed={completed} total={unit.topic_count} />
              <ChevronRight size={16} strokeWidth={2} className="text-slate-600 group-hover:text-indigo-400 transition-colors" />
            </div>
          </button>
        );
      })}
    </div>
  );
}
