import "@fontsource-variable/outfit";
import "./index.css";

import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { ApiError } from "@/api/client";
import { App } from "@/App";
import { I18nProvider } from "@/i18n/I18nProvider";
import { sound } from "@/lib/sound";
import { ThemeProvider } from "@/providers/ThemeProvider";

const queryClient = new QueryClient({
  // Audible feedback for every write: chime on success, low buzz on failure.
  mutationCache: new MutationCache({
    onSuccess: () => sound.success(),
    onError: () => sound.error(),
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't hammer the API on client errors (4xx); retry network/5xx twice.
      retry: (count, err) => !(err instanceof ApiError && err.status >= 400 && err.status < 500) && count < 2,
    },
  },
});

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <I18nProvider>
      <ThemeProvider>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </ThemeProvider>
    </I18nProvider>
  </StrictMode>,
);
