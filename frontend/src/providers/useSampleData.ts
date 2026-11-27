import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useSyncExternalStore } from "react";

import { sampleData } from "@/api/client";

/** Header switch state for sample (demo) data. Toggling drops every cached query and refetches. */
export function useSampleData() {
  const on = useSyncExternalStore(sampleData.subscribe, sampleData.get);
  const qc = useQueryClient();
  const set = useCallback(
    (next: boolean) => {
      sampleData.set(next);
      void qc.cancelQueries();
      void qc.resetQueries();
    },
    [qc],
  );
  return { on, set };
}
