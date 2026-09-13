"use client";

import Link from "next/link";
import { ExternalLink } from "lucide-react";

type AppNavProps = {
  current: "chat" | "grammar" | "dashboard";
};

const LINGUAGYM_URL = process.env.NEXT_PUBLIC_LINGUAGYM_URL ?? "";

const INTERNAL_ITEMS = [
  { id: "chat",      label: "Chat",      href: "/" },
  { id: "grammar",   label: "Grammar",   href: "/grammar" },
  { id: "dashboard", label: "Dashboard", href: "/dashboard" },
] as const;

export function AppNav({ current }: AppNavProps) {
  return (
    <nav className="flex items-center gap-1">
      {INTERNAL_ITEMS.map((item) => (
        <Link
          key={item.id}
          href={item.href}
          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors ${
            item.id === current
              ? "bg-[var(--accent-10)] text-[var(--accent-text)]"
              : "text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)]"
          }`}
        >
          {item.label}
        </Link>
      ))}
      {LINGUAGYM_URL && (
        <a
          href={LINGUAGYM_URL}
          className="px-2.5 py-1 rounded-lg text-xs font-medium text-[var(--text-muted)] hover:text-[var(--text-secondary)] hover:bg-[var(--bg-elevated)] transition-colors"
        >
          LinguaGym <ExternalLink size={12} className="inline-block ml-0.5" />
        </a>
      )}
    </nav>
  );
}

