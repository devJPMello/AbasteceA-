import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { NearbyStation } from '../../lib/types';
import { StationList } from './StationList';

const base = { brand: 'Ipiranga', address: 'Quadra 104 Sul', lat: 0, lng: 0 };
const stations: NearbyStation[] = [
  {
    ...base,
    id: '1',
    name: 'Posto Barato',
    distanceMeters: 450,
    price: { priceMilli: 5899, source: 'USER', reportedAt: new Date().toISOString(), stale: false },
  },
  {
    ...base,
    id: '2',
    name: 'Posto Velho',
    distanceMeters: 1800,
    price: {
      priceMilli: 6399,
      source: 'ANP',
      reportedAt: new Date(Date.now() - 9 * 86_400_000).toISOString(),
      stale: true,
    },
  },
  { ...base, id: '3', name: 'Posto Sem Preço', distanceMeters: 2500, price: null },
];

function renderList(onSelect = vi.fn()) {
  render(
    <MemoryRouter>
      <StationList
        stations={stations}
        bands={['cheap', 'expensive', 'none']}
        activeId={null}
        onSelect={onSelect}
      />
    </MemoryRouter>,
  );
  return onSelect;
}

describe('StationList', () => {
  it('shows price, distance and band for each station', () => {
    renderList();
    expect(screen.getByText('R$ 5,899')).toBeInTheDocument();
    expect(screen.getByText('450 m')).toBeInTheDocument();
    expect(screen.getByText('Barato')).toBeInTheDocument();
    expect(screen.getByText('Caro')).toBeInTheDocument();
    expect(screen.getByText('Sem preço')).toBeInTheDocument();
  });

  it('flags prices older than 7 days as outdated', () => {
    renderList();
    expect(screen.getAllByText(/Desatualizado/)).toHaveLength(1);
  });

  it('notifies the parent when a station is clicked', async () => {
    const onSelect = renderList();
    await userEvent.click(screen.getByText('Posto Sem Preço'));
    expect(onSelect).toHaveBeenCalledWith('3');
  });

  it('renders an empty state', () => {
    render(
      <MemoryRouter>
        <StationList stations={[]} bands={[]} activeId={null} onSelect={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByText(/Nenhum posto/)).toBeInTheDocument();
  });
});
