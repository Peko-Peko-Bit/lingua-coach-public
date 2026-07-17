"use client";

import { useState } from "react";
import { BadgeCheck, Star } from "lucide-react";

interface SessionEndDialogProps {
  isOpen:    boolean;
  isSaving:  boolean;
  onCancel:  () => void;
  onConfirm: (score: number) => void;
}

export function SessionEndDialog({
  isOpen,
  isSaving,
  onCancel,
  onConfirm,
}: SessionEndDialogProps) {
  const [hovered, setHovered] = useState(0);
  const [selected, setSelected] = useState(0);

  if (!isOpen) return null;

  const displayRating = hovered || selected;

  const handleConfirm = () => {
    if (selected === 0) return;
    onConfirm(selected * 20);
  };

  const handleCancel = () => {
    setHovered(0);
    setSelected(0);
    onCancel();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleCancel}
      />

      {/* Dialog */}
      <div className="relative z-10 w-full max-w-sm bg-slate-900 border border-slate-700/60 rounded-2xl p-6 shadow-2xl">
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-indigo-500/15 border border-indigo-500/25 flex items-center justify-center flex-shrink-0">
            <BadgeCheck size={20} strokeWidth={1.8} className="text-indigo-400" />
          </div>
          <div>
            <h2 className="text-white font-semibold text-base">Complete Topic</h2>
            <p className="text-slate-400 text-sm mt-0.5">Please rate your understanding</p>
          </div>
        </div>

        {/* 5 stars */}
        <div className="flex justify-center gap-3 py-2">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              disabled={isSaving}
              onClick={() => setSelected(star)}
              onMouseEnter={() => setHovered(star)}
              onMouseLeave={() => setHovered(0)}
              className="w-11 h-11 flex items-center justify-center transition-transform active:scale-90 disabled:opacity-40"
            >
              <Star
                size={36}
                strokeWidth={1.5}
                className={`transition-colors ${
                  star <= displayRating
                    ? "text-amber-400 fill-amber-400"
                    : "text-slate-600 fill-transparent"
                }`}
              />
            </button>
          ))}
        </div>

        <div className="flex gap-3 mt-5">
          <button
            onClick={handleCancel}
            disabled={isSaving}
            className="flex-1 py-2.5 rounded-xl border border-slate-700 text-slate-300
                       hover:bg-slate-800 transition-colors text-sm font-medium disabled:opacity-40 min-h-[44px]"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isSaving || selected === 0}
            className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white
                       transition-colors text-sm font-medium disabled:opacity-40 min-h-[44px]
                       flex items-center justify-center gap-2"
          >
            {isSaving ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Saving…
              </>
            ) : (
              "Save and End"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
