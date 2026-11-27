import { AnimatePresence, motion } from "framer-motion";
import { type ReactNode, type RefObject, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { cn } from "@/lib/cn";

/**
 * Floating panel anchored to a trigger. Rendered in a portal with fixed positioning so it is never
 * clipped by scroll containers (tables, dialogs). Flips above the trigger when there is no room below.
 */
export function Popover({
  anchor,
  open,
  onClose,
  children,
  className,
  align = "start",
  matchWidth = true,
}: {
  anchor: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  align?: "start" | "end";
  matchWidth?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; above: boolean } | null>(null);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      return;
    }
    const update = () => {
      const a = anchor.current?.getBoundingClientRect();
      if (!a) return;
      const ph = panel.current?.offsetHeight ?? 0;
      const pw = panel.current?.offsetWidth ?? a.width;
      const gap = 6;
      const roomBelow = window.innerHeight - a.bottom;
      const above = roomBelow < ph + gap + 8 && a.top > roomBelow;
      const top = above ? Math.max(8, a.top - gap - ph) : a.bottom + gap;
      const preferred = align === "end" ? a.right - pw : a.left;
      const left = Math.min(Math.max(8, preferred), window.innerWidth - pw - 8);
      setPos({ top, left, width: a.width, above });
    };
    update();
    const raf = requestAnimationFrame(update); // re-measure once the panel has its real size
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [open, anchor, align]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      const target = e.target as Node;
      if (panel.current?.contains(target) || anchor.current?.contains(target)) return;
      onClose();
    };
    document.addEventListener("pointerdown", onDown);
    return () => document.removeEventListener("pointerdown", onDown);
  }, [open, onClose, anchor]);

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={panel}
          data-popover
          initial={{ opacity: 0, y: pos?.above ? 4 : -4, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: pos?.above ? 4 : -4, scale: 0.98 }}
          transition={{ duration: 0.14, ease: "easeOut" }}
          style={{
            position: "fixed",
            top: pos?.top ?? -9999,
            left: pos?.left ?? -9999,
            minWidth: matchWidth ? pos?.width : undefined,
            transformOrigin: pos?.above ? "bottom" : "top",
          }}
          className={cn(
            "z-[70] rounded-2xl border border-line bg-surface-solid p-1 text-ink shadow-[0_18px_48px_-12px_rgb(0_0_0/0.45)]",
            className,
          )}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
