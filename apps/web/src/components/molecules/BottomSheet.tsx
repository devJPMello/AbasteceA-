import {
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from 'react';

export type SheetState = 'peek' | 'open';

const DRAG_THRESHOLD = 30;
const TAP_SLOP = 6;

/**
 * Mobile bottom sheet with two snap points (map-app style): a "peek" bar that always shows
 * `peek`, and an "open" state revealing `children`. Tap or drag the handle, or press Escape.
 *
 * The peek height is MEASURED (handle + peek content), so the bar fits whatever it contains and
 * nothing of the hidden list shows through. `onPeekHeight` lets the page keep map controls
 * above the bar. While collapsed, the list is `inert`: it cannot receive focus.
 */
export function BottomSheet({
  state,
  onStateChange,
  label,
  peek,
  onPeekHeight,
  children,
}: {
  state: SheetState;
  onStateChange: (state: SheetState) => void;
  label: string;
  peek: ReactNode;
  onPeekHeight?: (height: number) => void;
  children: ReactNode;
}) {
  const startY = useRef<number | null>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const [peekHeight, setPeekHeight] = useState(120);
  const open = state === 'open';

  useLayoutEffect(() => {
    const el = headerRef.current;
    if (!el) return;
    const measure = () => {
      const h = Math.ceil(el.getBoundingClientRect().height);
      setPeekHeight(h);
      onPeekHeight?.(h);
    };
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [onPeekHeight]);

  function onPointerDown(e: PointerEvent<HTMLButtonElement>) {
    startY.current = e.clientY;
    e.currentTarget.setPointerCapture?.(e.pointerId); // keeps the drag if the finger leaves the handle
  }

  function onPointerUp(e: PointerEvent<HTMLButtonElement>) {
    if (startY.current === null) return;
    const dy = e.clientY - startY.current;
    startY.current = null;
    if (Math.abs(dy) <= TAP_SLOP) onStateChange(open ? 'peek' : 'open');
    else if (dy < -DRAG_THRESHOLD) onStateChange('open');
    else if (dy > DRAG_THRESHOLD) onStateChange('peek');
  }

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === 'Escape' && open) onStateChange('peek');
  }

  return (
    <section
      aria-label={label}
      onKeyDown={onKeyDown}
      style={{
        height: 'min(85dvh, 640px)',
        transform: open ? 'translateY(0)' : `translateY(calc(100% - ${peekHeight}px))`,
      }}
      className="fixed inset-x-0 bottom-0 z-[1100] flex flex-col rounded-t-2xl border border-b-0 border-border bg-card shadow-float transition-transform duration-300 ease-out motion-reduce:transition-none"
    >
      <div ref={headerRef} className="shrink-0">
        <button
          type="button"
          aria-expanded={open}
          aria-label={open ? 'Recolher lista de postos' : 'Expandir lista de postos'}
          onPointerDown={onPointerDown}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (startY.current = null)}
          className="grid h-7 w-full touch-none place-items-center"
        >
          <span aria-hidden className="h-1 w-10 rounded-full bg-border" />
        </button>
        <div className="px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{peek}</div>
      </div>
      <div
        inert={!open}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain border-t border-border"
      >
        {children}
      </div>
    </section>
  );
}
