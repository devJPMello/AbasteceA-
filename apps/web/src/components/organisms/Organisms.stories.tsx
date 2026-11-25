import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { SortBy } from '@bomba-certa/shared';
import { history, stations } from '../../test/fixtures';
import { MapFilters } from './MapFilters';
import { MapLegend } from './MapLegend';
import { PriceChart } from './PriceChart';
import { StationList, StationListSkeleton } from './StationList';
import { StationMap } from './StationMap';
import { StationSummary } from './StationSummary';

const bands = ['cheap', 'mid', 'expensive', 'none'] as const;

const meta = {
  title: 'Organisms/Station views',
  tags: ['autodocs'],
  parameters: { layout: 'padded' },
} satisfies Meta;

export default meta;
type Story = StoryObj<typeof meta>;

export const List: Story = {
  render: () => {
    const [active, setActive] = useState<string | null>(stations[1]!.id);
    return (
      <div className="max-w-md overflow-hidden rounded-lg border border-border bg-card">
        <StationList
          stations={stations}
          bands={[...bands]}
          activeId={active}
          onSelect={setActive}
        />
      </div>
    );
  },
};

export const ListEmpty: Story = {
  render: () => (
    <div className="max-w-md rounded-lg border border-border bg-card">
      <StationList stations={[]} bands={[]} activeId={null} onSelect={() => {}} />
    </div>
  ),
};

export const ListLoading: Story = {
  render: () => (
    <div className="max-w-md rounded-lg border border-border bg-card">
      <StationListSkeleton />
    </div>
  ),
};

export const Summary: Story = {
  render: () => (
    <div className="max-w-md rounded-lg border border-border bg-card p-4">
      <StationSummary station={stations[0]!} band="cheap" />
    </div>
  ),
};

export const Legend: Story = { render: () => <MapLegend className="inline-block" /> };

export const Filters: Story = {
  render: () => {
    const [radius, setRadius] = useState(5000);
    const [sort, setSort] = useState<SortBy>('price');
    return (
      <div className="max-w-md">
        <MapFilters
          radiusMeters={radius}
          onRadiusChange={setRadius}
          sortBy={sort}
          onSortChange={setSort}
          geoStatus="denied"
          onLocate={() => {}}
        />
      </div>
    );
  },
};

export const Chart: Story = {
  render: () => (
    <div className="max-w-2xl rounded-lg border border-border bg-card p-2">
      <PriceChart points={history.points} />
    </div>
  ),
};

export const ChartEmpty: Story = {
  render: () => (
    <div className="max-w-2xl rounded-lg border border-border bg-card p-2">
      <PriceChart points={[]} />
    </div>
  ),
};

/** Needs network for OpenStreetMap tiles. Pins use shape + colour; clusters show the cheapest price. */
export const Map: Story = {
  render: () => {
    const [active, setActive] = useState<string | null>(null);
    return (
      <StationMap
        className="h-[480px] w-full overflow-hidden rounded-lg border border-border"
        stations={stations}
        bands={[...bands]}
        center={{ lat: -10.1844, lng: -48.3336 }}
        radiusMeters={5000}
        activeId={active}
        onSelect={setActive}
      />
    );
  },
};
