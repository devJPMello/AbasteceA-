import type { Meta, StoryObj } from '@storybook/react-vite';
import { Badge } from './Badge';

const meta = {
  title: 'Atoms/Badge',
  component: Badge,
  tags: ['autodocs'],
  args: { children: 'Etiqueta' },
  argTypes: {
    tone: {
      control: 'select',
      options: ['neutral', 'warning', 'success', 'danger', 'cheap', 'mid', 'expensive', 'none'],
    },
  },
} satisfies Meta<typeof Badge>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Neutral: Story = {};

/** Every tone. Their text/background pairs are checked for WCAG AA in src/lib/contrast.test.ts. */
export const AllTones: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      {(
        ['neutral', 'warning', 'success', 'danger', 'cheap', 'mid', 'expensive', 'none'] as const
      ).map((tone) => (
        <Badge key={tone} tone={tone}>
          {tone}
        </Badge>
      ))}
    </div>
  ),
};
