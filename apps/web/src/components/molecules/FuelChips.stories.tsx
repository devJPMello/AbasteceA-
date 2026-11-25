import type { FuelType } from '@bomba-certa/shared';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { FuelChips } from './FuelChips';

const meta = {
  title: 'Molecules/FuelChips',
  component: FuelChips,
  tags: ['autodocs'],
  args: { value: 'GASOLINE_COMMON', onChange: () => {} },
} satisfies Meta<typeof FuelChips>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Interactive: Story = {
  render: () => {
    const [fuel, setFuel] = useState<FuelType>('GASOLINE_COMMON');
    return <FuelChips value={fuel} onChange={setFuel} />;
  },
};
