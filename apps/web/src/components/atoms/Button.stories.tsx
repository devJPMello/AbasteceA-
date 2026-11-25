import type { Meta, StoryObj } from '@storybook/react-vite';
import { Download, Trash2 } from 'lucide-react';
import { Button, IconButton } from './Button';

const meta = {
  title: 'Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  args: { children: 'Reportar preço' },
  argTypes: {
    variant: { control: 'select', options: ['primary', 'secondary', 'soft', 'ghost', 'danger'] },
    size: { control: 'select', options: ['sm', 'md', 'lg', 'icon'] },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Primary: Story = {};
export const Secondary: Story = { args: { variant: 'secondary' } };
export const Soft: Story = { args: { variant: 'soft' } };
export const Ghost: Story = { args: { variant: 'ghost' } };
export const Danger: Story = { args: { variant: 'danger', children: 'Excluir' } };
export const Loading: Story = { args: { loading: true, children: 'Enviando…' } };
export const Disabled: Story = { args: { disabled: true } };

export const Sizes: Story = {
  render: (args) => (
    <div className="flex items-center gap-3">
      <Button {...args} size="sm">
        Pequeno
      </Button>
      <Button {...args} size="md">
        Médio
      </Button>
      <Button {...args} size="lg">
        Grande
      </Button>
    </div>
  ),
};

export const WithIcon: Story = {
  render: (args) => (
    <Button {...args} variant="soft" size="sm">
      <Download aria-hidden className="h-4 w-4" />
      Instalar
    </Button>
  ),
};

/** Icon-only buttons need a text alternative: `label` becomes the accessible name and tooltip. */
export const IconOnly: Story = {
  render: () => (
    <IconButton label="Excluir alerta">
      <Trash2 aria-hidden className="h-5 w-5" />
    </IconButton>
  ),
};
