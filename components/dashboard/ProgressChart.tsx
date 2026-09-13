"use client";

import { useState, useEffect, useCallback } from "react";
import { Spinner } from "@/components/ui/Spinner";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";

interface ChartPoint {
  date:               string;
  transmaster_counts: number;
  chat_counts:        number;
  error_rate:         number;
}

interface ModeStats {
  total: number;
  green: number;
  yellow: number;
  red: number;
}

interface SummaryData {
  accuracy:  { current: number; previous: number; diff: number };
  grammar:   { completed: number; total: number };
  linguagym: {
    translation: ModeStats;
    listening:   ModeStats;
    dictation:   ModeStats;
  };
}

type Period = "7" | "30" | "all";

const SERIES = {
  transmaster_counts: { label: "LinguaGym",   color: "#1E3A5F" },
  chat_counts:        { label: "Chat",        color: "#93C5FD" },
  error_rate:         { label: "Error Rate",  color: "#F97316" },
} as const;

type SeriesKey = keyof typeof SERIES;

export function ProgressChart({ language }: { language: string }) {
  const [period, setPeriod]       = useState<Period>("30");
  const [chartData, setChartData] = useState<ChartPoint[]>([]);
  const [summary, setSummary]     = useState<SummaryData | null>(null);
  const [loading, setLoading]     = useState(true);
  const [hidden, setHidden]       = useState<Set<SeriesKey>>(new Set());

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const [chart, sum] = await Promise.all([
          fetch(`/api/dashboard/chart?language=${language}&period=${period}`).then((r) => r.json()),
          fetch(`/api/dashboard/summary?language=${language}`).then((r) => r.json()),
        ]);
        const { dates, transmaster_counts, chat_counts, error_rate } = chart as {
          dates: string[];
          transmaster_counts: number[];
          chat_counts: number[];
          error_rate: number[];
        };
        const points: ChartPoint[] = (dates ?? []).map((date, i) => ({
          date,
          transmaster_counts: transmaster_counts[i] ?? 0,
          chat_counts:        chat_counts[i]        ?? 0,
          error_rate:         error_rate[i]          ?? 0,
        }));
        if (!cancelled) {
          setChartData(points);
          setSummary(sum as SummaryData);
        }
      } catch {
        // ignore — loading is cleared in finally
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [language, period]);

  const toggleSeries = useCallback((key: SeriesKey) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }, []);

  const emptyMode: ModeStats = { total: 0, green: 0, yellow: 0, red: 0 };
  const linguagym = summary?.linguagym ?? {
    translation: emptyMode,
    listening:   emptyMode,
    dictation:   emptyMode,
  };

  return (
    <div className="pt-4 mt-4 border-t border-[var(--border)]">
      {/* Period toggle */}
      <div className="flex items-center justify-end mb-4 gap-3">
        {(["7", "30", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className={`text-xs transition-colors ${
              period === p
                ? "text-[var(--text-primary)] font-bold underline underline-offset-2"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {p === "7" ? "7 DAYS" : p === "30" ? "30 DAYS" : "ALL TIME"}
          </button>
        ))}
      </div>

      <div className="flex-1 h-48">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <Spinner />
            </div>
          ) : chartData.length === 0 ? (
            <div className="h-full flex items-center justify-center text-[var(--text-muted)] text-sm">
              No data for this period
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData} margin={{ top: 4, right: 32, bottom: 4, left: -24 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fill: "#888", fontSize: 10 }}
                  tickFormatter={(v: string) => v.slice(5)}
                  interval="preserveStartEnd"
                />
                <YAxis
                  yAxisId="count"
                  tick={{ fill: "#888", fontSize: 10 }}
                  allowDecimals={false}
                />
                <YAxis
                  yAxisId="rate"
                  orientation="right"
                  tick={{ fill: "#F97316", fontSize: 10 }}
                  tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
                  domain={[0, 1]}
                />
                <Tooltip
                  contentStyle={{
                    background: "#2a2a2a",
                    border: "1px solid #444",
                    borderRadius: 8,
                    color: "#f5f5f5",
                    fontSize: 12,
                  }}
                  labelStyle={{ color: "#aaa" }}
                  formatter={(value, name) => {
                    const v = value as number;
                    if (name === "error_rate") return [`${Math.round(v * 100)}%`, "Error Rate"];
                    if (name === "transmaster_counts") return [v, "LinguaGym"];
                    if (name === "chat_counts") return [v, "Chat"];
                    return [v, String(name)];
                  }}
                />
                <Legend
                  onClick={(e) => toggleSeries(e.dataKey as SeriesKey)}
                  formatter={(value: string) => {
                    const key = value as SeriesKey;
                    return (
                      <span style={{ color: hidden.has(key) ? "#555" : "#ccc", fontSize: 11, cursor: "pointer" }}>
                        {SERIES[key]?.label ?? value}
                      </span>
                    );
                  }}
                />
                <Bar
                  yAxisId="count"
                  dataKey="transmaster_counts"
                  stackId="practice"
                  fill="#1E3A5F"
                  hide={hidden.has("transmaster_counts")}
                />
                <Bar
                  yAxisId="count"
                  dataKey="chat_counts"
                  stackId="practice"
                  fill="#93C5FD"
                  hide={hidden.has("chat_counts")}
                />
                <Line
                  yAxisId="rate"
                  type="monotone"
                  dataKey="error_rate"
                  stroke="#F97316"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  hide={hidden.has("error_rate")}
                />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </div>

      {/* LinguaGym breakdown */}
      <div className="mt-4 space-y-2">
        <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-1">
          LinguaGym Score
        </p>
        {(["translation", "listening", "dictation"] as const).map((mode) => {
          const stats = linguagym[mode];
          const filled = stats.green + stats.yellow + stats.red;
          const base   = filled || 1;
          const gPct   = Math.round((stats.green  / base) * 100);
          const yPct   = Math.round((stats.yellow / base) * 100);
          const rPct   = filled > 0 ? 100 - gPct - yPct : 0;
          return (
            <div key={mode} className="flex items-center gap-2">
              <span className="w-20 text-[11px] text-[var(--text-muted)] capitalize flex-shrink-0">
                {mode}
              </span>
              <div className="flex flex-1 h-2 rounded-full overflow-hidden bg-[var(--bg-elevated)]">
                {filled > 0 ? (
                  <>
                    <div className="bg-green-400  transition-all" style={{ width: `${gPct}%` }} />
                    <div className="bg-yellow-400 transition-all" style={{ width: `${yPct}%` }} />
                    <div className="bg-red-400    transition-all" style={{ width: `${rPct}%` }} />
                  </>
                ) : (
                  <div className="bg-gray-600 w-full" />
                )}
              </div>
              <span className="text-[10px] text-[var(--text-muted)] whitespace-nowrap flex-shrink-0">
                {stats.green}✓ {stats.yellow}△ {stats.red}✗
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
