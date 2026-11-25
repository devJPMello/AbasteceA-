import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import { StationList } from '../organisms/StationList';
import { stations } from '../../test/fixtures';
import { BottomSheet, type SheetState } from './BottomSheet';

const meta = {
  title: 'Molecules/BottomSheet',
  component: BottomSheet,
  tags: ['autodocs'],
  parameters: { layout: 'fullscreen' },
} satisfies Meta<typeof BottomSheet>;

export default meta;
type Story = StoryObj<typeof meta>;

/**
 * Map-app style sheet: tap or drag the handle, or press Escape. The collapsed bar fits its own
 * content (measured), and the hidden list is `inert` so it cannot be focused.
 */
export const Interactive: Story = {
  args: {
    state: 'peek',
    onStateChange: () => {},
    label: 'Postos no raio',
    peek: null,
    children: null,
  },
  render: () => {
    const [state, setState] = useState<SheetState>('peek');
    return (
      <div className="relative h-[640px] bg-muted">
        <p className="p-4 text-sm text-muted-foreground">(o mapa ficaria aqui)</p>
        <BottomSheet
          state={state}
          onStateChange={setState}
          label="Postos no raio"
          peek={
            <div>
              <p className="font-semibold">{stations.length} postos no raio</p>
              <p className="text-xs text-muted-foreground">
                Mais barato: R$ 6,125 · toque para ver a lista
              </p>
            </div>
          }
        >
          <StationList
            stations={stations}
            bands={['cheap', 'mid', 'expensive', 'none']}
            activeId={null}
            onSelect={() => {}}
          />
        </BottomSheet>
      </div>
    );
  },
};
