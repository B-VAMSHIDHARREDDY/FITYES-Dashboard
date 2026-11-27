import { useEffect, useSyncExternalStore } from "react";

import { sound } from "@/lib/sound";

/** Reactive view of the sound-effects preference. */
export function useSoundPrefs() {
  const effects = useSyncExternalStore((cb) => sound.subscribe(cb), () => sound.effectsOn);
  return { effects };
}

const CLICKABLE = 'button, a[href], [role="tab"], select, summary, input[type="checkbox"], input[type="radio"]';

/** One delegated listener gives every interactive element the same click sound. */
export function useGlobalClickSounds() {
  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const el = (e.target as Element | null)?.closest(CLICKABLE);
      if (!el || (el as HTMLButtonElement).disabled || el.hasAttribute("data-no-sound")) return;
      sound.click();
    };
    document.addEventListener("pointerdown", onPointerDown, { capture: true });
    return () => document.removeEventListener("pointerdown", onPointerDown, { capture: true });
  }, []);
}
