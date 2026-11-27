import { lazy, type ReactNode, Suspense } from "react";
import { createBrowserRouter, Navigate, RouterProvider, useLocation } from "react-router-dom";

import { AppShell } from "@/components/layout/AppShell";
import { Skeleton } from "@/components/ui/primitives";
import { useI18n } from "@/i18n/I18nProvider";
import { useAuth } from "@/providers/AuthProvider";

const LoginPage = lazy(() => import("@/features/auth/LoginPage"));
const DeskPage = lazy(() => import("@/features/desk/DeskPage"));
const ListingsPage = lazy(() => import("@/features/listings/ListingsPage"));
const DealsBoardPage = lazy(() => import("@/features/deals/DealsBoardPage"));
const DealDetailPage = lazy(() => import("@/features/deals/DealDetailPage"));
const MarketPage = lazy(() => import("@/features/market/MarketPage"));
const PartnersPage = lazy(() => import("@/features/partners/PartnersPage"));

function PageFallback() {
  return (
    <div className="mt-4 grid gap-4">
      <Skeleton className="h-11" />
      <Skeleton className="h-40" />
      <Skeleton className="h-72" />
    </div>
  );
}

function NotFound() {
  const { t } = useI18n();
  return (
    <div className="card mt-6 p-10 text-center">
      <p className="text-lg font-medium">{t("common.notFound")}</p>
      <a href="/" className="btn btn-primary mt-4">{t("common.backToDesk")}</a>
    </div>
  );
}

/** Sends signed-out visitors to /login, remembering where they were headed. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return null; // checking a stored session — avoids flashing the login page
  if (!user) return <Navigate to="/login" replace state={{ from: location }} />;
  return children;
}

const page = (el: ReactNode) => <Suspense fallback={<PageFallback />}>{el}</Suspense>;

const router = createBrowserRouter([
  { path: "/login", element: <Suspense fallback={null}><LoginPage /></Suspense> },
  // The Agents tab was replaced by Partners (Excel data). Redirect outside the animated shell so
  // the page transition never has to run for the throw-away /agents render.
  { path: "/agents", element: <Navigate to="/partners" replace /> },
  {
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: page(<DeskPage />) },
      { path: "listings", element: page(<ListingsPage />) },
      { path: "deals", element: page(<DealsBoardPage />) },
      { path: "deals/:dealId", element: page(<DealDetailPage />) },
      { path: "market", element: page(<MarketPage />) },
      { path: "partners", element: page(<PartnersPage />) },
      { path: "*", element: <NotFound /> },
    ],
  },
]);

export function App() {
  return <RouterProvider router={router} />;
}
