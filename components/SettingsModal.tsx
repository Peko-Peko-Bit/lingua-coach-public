"use client";

import React, { useRef } from "react";
import { Loader2, Camera, Sun, Moon, Monitor, Settings2, X, Check } from "lucide-react";
import { type ColorMode } from "@/lib/themes";
import { CHARACTERS } from "@/lib/characters";
import type { Profile } from "@/hooks/useProfile";
import { UserAuthSection } from "@/components/auth/UserAuthSection";
import { PROVIDER_CONFIGS, type ProviderType } from "@/lib/ai";

interface SettingsModalProps {
  isOpen:   boolean;
  onClose:  () => void;
  colorMode: ColorMode;
  onColorModeChange: (mode: ColorMode) => void;
  profile:          Profile;
  onCharacterChange: (id: string) => void;
  onUserAvatarChange: (file: File | null) => void;
  isResizingAvatar: boolean;
  provider: ProviderType;
  onProviderChange: (p: ProviderType) => void;
  lang: "ja" | "en" | "es";
  onLangChange: (lang: "ja" | "en" | "es") => void;
}

// ============================================================
// AvatarUpload UI (reusable)
// ============================================================
function AvatarUpload({
  label,
  avatar,
  defaultContent,
  onFileSelect,
  onReset,
  isResizing,
}: {
  label: string;
  avatar: string | null;
  defaultContent: React.ReactNode;
  onFileSelect: (file: File) => void;
  onReset: () => void;
  isResizing?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex flex-col items-center gap-2">
      <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest">
        {label}
      </p>

      {/* Avatar preview (click to select) */}
      <button
        type="button"
        onClick={() => !isResizing && inputRef.current?.click()}
        className="relative w-16 h-16 rounded-full overflow-hidden ring-2 ring-[var(--border)]
                   hover:ring-[var(--accent-border-focus)] transition-all group"
        title={isResizing ? "Processing…" : "Click to select image"}
      >
        {avatar ? (
          <img src={avatar} alt={label} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            {defaultContent}
          </div>
        )}
        {/* Hover overlay (always visible when resizing) */}
        <div className={`absolute inset-0 bg-black/40 flex items-center justify-center transition-opacity
                         ${isResizing ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}>
          {isResizing ? (
            <Loader2 size={20} className="animate-spin text-white" />
          ) : (
            <Camera size={20} strokeWidth={2} className="text-white" />
          )}
        </div>
      </button>

      {/* Hidden file input */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onFileSelect(file);
          e.target.value = "";
        }}
      />

      {/* Reset button */}
      {avatar && (
        <button
          type="button"
          onClick={onReset}
          className="text-[10px] text-[var(--text-dim)] hover:text-red-400 transition-colors"
        >
          Reset
        </button>
      )}
      {!avatar && (
        <span className="text-[10px] text-[var(--text-xdim)]">Not set</span>
      )}
    </div>
  );
}

// ============================================================
// Main modal
// ============================================================
const LANG_OPTIONS = [
  { value: "ja", label: "日本語" },
  { value: "en", label: "English" },
  { value: "es", label: "Español" },
] as const;

const COLOR_MODE_OPTIONS: { id: ColorMode; label: string; icon: React.ReactNode }[] = [
  { id: "light",  label: "Light",  icon: <Sun     size={16} strokeWidth={2} /> },
  { id: "dark",   label: "Dark",   icon: <Moon    size={16} strokeWidth={2} /> },
  { id: "system", label: "System", icon: <Monitor size={16} strokeWidth={2} /> },
];

export function SettingsModal({
  isOpen, onClose, colorMode, onColorModeChange,
  profile, onCharacterChange, onUserAvatarChange, isResizingAvatar,
  provider, onProviderChange, lang, onLangChange,
}: SettingsModalProps) {
  return (
    <div
      className={`fixed inset-0 z-[60] ${isOpen ? "pointer-events-auto" : "pointer-events-none"} sm:flex sm:items-center sm:justify-center`}
    >
      <div
        className={`absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-0"}`}
        onClick={onClose}
      />

      <div
        onClick={(e) => e.stopPropagation()}
        className={`
          absolute bottom-0 left-0 right-0 z-10
          bg-[var(--bg-sidebar)] border-t border-[var(--border)] shadow-2xl
          rounded-t-2xl max-h-[90vh] overflow-y-auto
          transition-transform duration-300 ease-out
          sm:relative sm:inset-auto
          sm:w-full sm:max-w-md sm:mx-4
          sm:rounded-2xl sm:border
          sm:translate-y-0
          sm:transition-[opacity,transform] sm:duration-200 sm:ease-in-out
          ${isOpen ? "translate-y-0 sm:opacity-100 sm:scale-100" : "translate-y-full sm:opacity-0 sm:scale-95"}
        `}
      >
        {/* Drag handle - mobile only */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-[var(--border)]" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-subtle)] sticky top-0 bg-[var(--bg-sidebar)] z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-5 h-5 rounded-md bg-[var(--accent-10)] flex items-center justify-center">
              <Settings2 size={12} strokeWidth={2} className="text-[var(--accent-text)]" />
            </div>
            <h2 className="text-[var(--text-primary)] text-sm font-semibold">Settings</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--text-dim)] hover:text-[var(--text-muted)]
                       hover:bg-[var(--bg-elevated)] transition-colors"
          >
            <X size={16} strokeWidth={2} />
          </button>
        </div>

        {/* Content */}
        <div className="px-5 py-4 space-y-5">

          {/* ── Profile section ── */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-4">
              Profile
            </p>

            {/* Character selection grid */}
            <div className="mb-4">
              <p className="text-[10px] font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-2">
                AI Tutor Character
              </p>
              <div className="grid grid-cols-2 gap-2">
                {CHARACTERS.map((char) => {
                  const isActive = profile.characterId === char.id;
                  return (
                    <button
                      key={char.id}
                      type="button"
                      onClick={() => onCharacterChange(char.id)}
                      className={`
                        flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition-all duration-150
                        ${isActive
                          ? "border-[var(--accent-border-focus)] bg-[var(--accent-10)]"
                          : "border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--accent-border)]"
                        }
                      `}
                    >
                      <img
                        src={char.avatarSrc}
                        alt={char.name}
                        className="w-10 h-10 rounded-full flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold truncate ${isActive ? "text-[var(--accent-text)]" : "text-[var(--text-secondary)]"}`}>
                          {char.name}
                        </p>
                        <p className="text-[10px] text-[var(--text-dim)] truncate">{char.description}</p>
                      </div>
                      {isActive && (
                        <div className="w-4 h-4 rounded-full bg-[var(--accent)] flex items-center justify-center flex-shrink-0">
                          <Check size={10} strokeWidth={3} className="text-[var(--accent-fg)]" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* User avatar */}
            <div className="flex justify-center mb-4">
              <AvatarUpload
                label="You"
                avatar={profile.userAvatar}
                defaultContent={
                  <div className="w-full h-full bg-[var(--bg-elevated)]
                                  flex items-center justify-center text-[var(--text-secondary)] text-xl font-bold">
                    K
                  </div>
                }
                onFileSelect={onUserAvatarChange}
                onReset={() => onUserAvatarChange(null)}
                isResizing={isResizingAvatar}
              />
            </div>

          </div>

          <div className="h-px bg-[var(--border-subtle)]" />

          {/* ── AI Model section ── */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">
              AI Model
            </p>
            <select
              value={provider}
              onChange={(e) => onProviderChange(e.target.value as ProviderType)}
              className="w-full text-sm bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--accent-border-focus)] cursor-pointer"
            >
              {Object.values(PROVIDER_CONFIGS).map((cfg) => (
                <option key={cfg.id} value={cfg.id}>{cfg.label}</option>
              ))}
            </select>
          </div>

          <div className="h-px bg-[var(--border-subtle)]" />

          {/* ── Language section ── */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">
              Language
            </p>
            <select
              value={lang}
              onChange={(e) => onLangChange(e.target.value as "ja" | "en" | "es")}
              className="w-full text-sm bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border)] rounded-xl px-3 py-2.5 focus:outline-none focus:border-[var(--accent-border-focus)] cursor-pointer"
            >
              {LANG_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
            <p className="text-[10px] text-[var(--text-xdim)] mt-1.5">
              Translation & grammar explanation language
            </p>
          </div>

          <div className="h-px bg-[var(--border-subtle)]" />

          {/* ── Color mode section ── */}
          <div>
            <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest mb-3">
              Appearance
            </p>
            <div className="grid grid-cols-3 gap-2">
              {COLOR_MODE_OPTIONS.map((opt) => {
                const isActive = colorMode === opt.id;
                return (
                  <button
                    key={opt.id}
                    onClick={() => onColorModeChange(opt.id)}
                    className={`
                      flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border transition-all duration-150
                      ${isActive
                        ? "border-[var(--accent-border-focus)] bg-[var(--accent-10)]"
                        : "border-[var(--border)] bg-[var(--bg-elevated)] hover:border-[var(--accent-border)]"
                      }
                    `}
                  >
                    <span className={isActive ? "text-[var(--accent-text)]" : "text-[var(--text-muted)]"}>
                      {opt.icon}
                    </span>
                    <span className={`text-[10px] font-semibold ${isActive ? "text-[var(--accent-text)]" : "text-[var(--text-secondary)]"}`}>
                      {opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[var(--border-subtle)] space-y-3">
          <p className="text-xs font-semibold text-[var(--text-dim)] uppercase tracking-widest">
            Account
          </p>
          <UserAuthSection />
        </div>
      </div>
    </div>
  );
}
