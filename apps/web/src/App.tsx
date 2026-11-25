import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthPage } from './pages/AuthPage';
import { MapPage } from './pages/MapPage';

// The station page pulls in Recharts; load it only when needed to keep the map page light.
const StationPage = lazy(() =>
  import('./pages/StationPage').then((m) => ({ default: m.StationPage })),
);

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<MapPage />} />
        <Route
          path="stations/:id"
          element={
            <Suspense fallback={<p className="p-6">Carregando…</p>}>
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
