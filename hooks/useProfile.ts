"use client";

import { useState, useEffect } from "react";
import { DEFAULT_CHARACTER_ID } from "@/lib/characters";

const KEYS = {
  characterId: "profile_character_id",
  userAvatar:  "profile_user_avatar",
};

export interface Profile {
  characterId: string;
  userAvatar:  string | null;
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
  const [profile, setProfile] = useState<Profile>({
    characterId: DEFAULT_CHARACTER_ID,
    userAvatar:  null,
  });
  const [isResizing, setIsResizing] = useState(false);

  useEffect(() => {
    setProfile({
      characterId: localStorage.getItem(KEYS.characterId) ?? DEFAULT_CHARACTER_ID,
      userAvatar:  localStorage.getItem(KEYS.userAvatar)  ?? null,
    });
  }, []);

  const updateCharacter = (characterId: string) => {
    localStorage.setItem(KEYS.characterId, characterId);
    setProfile(p => ({ ...p, characterId }));
  };

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

  return { profile, updateCharacter, updateUserAvatar, isResizing };
}
