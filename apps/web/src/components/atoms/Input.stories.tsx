import type { Meta, StoryObj } from '@storybook/react-vite';
import { Input, Select } from './Input';

const meta = {
  title: 'Atoms/Input',
  component: Input,
  tags: ['autodocs'],
  // Bare inputs have no visible label here: stories give them an accessible name instead.
  args: { 'aria-label': 'Preço', placeholder: '6,299' },
} satisfies Meta<typeof Input>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Invalid: Story = { args: { invalid: true, defaultValue: 'abc' } };
export const Disabled: Story = { args: { disabled: true } };

export const SelectField: Story = {
  render: () => (
    <Select aria-label="Raio" defaultValue="5000" className="max-w-48">
      <option value="1000">1 km</option>
      <option value="5000">5 km</option>
      <option value="20000">20 km</option>
    </Select>
  ),
};
