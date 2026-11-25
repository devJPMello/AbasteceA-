import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { Chip } from './Chip';

const meta = {
  title: 'Atoms/Chip',
  component: Chip,
  tags: ['autodocs'],
  args: { children: 'Gasolina comum', selected: false },
} satisfies Meta<typeof Chip>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Unselected: Story = {};
export const Selected: Story = { args: { selected: true } };

/** A toggle exposes its state through aria-pressed, so screen readers announce it. */
export const FilterGroup: Story = {
  render: () => {
    const options = ['Gasolina comum', 'Etanol', 'Diesel S10'];
    const [value, setValue] = useState(options[0]);
    return (
      <div role="group" aria-label="Combustível" className="flex gap-2">
        {options.map((o) => (
          <Chip key={o} selected={o === value} onClick={() => setValue(o)}>
            {o}
          </Chip>
        ))}
      </div>
    );
  },
};
