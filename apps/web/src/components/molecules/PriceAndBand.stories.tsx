import type { Meta, StoryObj } from '@storybook/react-vite';
import { stations } from '../../test/fixtures';
import { BandBadge } from './BandBadge';
import { PriceTag } from './PriceTag';

const meta = {
  title: 'Molecules/PriceTag and BandBadge',
  component: PriceTag,
  tags: ['autodocs'],
} satisfies Meta<typeof PriceTag>;

export default meta;
type Story = StoryObj<typeof meta>;

const fresh = stations[0]!.price;
const anp = stations[1]!.price;
const stale = stations[2]!.price;

export const FromUser: Story = { args: { price: fresh } };
export const FromAnp: Story = { args: { price: anp } };
/** Prices older than 7 days stay visible but are flagged. */
export const Stale: Story = { args: { price: stale } };
export const NoPrice: Story = { args: { price: null } };
/** List variant: price plus a stale badge only. */
export const Compact: Story = { args: { price: stale, compact: true } };

/** Band = icon + text, never colour alone (▼ cheap, – middle, ▲ expensive). */
export const Bands: Story = {
  args: { price: fresh },
  render: () => (
    <div className="flex flex-wrap gap-2">
      <BandBadge band="cheap" />
      <BandBadge band="mid" />
      <BandBadge band="expensive" />
      <BandBadge band="none" />
    </div>
  ),
};
