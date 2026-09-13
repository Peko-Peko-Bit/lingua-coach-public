"use client";

import { useState, useEffect } from "react";
import React from "react";
import Link from "next/link";
import {
  LayoutDashboard, BookOpen, MessageCircleMore, BookMarked,
  Settings2, HelpCircle, ArrowLeftRight, ExternalLink, ArrowLeft, Play, Sparkles,
} from "lucide-react";
import { useLanguage } from "@/hooks/useLanguage";
import { useUser } from "@/hooks/useUser";
import { WelcomeSection } from "@/components/dashboard/WelcomeSection";
import { FullScreenLoader } from "@/components/ui/FullScreenLoader";
import { ActivityCalendar } from "@/components/dashboard/ActivityCalendar";
import { ErrorInsights } from "@/components/dashboard/ErrorInsights";
import { VocabularyPanel } from "@/components/dashboard/VocabularyPanel";

const LINGUAGYM_URL = process.env.NEXT_PUBLIC_LINGUAGYM_URL ?? "";

interface SummaryData {
  accuracy:  { current: number | null; previous: number | null; diff: number | null };
  grammar:   { completed: number; total: number };
  linguagym: {
    translation: { total: number; green: number; yellow: number; red: number };
    listening:   { total: number; green: number; yellow: number; red: number };
    dictation:   { total: number; green: number; yellow: number; red: number };
  };
}

// ============================================================
// Dashboard sidebar nav
// ============================================================
function DashboardSidebar() {
  return (
    <aside className="hidden lg:flex flex-col w-56 flex-shrink-0 bg-[var(--bg-sidebar)] border-r border-[var(--border)] h-full">
      {/* Header */}
      <div className="px-5 pt-6 pb-4 border-b border-[var(--border)]">
        <p className="text-base font-bold text-[var(--text-primary)]">LinguaCoach</p>
        <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mt-0.5">
          Performance Mode
        </p>
      </div>

      {/* Start Practice */}
      <div className="px-4 pt-4">
        <Link
          href="/"
          className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white rounded-xl text-sm font-bold transition-colors"
        >
          Start Practice <Play size={14} className="inline-block ml-1" />
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex flex-col gap-1 px-3 pt-4 flex-1">
        <NavItem href="/dashboard"  label="Dashboard"    icon={<LayoutDashboard size={16} strokeWidth={2} />} active />
        <NavItem href="/grammar"    label="Curriculum"   icon={<BookOpen size={16} strokeWidth={2} />} />
        <NavItem href="/"           label="Chat"         icon={<MessageCircleMore size={16} strokeWidth={2} />} />
        <NavItem href="/vocabulary" label="Vocabulary"   icon={<BookMarked size={16} strokeWidth={2} />} />
        {LINGUAGYM_URL && (
          <a
            href={LINGUAGYM_URL}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
          >
            <ArrowLeftRight size={16} strokeWidth={1.8} className="flex-shrink-0" />
            LinguaGym <ExternalLink size={12} className="inline-block ml-0.5" />
          </a>
        )}
      </nav>

      {/* Bottom */}
      <div className="px-3 pb-4 border-t border-[var(--border)] pt-3">
        <NavItem href="/" label="Settings" icon={<Settings2 size={16} strokeWidth={2} />} />
        <NavItem href="/" label="Support"  icon={<HelpCircle size={16} strokeWidth={2} />} />
      </div>
    </aside>
  );
}

function NavItem({
  href, label, icon, active = false,
}: {
  href: string; label: string; icon: React.ReactNode; active?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
        active
          ? "bg-[var(--accent-10)] text-[var(--accent-text)] font-semibold"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] hover:text-[var(--text-primary)]"
      }`}
    >
      <span className="flex-shrink-0">{icon}</span>
      {label}
    </Link>
  );
}

// ============================================================
// Page
// ============================================================
export default function DashboardPage() {
  const { language } = useLanguage();
  const { user } = useUser();
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);

  // Guests are seeded with demo conversations on sign-in (app/api/guest/seed),
  // so say so rather than letting the numbers read as someone's real history.
  const isGuest = user?.is_anonymous === true;

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const r = await fetch(`/api/dashboard/summary?language=${language}`);
        const d = await r.json();
        if (!cancelled) setSummary(d as SummaryData);
      } catch {
        // ignore — loading is cleared in finally
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [language]);

  return (
    <div className="flex h-[var(--app-height,100dvh)] bg-[var(--bg-base)] font-sans">
      <DashboardSidebar />

      <main className="flex-1 overflow-y-auto">
        {/* Mobile nav bar */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--border)] bg-[var(--bg-sidebar)]">
          <p className="text-sm font-bold text-[var(--text-primary)]">Dashboard</p>
          <Link href="/" className="text-xs font-semibold text-[var(--accent-text)]">
            <ArrowLeft size={12} className="inline-block mr-1" /> Chat
          </Link>
        </div>

        {loading ? (
          <FullScreenLoader />
        ) : (
          <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-5">
            {isGuest && (
              <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl
                              bg-[var(--accent-10)] border border-[var(--accent-border)]
                              text-sm text-[var(--text-secondary)]">
                <Sparkles size={16} className="flex-shrink-0 mt-0.5 text-[var(--accent-text)]" />
                <p>
                  <span className="font-semibold text-[var(--accent-text)]">Sample data</span>
                  {" — guest accounts start with a demo history so you can explore the dashboard right away."}
                </p>
              </div>
            )}

            <WelcomeSection
              accuracy={summary?.accuracy.current ?? null}
              diff={summary?.accuracy.diff ?? null}
              grammarCompleted={summary?.grammar.completed ?? 0}
              grammarTotal={summary?.grammar.total ?? 0}
              language={language}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <ActivityCalendar language={language} />
              <ErrorInsights    language={language} />
            </div>

            <VocabularyPanel language={language} />
          </div>
        )}
      </main>
    </div>
  );
}

