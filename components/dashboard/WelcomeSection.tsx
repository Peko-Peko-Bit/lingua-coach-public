"use client";

import { useState, useEffect, useSyncExternalStore } from "react";
import Image from "next/image";
import Link from "next/link";
import { ProgressChart } from "./ProgressChart";

// Read the stored profile name without a hydration mismatch (server → "").
const noopSubscribe = () => () => {};
function readUserName(): string {
  if (typeof window === "undefined") return "";
  try { return localStorage.getItem("profile_username") ?? ""; } catch { return ""; }
}

interface WelcomeSectionProps {
  accuracy:        number | null; // null = no practice data yet (distinct from a genuine 0%)
  diff:            number | null;
  grammarCompleted: number;
  grammarTotal:    number;
  language:        string;
}

export function WelcomeSection({
  accuracy, diff, grammarCompleted, grammarTotal, language,
}: WelcomeSectionProps) {
  const userName = useSyncExternalStore(noopSubscribe, readUserName, () => "");
  const [showProgress, setShowProgress] = useState(false);
  const [showPopup, setShowPopup]     = useState(false);

  useEffect(() => {
    if (diff === null || diff <= 0) return;
    // Defer the show to the next frame so it isn't a synchronous setState
    // during the effect (avoids the cascading-render lint rule).
    const raf = requestAnimationFrame(() => setShowPopup(true));
    const t = setTimeout(() => setShowPopup(false), 3000);
    return () => { cancelAnimationFrame(raf); clearTimeout(t); };
  }, [diff]);

  const grammarPct = grammarTotal > 0 ? Math.round((grammarCompleted / grammarTotal) * 100) : 0;

  return (
    <div className="bg-[var(--bg-surface)] rounded-2xl p-6 relative overflow-hidden">
      {/* Top row */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        {/* Avatar + accuracy */}
        <div className="flex items-center gap-4">
          <Image
            src="/characters/Roberta.png"
            alt="Roberta"
            width={56}
            height={56}
            className="rounded-full flex-shrink-0"
          />
          <div>
            <p className="text-sm text-[var(--text-muted)]">
              Bienvenido{userName ? `, ${userName}` : ""}
            </p>
            {accuracy === null ? (
              <div>
                <span className="text-3xl font-bold text-[var(--text-primary)]">
                  Accuracy <span className="text-[var(--text-dim)]">—</span>
                </span>
                <p className="text-sm text-[var(--text-muted)] mt-0.5">
                  Start practicing to see your accuracy
                </p>
              </div>
            ) : (
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="text-3xl font-bold text-[var(--text-primary)]">
                  Accuracy {accuracy}%
                </span>
                {diff !== null && diff !== 0 && (
                  <span className={`text-sm font-semibold ${diff > 0 ? "text-green-400" : "text-red-400"}`}>
                    {diff > 0 ? "↑ +" : "↓ "}{diff}%{" "}
                    <span className="text-[var(--text-muted)] font-normal">vs last week</span>
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Grammar progress */}
        <div className="flex items-center gap-3 flex-shrink-0">
          <div>
            <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-1.5">
              Grammar Mode: {grammarCompleted}/{grammarTotal} topics completed
            </p>
            <div className="w-48 h-2 bg-[var(--bg-elevated)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--accent)] rounded-full transition-all duration-500"
                style={{ width: `${grammarPct}%` }}
              />
            </div>
          </div>
          <Link
            href="/grammar"
            className="px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border)] rounded-lg text-xs font-semibold text-[var(--text-primary)] hover:bg-[var(--bg-deep)] transition-colors whitespace-nowrap"
          >
            Go to Grammar
          </Link>
        </div>
      </div>

      {/* View Progress toggle */}
      <button
        onClick={() => setShowProgress((p) => !p)}
        className="mt-4 flex items-center gap-1 text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors uppercase tracking-widest"
      >
        View Progress{" "}
        <span className={`transition-transform duration-200 inline-block ${showProgress ? "rotate-180" : ""}`}>
          ▼
        </span>
      </button>

      {showProgress && <ProgressChart language={language} />}

      {/* Roberta accuracy popup */}
      {showPopup && (
        <div className="absolute bottom-4 right-4 flex items-end gap-2 z-10">
          <div className="bg-white text-gray-800 rounded-2xl rounded-br-none px-4 py-2 shadow-xl text-sm font-medium">
            ¡Muy bien! Your accuracy improved!
          </div>
          <Image
            src="/characters/Roberta.png"
            alt="Roberta"
            width={64}
            height={64}
            className="rounded-full"
          />
        </div>
      )}
    </div>
  );
}
