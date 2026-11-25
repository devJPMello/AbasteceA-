import type { Meta, StoryObj } from '@storybook/react-vite';
import { Card } from './Card';
import { Skeleton } from './Skeleton';
import { Spinner } from './Spinner';

const meta = {
  title: 'Atoms/Card, Skeleton and Spinner',
  component: Card,
  tags: ['autodocs'],
} satisfies Meta<typeof Card>;

export default meta;
type Story = StoryObj<typeof meta>;

export const CardSurface: Story = {
  render: () => (
    <Card className="max-w-sm p-4">
      <p className="text-xs text-muted-foreground">Gasolina comum</p>
      <p className="text-xl font-bold">R$ 6,125</p>
    </Card>
  ),
};

/** Shimmering placeholders are decorative (aria-hidden); the wrapper announces the loading state. */
export const SkeletonRows: Story = {
  render: () => (
    <div role="status" aria-label="Carregando" className="max-w-sm space-y-2">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  ),
};

export const LoadingSpinner: Story = {
  render: () => (
    <span role="status" aria-label="Carregando" className="text-primary">
      <Spinner className="h-6 w-6" />
    </span>
  ),
};
