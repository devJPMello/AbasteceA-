import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { session } from '../lib/session';
import { ReportForm } from './ReportForm';

const STATION = '33333333-3333-3333-3333-333333333333';

function renderForm() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <MemoryRouter>
        <ReportForm stationId={STATION} initialFuel="ETHANOL" />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  session.clear();
  vi.restoreAllMocks();
});

describe('ReportForm', () => {
  it('asks anonymous visitors to log in', () => {
    renderForm();
    expect(screen.getByRole('link', { name: 'Entre' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reportar/ })).not.toBeInTheDocument();
  });

  describe('when logged in', () => {
    beforeEach(() =>
      session.set({
        user: { id: 'u1', email: 'a@b.co', name: 'Ana' },
        accessToken: 'access',
        refreshToken: 'refresh',
      }),
    );

    it('rejects invalid prices without calling the API', async () => {
      const fetchSpy = vi.spyOn(globalThis, 'fetch');
      renderForm();
      await userEvent.type(screen.getByPlaceholderText('6,299'), 'abc');
      await userEvent.click(screen.getByRole('button', { name: /Reportar/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/preço válido/);
      expect(fetchSpy).not.toHaveBeenCalled();
    });

    it('posts the price in thousandths and explains a PENDING outcome', async () => {
      const fetchSpy = vi
        .spyOn(globalThis, 'fetch')
        .mockResolvedValue(
          new Response(JSON.stringify({ id: 'r1', status: 'PENDING' }), { status: 201 }),
        );
      renderForm();
      await userEvent.type(screen.getByPlaceholderText('6,299'), '9,50');
      await userEvent.click(screen.getByRole('button', { name: /Reportar/ }));

      await waitFor(() =>
        expect(screen.getByRole('status')).toHaveTextContent(/aguarda confirmação/),
      );
      const [url, init] = fetchSpy.mock.calls[0]!;
      expect(String(url)).toContain('/prices/reports');
      expect(JSON.parse((init as RequestInit).body as string)).toEqual({
        stationId: STATION,
        fuelType: 'ETHANOL',
        priceMilli: 9500,
      });
    });

    it('shows the API message when the cooldown applies (429)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ message: 'Try again in 300 min.' }), { status: 429 }),
      );
      renderForm();
      await userEvent.type(screen.getByPlaceholderText('6,299'), '4,59');
      await userEvent.click(screen.getByRole('button', { name: /Reportar/ }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Try again in 300 min.');
    });
  });
});
