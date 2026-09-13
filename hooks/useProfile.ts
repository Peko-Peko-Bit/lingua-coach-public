"use client";

import { useState, useEffect } from "react";

// The AI tutor character is NOT part of the profile: it is fixed per thread
// (threads.character_id). See lib/character-preference.ts for the "last
// selected character" used to pre-select the picker.
const KEYS = {
  userAvatar: "profile_user_avatar",
};

export interface Profile {
  userAvatar: string | null;
}

/** Resize image to at most maxPx px and return a JPEG data URL */
async function resizeImage(file: File, maxPx = 256): Promise<string> {
  return new Promise((resolve, reject) => {
    const img  = new Image();
    const url  = URL.createObjectURL(file);
    img.onload = () => {
      const scale = Math.min(1, maxPx / Math.max(img.width, img.height));
      const w     = Math.round(img.width  * scale);
      const h     = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width  = w;
      canvas.height = h;
      canvas.getContext("2d")!.drawImage(img, 0, 0, w, h);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Image load failed")); };
    img.src = url;
  });
}

export function useProfile() {
  const [profile, setProfile] = useState<Profile>({ userAvatar: null });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    setProfile({ userAvatar: localStorage.getItem(KEYS.userAvatar) ?? null });
  }, []);

  const updateUserAvatar = async (file: File | null) => {
    if (!file) {
      localStorage.removeItem(KEYS.userAvatar);
      setProfile(p => ({ ...p, userAvatar: null }));
      return;
    }
    setIsResizing(true);
    try {
      const dataUrl = await resizeImage(file);
      localStorage.setItem(KEYS.userAvatar, dataUrl);
      setProfile(p => ({ ...p, userAvatar: dataUrl }));
    } finally {
      setIsResizing(false);
    }
  };

  return { profile, updateUserAvatar, isResizing };
}
