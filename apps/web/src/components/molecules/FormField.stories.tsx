import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input } from '../atoms/Input';
import { FormField } from './FormField';

const meta = {
  title: 'Molecules/FormField',
  component: FormField,
  tags: ['autodocs'],
  args: { label: 'Preço (R$)', children: <Input placeholder="6,299" /> },
} satisfies Meta<typeof FormField>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const WithHint: Story = { args: { hint: 'Ex.: 6,299' } };

/** The error is tied to the input with aria-describedby and announced (role="alert"). */
export const WithError: Story = {
  args: { error: 'Informe um preço válido entre R$ 1,000 e R$ 20,000.' },
};
