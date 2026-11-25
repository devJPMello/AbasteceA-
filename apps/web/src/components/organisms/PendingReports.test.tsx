import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../lib/session';
import { json, logIn, mockApi, renderApp } from '../../test/utils';
import { PendingReports } from './PendingReports';

const base = {
  fuelType: 'GASOLINE_COMMON',
  priceMilli: 9500,
  confirmationsCount: 1,
  reportedAt: new Date().toISOString(),
};
const reports = [
  { ...base, id: 'mine', isMine: true, confirmedByMe: false },
  { ...base, id: 'voted', isMine: false, confirmedByMe: true },
  { ...base, id: 'open', isMine: false, confirmedByMe: false },
];

afterEach(() => {
  session.clear();
  vi.restoreAllMocks();
});

describe('PendingReports', () => {
  it('offers Confirm only on reports the user did not write and has not voted on', async () => {
    logIn();
    mockApi(() => json(reports));
    renderApp(<PendingReports stationId="s1" />);

    expect(await screen.findByText('Seu reporte')).toBeInTheDocument();
    expect(screen.getByText('Você confirmou')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Confirmar/ })).toHaveLength(1);
  });

  it('confirms the right report and thanks the user', async () => {
    logIn();
    const calls = mockApi((method) =>
      method === 'POST' ? json({ status: 'PENDING' }) : json(reports),
    );
    renderApp(<PendingReports stationId="s1" />);

    await userEvent.click(await screen.findByRole('button', { name: /Confirmar/ }));
    expect(await screen.findByText('Obrigado por confirmar!')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')?.path).toBe('/prices/reports/open/confirm');
  });

  it('shows no action buttons to visitors who are not logged in', async () => {
    mockApi(() => json(reports.map((r) => ({ ...r, isMine: false, confirmedByMe: false }))));
    renderApp(<PendingReports stationId="s1" />);
    await screen.findAllByText(/R\$ 9,500/);
    expect(screen.queryByRole('button', { name: /Confirmar/ })).not.toBeInTheDocument();
  });

  it('renders nothing when there is nothing pending', async () => {
    const calls = mockApi(() => json([]));
    renderApp(<PendingReports stationId="s1" />);
    await vi.waitFor(() => expect(calls).toHaveLength(1));
    await new Promise((r) => setTimeout(r, 30)); // let the response render
    expect(screen.queryByText('Aguardando confirmação')).not.toBeInTheDocument();
  });
});
