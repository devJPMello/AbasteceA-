import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ApiError } from '../../lib/api';
import { AsyncStateView, type QueryLike } from './AsyncStateView';

function query<T>(overrides: Partial<QueryLike<T>>): QueryLike<T> {
  return {
    data: undefined,
    isPending: false,
    isError: false,
    error: null,
    refetch: vi.fn(),
    ...overrides,
  };
}

const view = (q: QueryLike<string[]>) =>
  render(
    <AsyncStateView
      query={q}
      loading={<p>skeleton</p>}
      empty={<p>nada aqui</p>}
      isEmpty={(d) => d.length === 0}
    >
      {(d) => <p>{d.join(',')}</p>}
    </AsyncStateView>,
  );

describe('AsyncStateView', () => {
  it('shows the loading placeholder while pending', () => {
    view(query({ isPending: true }));
    expect(screen.getByText('skeleton')).toBeInTheDocument();
  });

  it('shows an error with a retry button that refetches', async () => {
    const q = query<string[]>({ isError: true, error: new Error('boom') });
    view(q);
    expect(screen.getByRole('alert')).toHaveTextContent(/Não foi possível carregar/);
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }));
    expect(q.refetch).toHaveBeenCalledTimes(1);
  });

  it('explains a 404 instead of a generic network error', () => {
    view(query({ isError: true, error: new ApiError(404, 'x') }));
    expect(screen.getByRole('alert')).toHaveTextContent('Não encontrado.');
  });

  it('shows the empty state for empty data', () => {
    view(query({ data: [] }));
    expect(screen.getByText('nada aqui')).toBeInTheDocument();
  });

  it('renders the content when there is data', () => {
    view(query({ data: ['a', 'b'] }));
    expect(screen.getByText('a,b')).toBeInTheDocument();
  });
});
