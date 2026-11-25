import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderApp } from '../../test/utils';
import { ConnectionStatus } from './ConnectionStatus';

function setOnline(value: boolean) {
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(value);
  act(() => {
    window.dispatchEvent(new Event(value ? 'online' : 'offline'));
  });
}

afterEach(() => vi.restoreAllMocks());

describe('ConnectionStatus', () => {
  it('shows nothing while online', () => {
    render(<ConnectionStatus />);
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('warns that the data may be old while offline', () => {
    render(<ConnectionStatus />);
    setOnline(false);
    expect(screen.getByRole('status')).toHaveTextContent(/offline.*desatualizados/);
  });

  it('removes the banner and confirms when the connection returns', async () => {
    renderApp(<ConnectionStatus />); // includes the toast host
    setOnline(false);
    expect(screen.getByRole('status')).toBeInTheDocument();

    setOnline(true);
    expect(await screen.findByText(/De volta online/)).toBeInTheDocument();
    expect(screen.queryByText(/Você está offline/)).not.toBeInTheDocument();
  });
});
