import { formatPrice, type HistoryResponse } from '@bomba-certa/shared';
import { LineChart as LineChartIcon } from 'lucide-react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { Skeleton } from '../atoms/Skeleton';
import { EmptyState } from '../molecules/EmptyState';

const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export function PriceChart({ points }: { points: HistoryResponse['points'] }) {
  // Respect the OS setting: no drawing animation for people who asked for less motion.
  const reduceMotion = useMediaQuery('(prefers-reduced-motion: reduce)');
  if (points.length === 0) {
    return (
      <EmptyState
        icon={LineChartIcon}
        title="Sem histórico neste período"
        description="Ainda não há reportes para este combustível."
      />
    );
  }
  const data = points.map((p) => ({ t: new Date(p.reportedAt).getTime(), price: p.priceMilli }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Gráfico do histórico de preços">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => day.format(t)}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            stroke="var(--border)"
          />
          <YAxis
            domain={['dataMin - 50', 'dataMax + 50']}
            tickFormatter={(v: number) => (v / 1000).toFixed(2).replace('.', ',')}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 12 }}
            stroke="var(--border)"
            width={48}
          />
          <Tooltip
            labelFormatter={(t) => new Date(Number(t)).toLocaleString('pt-BR')}
            formatter={(v) => [formatPrice(Number(v)), 'Preço']}
            contentStyle={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              borderRadius: 8,
              color: 'var(--card-foreground)',
            }}
          />
          <Line
            type="stepAfter"
            isAnimationActive={!reduceMotion}
            animationDuration={500}
            dataKey="price"
            stroke="var(--primary)"
            strokeWidth={2}
            dot={{ r: 3, fill: 'var(--primary)' }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export const PriceChartSkeleton = () => (
  <div role="status" aria-label="Carregando gráfico" className="space-y-3 p-2">
    <Skeleton className="h-52 w-full" />
  </div>
);
