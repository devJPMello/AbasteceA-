import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../lib/session';
import { json, logIn, mockApi, renderApp } from '../../test/utils';
import { AlertList } from './AlertList';

const alert = (over = {}) => ({
  id: 'a1',
  fuelType: 'ETHANOL',
  targetPriceMilli: 4490,
  radiusMeters: 3000,
  active: true,
  lat: -10.18,
  lng: -48.33,
  lastNotifiedAt: null,
  createdAt: new Date().toISOString(),
  ...over,
});

afterEach(() => {
  session.clear();
  vi.restoreAllMocks();
});

describe('AlertList', () => {
  it('shows an empty state when there are no alerts', async () => {
    logIn();
    mockApi(() => json([]));
    renderApp(<AlertList />);
    expect(await screen.findByText('Nenhum alerta ainda')).toBeInTheDocument();
  });

  it('lists alerts and whether they already fired', async () => {
    logIn();
    mockApi(() =>
      json([
        alert(),
        alert({
          id: 'a2',
          fuelType: 'DIESEL_S10',
          targetPriceMilli: 6000,
          lastNotifiedAt: new Date().toISOString(),
        }),
      ]),
    );
    renderApp(<AlertList />);

    expect(await screen.findByText(/Etanol ≤ R\$ 4,490/)).toBeInTheDocument();
    expect(screen.getByText('Aguardando')).toBeInTheDocument();
    expect(screen.getByText(/Disparou/)).toBeInTheDocument();
  });

  it('deletes an alert and offers to undo it by re-creating the same alert', async () => {
    logIn();
    const calls = mockApi((method) => {
      if (method === 'DELETE') return json(null, 204);
      if (method === 'POST') return json(alert(), 201);
      return json([alert()]);
    });
    renderApp(<AlertList />);

    await userEvent.click(
      await screen.findByRole('button', { name: /Excluir alerta de Etanol até R\$ 4,490/ }),
    );
    expect(await screen.findByText('Alerta excluído')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'DELETE')?.path).toBe('/alerts/a1');

    await userEvent.click(screen.getByRole('button', { name: 'Desfazer' }));
    await vi.waitFor(() =>
      expect(calls.find((c) => c.method === 'POST')).toMatchObject({
        path: '/alerts',
        body: {
          fuelType: 'ETHANOL',
          targetPriceMilli: 4490,
          radiusMeters: 3000,
          lat: -10.18,
          lng: -48.33,
        },
      }),
    );
  });

  it('offers a retry when loading fails', async () => {
    logIn();
    mockApi(() => json({ message: 'boom' }, 500));
    renderApp(<AlertList />);
    expect(await screen.findByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument();
  });
});
