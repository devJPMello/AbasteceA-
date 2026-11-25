import type { ReactNode } from 'react';
import { ApiError } from '../../lib/api';
import { ErrorState } from './ErrorState';

/** The subset of a TanStack Query result this view needs (keeps it easy to fake in tests). */
export interface QueryLike<T> {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: unknown;
  refetch: () => unknown;
}

/**
 * One place for the four states of remote data: loading (skeleton), error (with retry),
 * empty, and success. Pages describe each state instead of repeating if/else chains.
 */
export function AsyncStateView<T>({
  query,
  loading,
  empty,
  isEmpty,
  errorMessage,
  children,
}: {
  query: QueryLike<T>;
  loading: ReactNode;
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
  errorMessage?: (error: unknown) => string | undefined;
  children: (data: T) => ReactNode;
}) {
  if (query.isPending) return <>{loading}</>;

  if (query.isError || query.data === undefined) {
    const custom = errorMessage?.(query.error);
    const message =
      custom ??
      (query.error instanceof ApiError && query.error.status === 404
        ? 'Não encontrado.'
        : 'Não foi possível carregar. Verifique sua conexão.');
    return <ErrorState message={message} onRetry={() => void query.refetch()} />;
  }

  if (isEmpty?.(query.data)) return <>{empty}</>;
  return <>{children(query.data)}</>;
}
