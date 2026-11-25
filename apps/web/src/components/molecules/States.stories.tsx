import type { Meta, StoryObj } from '@storybook/react-vite';
import { BellOff } from 'lucide-react';
import { ApiError } from '../../lib/api';
import { Skeleton } from '../atoms/Skeleton';
import { AsyncStateView, type QueryLike } from './AsyncStateView';
import { EmptyState } from './EmptyState';
import { ErrorState } from './ErrorState';

const meta = {
  title: 'Molecules/Loading, empty and error states',
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const Empty: Story = {
  render: () => (
    <EmptyState
      icon={BellOff}
      title="Nenhum alerta ainda"
      description="Crie um acima para ser avisado quando o preço cair."
    />
  ),
};

export const ErrorWithRetry: Story = {
  render: () => <ErrorState message="Não foi possível carregar os postos." onRetry={() => {}} />,
};

const query = <T,>(over: Partial<QueryLike<T>>): QueryLike<T> => ({
  data: undefined,
  isPending: false,
  isError: false,
  error: null,
  refetch: () => {},
  ...over,
});

const loading = (
  <div role="status" aria-label="Carregando" className="space-y-2">
    <Skeleton className="h-5 w-1/2" />
    <Skeleton className="h-16 w-full" />
  </div>
);

/** One component drives all four states of remote data. Switch the story to see each one. */
export const Loading: Story = {
  render: () => (
    <AsyncStateView query={query<string[]>({ isPending: true })} loading={loading}>
      {() => null}
    </AsyncStateView>
  ),
};

export const NotFound: Story = {
  render: () => (
    <AsyncStateView
      query={query<string[]>({ isError: true, error: new ApiError(404, 'x') })}
      loading={loading}
    >
      {() => null}
    </AsyncStateView>
  ),
};

export const Loaded: Story = {
  render: () => (
    <AsyncStateView query={query({ data: ['Posto A', 'Posto B'] })} loading={loading}>
      {(items) => (
        <ul className="list-disc pl-5">
          {items.map((i) => (
            <li key={i}>{i}</li>
          ))}
        </ul>
      )}
    </AsyncStateView>
  ),
};
