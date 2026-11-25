import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { pwaState, resetPwaState } from '../../test/pwa-register-stub';
import { renderApp } from '../../test/utils';
import { PwaPrompts } from './PwaPrompts';

beforeEach(resetPwaState);
afterEach(() => vi.useRealTimers());

describe('PwaPrompts', () => {
  it('stays silent when nothing happened', () => {
    renderApp(<PwaPrompts />);
    expect(screen.queryByText('Nova versão disponível')).not.toBeInTheDocument();
  });

  it('offers an update and applies it only when the user accepts', async () => {
    pwaState.needRefresh = true;
    renderApp(<PwaPrompts />);

    expect(await screen.findByText('Nova versão disponível')).toBeInTheDocument();
    expect(pwaState.updateServiceWorker).not.toHaveBeenCalled(); // never swaps on its own

    await userEvent.click(screen.getByRole('button', { name: 'Atualizar' }));
    expect(pwaState.updateServiceWorker).toHaveBeenCalledWith(true);
  });

  it('lets the user postpone the update', async () => {
    pwaState.needRefresh = true;
    renderApp(<PwaPrompts />);
    await userEvent.click(await screen.findByRole('button', { name: 'Depois' }));
    expect(pwaState.setNeedRefresh).toHaveBeenCalledWith(false);
    expect(pwaState.updateServiceWorker).not.toHaveBeenCalled();
  });

  it('announces offline readiness once and clears the flag', async () => {
    pwaState.offlineReady = true;
    renderApp(<PwaPrompts />);
    expect(await screen.findByText('Pronto para usar offline')).toBeInTheDocument();
    expect(pwaState.setOfflineReady).toHaveBeenCalledWith(false);
  });

  it('re-checks for a new version every hour', () => {
    vi.useFakeTimers();
    renderApp(<PwaPrompts />);
    const registration = { update: vi.fn() };
    pwaState.registrationCallback?.('/sw.js', registration);

    vi.advanceTimersByTime(60 * 60 * 1000 - 1);
    expect(registration.update).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(registration.update).toHaveBeenCalledTimes(1);
  });

  it('keeps a single timer when the service worker registers again', () => {
    vi.useFakeTimers();
    renderApp(<PwaPrompts />);
    const first = { update: vi.fn() };
    const second = { update: vi.fn() };
    pwaState.registrationCallback?.('/sw.js', first);
    pwaState.registrationCallback?.('/sw.js', second);

    vi.advanceTimersByTime(60 * 60 * 1000);
    expect(first.update).not.toHaveBeenCalled();
    expect(second.update).toHaveBeenCalledTimes(1);
  });
});
