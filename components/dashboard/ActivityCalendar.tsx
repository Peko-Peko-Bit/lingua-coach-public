"use client";

import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/Spinner";

interface ActivityCalendarProps {
  language: string;
}

const DOT_COLORS: Record<string, string> = {
  chat:            "#3B82F6",
  grammar:         "#A855F7",
  gym_translation: "#22C55E",
  gym_listening:   "#F97316",
  gym_dictation:   "#EAB308",
};

const ACTIVITY_LABELS: Record<string, string> = {
  chat:            "Chat",
  grammar:         "Grammar",
  gym_translation: "Gym",
  gym_listening:   "Listening",
  gym_dictation:   "Dictation",
};

const DAY_LABELS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

function getCalendarCells(year: number, month: number): (number | null)[] {
  const firstDow = (new Date(year, month - 1, 1).getDay() + 6) % 7; // Mon=0
  const daysInMonth = new Date(year, month, 0).getDate();
  const cells: (number | null)[] = Array(firstDow).fill(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function ActivityCalendar({ language }: ActivityCalendarProps) {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [data, setData]   = useState<Record<string, string[]>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/dashboard/calendar?year=${year}&month=${month}&language=${language}`);
        const d = await r.json();
        if (!cancelled) setData(d as Record<string, string[]>);
      } catch {
        // ignore — loading is cleared in finally
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [year, month, language]);

  const prevMonth = () => {
    if (month === 1) { setYear((y) => y - 1); setMonth(12); }
    else setMonth((m) => m - 1);
  };

  const nextMonth = () => {
    if (month === 12) { setYear((y) => y + 1); setMonth(1); }
    else setMonth((m) => m + 1);
  };

  const cells = getCalendarCells(year, month);
  const padded = `${year}-${String(month).padStart(2, "0")}`;

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-bold text-[var(--text-primary)] uppercase tracking-wide">
          {MONTH_NAMES[month - 1]} {year}
        </p>
        <div className="flex gap-2">
          <button
            onClick={prevMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            ◀
          </button>
          <button
            onClick={nextMonth}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
          >
            ▶
          </button>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 mb-1">
        {DAY_LABELS.map((d) => (
          <div key={d} className="text-center text-[10px] font-semibold text-[var(--text-dim)] py-1">
            {d}
          </div>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="h-48 flex items-center justify-center">
          <Spinner />
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-px">
          {cells.map((day, idx) => {
            if (day === null) {
              return <div key={idx} className="min-h-[52px]" />;
            }
            const dateKey = `${padded}-${String(day).padStart(2, "0")}`;
            const activities = data[dateKey] ?? [];
            const isToday =
              day === now.getDate() &&
              month === now.getMonth() + 1 &&
              year === now.getFullYear();

            return (
              <div
                key={idx}
                className={`min-h-[52px] p-1 rounded-lg flex flex-col gap-0.5 ${
                  isToday ? "bg-[var(--accent-10)] ring-1 ring-[var(--accent-border)]" : ""
                }`}
              >
                <span className={`text-xs font-medium text-center ${
                  isToday ? "text-[var(--accent-text)]" : "text-[var(--text-secondary)]"
                }`}>
                  {day}
                </span>
                <div className="flex flex-wrap gap-0.5 justify-center">
                  {activities.map((act) => (
                    <span
                      key={act}
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: DOT_COLORS[act] ?? "#888" }}
                      title={ACTIVITY_LABELS[act] ?? act}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex flex-wrap gap-3 mt-3 pt-3 border-t border-[var(--border)]">
        {Object.entries(ACTIVITY_LABELS).map(([key, label]) => (
          <span key={key} className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: DOT_COLORS[key] }}
            />
            {label.toUpperCase()}
          </span>
        ))}
      </div>
    </div>
  );
}
