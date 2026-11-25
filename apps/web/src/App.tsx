import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Skeleton } from './components/atoms/Skeleton';
import { AppLayout } from './components/templates/AppLayout';
import { AuthPage } from './pages/AuthPage';
import { MapPage } from './pages/MapPage';

// The station page pulls in Recharts; load it only when needed to keep the map page light.
const StationPage = lazy(() =>
  import('./pages/StationPage').then((m) => ({ default: m.StationPage })),
);

const PageFallback = () => (
  <div role="status" aria-label="Carregando" className="mx-auto max-w-3xl space-y-4 p-4">
    <Skeleton className="h-7 w-1/2" />
    <Skeleton className="h-40 w-full" />
  </div>
);

export function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route index element={<MapPage />} />
        <Route
          path="stations/:id"
          element={
            <Suspense fallback={<PageFallback />}>
              <StationPage />
            </Suspense>
          }
        />
        <Route path="login" element={<AuthPage mode="login" />} />
        <Route path="register" element={<AuthPage mode="register" />} />
        <Route path="*" element={<p className="p-6">Página não encontrada.</p>} />
      </Route>
    </Routes>
  );
}
