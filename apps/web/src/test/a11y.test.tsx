/**
 * Automated accessibility checks (axe-core) on the main screens, in the states users actually see.
 * A violation here fails CI. See a11y.ts for what axe cannot check in jsdom.
 */
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AppLayout } from '../components/templates/AppLayout';
import { BottomSheet } from '../components/molecules/BottomSheet';
import { StationList, StationListSkeleton } from '../components/organisms/StationList';
import { AlertsPage } from '../pages/AlertsPage';
import { AuthPage } from '../pages/AuthPage';
import { MapPage } from '../pages/MapPage';
import { StationPage } from '../pages/StationPage';
import { ThemeProvider } from '../lib/theme';
import { session } from '../lib/session';
import { a11yViolations } from './a11y';
import {
  alerts,
  history,
  notifications,
  pendingReports,
  stationDetail,
  stations,
} from './fixtures';
import { json, logIn, mockApi, renderApp } from './utils';

// Leaflet needs real layout (it measures the container), which jsdom does not have. The map
// canvas has its own keyboard/ARIA handling; what we check is the app UI around it.
vi.mock('../components/organisms/StationMap', () => ({
  StationMap: () => <div role="region" aria-label="Mapa de postos" />,
}));

const api = (method: string, path: string) => {
  if (path === '/stations/nearby') {
    return json({
      items: stations,
      meta: { page: 1, pageSize: 50, total: stations.length, totalPages: 1 },
    });
  }
  if (path.endsWith('/price-history')) return json(history);
  if (path.endsWith('/pending-reports')) return json(pendingReports);
  if (path.startsWith('/stations/')) return json(stationDetail);
  if (path === '/alerts') return json(alerts);
  if (path === '/notifications') return json(notifications);
  return json({}, method === 'POST' ? 201 : 200);
};

afterEach(() => {
  session.clear();
  vi.restoreAllMocks();
});

describe('the axe helper itself', () => {
  // Guards against a vacuous suite: if axe silently stopped working, every test below would pass.
  it('flags an image without alt text, an unlabeled input and an unnamed button', async () => {
    const { container } = renderApp(
      <div>
        <img src="x.png" />
        <input />
        <button />
      </div>,
    );
    const found = (await a11yViolations(container)).join(' | ');
    expect(found).toMatch(/image-alt/);
    expect(found).toMatch(/label/);
    expect(found).toMatch(/button-name/);
  });
});

describe('accessibility (axe) of the main screens', () => {
  it('login page', async () => {
    const { container } = renderApp(<AuthPage mode="login" />);
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('register page, including the error state', async () => {
    mockApi(() => json({ message: 'x' }, 409));
    const { container } = renderApp(<AuthPage mode="register" />);
    await userEvent.click(screen.getByRole('button', { name: 'Cadastrar' }));
    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('alerts page with alerts and notifications', async () => {
    logIn();
    mockApi(api);
    const { container } = renderApp(<AlertsPage />);
    await screen.findByText(/Gasolina comum ≤ R\$ 6,300/);
    await screen
      .findByText(/dentro do raio do seu alerta/, undefined, { timeout: 3000 })
      .catch(() => {});
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('alerts page for a visitor (login prompt)', async () => {
    const { container } = renderApp(<AlertsPage />);
    // axe's page-level "one h1" rule only runs on whole documents, so assert it explicitly.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Entre para criar alertas');
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('station page with prices, chart, pending reports and report form', async () => {
    logIn();
    mockApi(api);
    const { container } = renderApp(
      <Routes>
        <Route path="/stations/:id" element={<StationPage />} />
      </Routes>,
      `/stations/${stationDetail.id}`,
    );
    await screen.findByRole('heading', { level: 1, name: stationDetail.name });
    await screen.findByText('Aguardando confirmação');
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('station page while loading and when the station does not exist', async () => {
    mockApi(() => json({ message: 'not found' }, 404));
    const { container } = renderApp(
      <Routes>
        <Route path="/stations/:id" element={<StationPage />} />
      </Routes>,
      '/stations/nope',
    );
    expect(await a11yViolations(container)).toEqual([]); // skeleton
    await screen.findByText('Posto não encontrado.');
    expect(await a11yViolations(container)).toEqual([]); // error state
  });

  it('map page (phone layout with the bottom sheet), collapsed and expanded', async () => {
    mockApi(api);
    const { container } = renderApp(<MapPage />);
    await screen.findByText(/postos no raio/);
    expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
    expect(await a11yViolations(container)).toEqual([]);

    await userEvent.click(screen.getByRole('button', { name: 'Expandir lista de postos' }));
    await screen.findAllByText('Petrobras Teotônio Segurado');
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('map page (desktop layout with the sidebar)', async () => {
    vi.spyOn(window, 'matchMedia').mockImplementation(
      (query) =>
        ({
          matches: query.includes('min-width: 768px'),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
    mockApi(api);
    const { container } = renderApp(<MapPage />);
    await screen.findAllByText('Petrobras Teotônio Segurado');
    expect(await a11yViolations(container)).toEqual([]);
  });

  it('app shell: header for a visitor and for a logged-in user', async () => {
    mockApi(api);
    const shell = (
      <ThemeProvider>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<h1>Início</h1>} />
          </Route>
        </Routes>
      </ThemeProvider>
    );
    // AppLayout already hosts the toaster: a second one would duplicate the landmark.
    const visitor = renderApp(shell, '/', { toaster: false });
    expect(await a11yViolations(visitor.container)).toEqual([]);
    visitor.unmount();

    logIn();
    const user = renderApp(shell, '/', { toaster: false });
    await screen.findByRole('link', { name: /Alertas e notificações/ });
    expect(await a11yViolations(user.container)).toEqual([]);
  });

  it('station list states: data, empty and loading', async () => {
    const data = renderApp(
      <StationList
        stations={stations}
        bands={['cheap', 'mid', 'expensive', 'none']}
        activeId={stations[1]!.id}
        onSelect={() => {}}
      />,
    );
    expect(await a11yViolations(data.container)).toEqual([]);
    data.unmount();

    const empty = renderApp(
      <StationList stations={[]} bands={[]} activeId={null} onSelect={() => {}} />,
    );
    expect(await a11yViolations(empty.container)).toEqual([]);
    empty.unmount();

    const loading = renderApp(<StationListSkeleton />);
    expect(await a11yViolations(loading.container)).toEqual([]);
  });

  it('bottom sheet, collapsed and open', async () => {
    const closed = renderApp(
      <BottomSheet state="peek" onStateChange={() => {}} label="Postos" peek={<p>resumo</p>}>
        <button>item</button>
      </BottomSheet>,
    );
    expect(await a11yViolations(closed.container)).toEqual([]);
    closed.unmount();

    const open = renderApp(
      <BottomSheet state="open" onStateChange={() => {}} label="Postos" peek={<p>resumo</p>}>
        <button>item</button>
      </BottomSheet>,
    );
    expect(await a11yViolations(open.container)).toEqual([]);
  });
});
