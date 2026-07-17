"use client";

import { useRouter } from "next/navigation";
import { BookOpen } from "lucide-react";

interface GrammarModeToggleProps {
  className?: string;
}

export function GrammarModeToggle({ className = "" }: GrammarModeToggleProps) {
  const router = useRouter();

  return (
    <button
      onClick={() => router.push("/grammar")}
      title="Grammar Learning Mode"
      className={`p-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10
                  text-indigo-300 hover:bg-indigo-500/20 hover:border-indigo-500/50 transition-colors ${className}`}
    >
      <BookOpen size={16} strokeWidth={1.8} />
    </button>
  );
}
