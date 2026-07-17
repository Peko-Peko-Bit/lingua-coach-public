"use client";

/**
 * components/MarkdownMessage.tsx
 *
 * Shared Markdown rendering component for chat screens.
 * - ReactMarkdown + remark-gfm
 * - Code blocks are rendered with a copy button via CodeBlock
 * - theme: "default" (violet accent) | "indigo" (grammar mode)
 */

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// ============================================================
// CodeBlock — code block with copy button
// ============================================================
function extractText(node: React.ReactNode): string {
  if (typeof node === "string") return node;
  if (typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (node && typeof node === "object" && "props" in node) {
    return extractText(
      (node as React.ReactElement<{ children?: React.ReactNode }>).props.children
    );
  }
  return "";
}

function CodeBlock({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    const text = extractText(children);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const el = document.createElement("textarea");
      el.value = text;
      el.style.cssText = "position:fixed;opacity:0;pointer-events:none";
      document.body.appendChild(el);
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group mb-2">
      <pre className="bg-[var(--bg-deep,#0d1117)] border border-[var(--border,rgba(255,255,255,0.08))] rounded-xl px-4 py-3 overflow-x-auto text-[0.8em] font-mono text-[#a0d0b0] pr-16">
        {children}
      </pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-[10px] font-medium rounded-md
                   bg-[var(--bg-elevated,#1a1f2e)] border border-[var(--border,rgba(255,255,255,0.08))] text-[var(--text-dim,#6b7280)]
                   hover:border-indigo-500/40 hover:text-indigo-300
                   opacity-0 group-hover:opacity-100 transition-all duration-150"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
    </div>
  );
}

// ============================================================
// MarkdownMessage
// ============================================================
interface MarkdownMessageProps {
  content: string;
  /** "default": violet accent (normal chat), "indigo": grammar mode */
  theme?: "default" | "indigo";
}

export function MarkdownMessage({ content, theme = "default" }: MarkdownMessageProps) {
  const accentCode  = theme === "indigo" ? "text-indigo-300"  : "text-[var(--accent-text)]";
  const accentBg    = theme === "indigo" ? "bg-slate-900"      : "bg-[var(--bg-base)]";
  const quoteBorder = theme === "indigo" ? "border-indigo-500/40" : "border-[var(--accent-border-hover)]";
  const quoteText   = theme === "indigo" ? "text-slate-400"    : "text-[var(--text-secondary)]";

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        p:      ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul:     ({ children }) => <ul className="list-disc list-inside mb-2 space-y-0.5">{children}</ul>,
        ol:     ({ children }) => <ol className="list-decimal list-inside mb-2 space-y-0.5">{children}</ol>,
        li:     ({ children }) => <li className="text-[var(--text-primary,#e2e8f0)]">{children}</li>,
        strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
        em:     ({ children }) => <em className={`italic ${quoteText}`}>{children}</em>,
        code:   ({ inline, children }: { inline?: boolean; children?: React.ReactNode }) =>
          inline ? (
            <code className={`${accentBg} ${accentCode} px-1.5 py-0.5 rounded text-[0.8em] font-mono`}>
              {children}
            </code>
          ) : (
            <code>{children}</code>
          ),
        pre:        ({ children }) => <CodeBlock>{children}</CodeBlock>,
        table:      ({ children }) => (
          <div className="overflow-x-auto mb-2">
            <table className="w-full text-xs border-collapse">{children}</table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-[var(--bg-base,#0d1117)]">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-[var(--border,rgba(255,255,255,0.08))] px-3 py-1.5 text-left text-[var(--text-secondary,#94a3b8)] font-semibold uppercase tracking-wide text-[0.75em]">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-[var(--border,rgba(255,255,255,0.08))] px-3 py-1.5 text-[var(--text-primary,#e2e8f0)]">
            {children}
          </td>
        ),
        blockquote: ({ children }) => (
          <blockquote className={`border-l-2 ${quoteBorder} pl-3 ${quoteText} italic mb-2`}>
            {children}
          </blockquote>
        ),
        h1: ({ children }) => <h1 className="text-base font-bold text-white mb-1">{children}</h1>,
        h2: ({ children }) => <h2 className="text-sm font-bold text-white mb-1">{children}</h2>,
        h3: ({ children }) => <h3 className="text-sm font-semibold text-[var(--text-primary,#e2e8f0)] mb-1">{children}</h3>,
        a:  ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className={`${accentCode} underline hover:opacity-80`}
          >
            {children}
          </a>
        ),
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
