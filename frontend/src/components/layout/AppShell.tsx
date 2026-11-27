import { AnimatePresence, motion } from "framer-motion";
import { FlaskConical } from "lucide-react";
import { useLocation, useOutlet } from "react-router-dom";

import { useI18n } from "@/i18n/I18nProvider";
import { useSampleData } from "@/providers/useSampleData";
import { useGlobalClickSounds } from "@/providers/useSound";

import { TopNav } from "./TopNav";

export function AppShell() {
  useGlobalClickSounds();
  const { t } = useI18n();
  const sample = useSampleData();
  const location = useLocation();
  const outlet = useOutlet();
  // Animate between top-level sections only (not on query-string or sub-route changes).
  const section = location.pathname.split("/")[1] || "desk";

  return (
    <div className="mx-auto max-w-[1440px] px-4 pt-4 pb-16 sm:px-6">
      <TopNav />
      <AnimatePresence initial={false}>
        {sample.on && (
          <motion.div
            role="status"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl border border-brand-text/40 bg-brand-soft px-4 py-2.5 text-xs text-ink">
              <FlaskConical size={14} className="shrink-0 text-brand-text" />
              <span className="min-w-0 flex-1">{t("sample.banner")}</span>
              <button type="button" className="rounded-full bg-brand px-3 py-1 font-semibold text-brand-ink" onClick={() => sample.set(false)}>
                {t("sample.turnOff")}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence mode="wait" initial={false}>
        <motion.main
          key={section + (location.pathname.split("/")[2] ?? "")}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
        >
          {outlet}
        </motion.main>
      </AnimatePresence>
    </div>
  );
}
