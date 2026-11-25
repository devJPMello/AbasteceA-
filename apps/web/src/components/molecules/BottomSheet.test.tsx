import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it } from 'vitest';
import { BottomSheet, type SheetState } from './BottomSheet';

function Harness({ initial = 'peek' as SheetState }) {
  const [state, setState] = useState<SheetState>(initial);
  return (
    <BottomSheet state={state} onStateChange={setState} label="Postos" peek={<p>resumo</p>}>
      <button>item da lista</button>
    </BottomSheet>
  );
}

const handle = () => screen.getByRole('button', { name: /lista de postos/ });
// jsdom has no layout: pointer coordinates are all we need.
const drag = (from: number, to: number) => {
  fireEvent.pointerDown(handle(), { clientY: from, pointerId: 1 });
  fireEvent.pointerUp(handle(), { clientY: to, pointerId: 1 });
};

describe('BottomSheet', () => {
  it('starts collapsed: the peek stays visible and the list is not focusable (inert)', () => {
    const { container } = render(<Harness />);
    expect(screen.getByText('resumo')).toBeInTheDocument();
    expect(handle()).toHaveAttribute('aria-expanded', 'false');
    expect(container.querySelector('[inert]')).toContainElement(screen.getByText('item da lista'));
  });

  it('opens and closes with a tap on the handle', () => {
    render(<Harness />);
    drag(200, 200);
    expect(handle()).toHaveAttribute('aria-expanded', 'true');
    drag(200, 202); // tiny movement still counts as a tap
    expect(handle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens on a swipe up and closes on a swipe down', () => {
    render(<Harness />);
    drag(300, 200);
    expect(handle()).toHaveAttribute('aria-expanded', 'true');
    drag(200, 300);
    expect(handle()).toHaveAttribute('aria-expanded', 'false');
  });

  it('collapses with Escape', () => {
    render(<Harness initial="open" />);
    fireEvent.keyDown(screen.getByRole('region', { name: 'Postos' }), { key: 'Escape' });
    expect(handle()).toHaveAttribute('aria-expanded', 'false');
  });
});
