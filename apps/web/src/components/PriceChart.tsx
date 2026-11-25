import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatPrice } from '../lib/format';
import type { HistoryResponse } from '../lib/types';

const day = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export function PriceChart({ points }: { points: HistoryResponse['points'] }) {
  if (points.length === 0) {
    return <p className="p-4 text-sm text-slate-600">Sem histórico neste período.</p>;
  }
  const data = points.map((p) => ({ t: new Date(p.reportedAt).getTime(), price: p.priceMilli }));
  return (
    <div className="h-64 w-full" role="img" aria-label="Gráfico do histórico de preços">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => day.format(t)}
            fontSize={12}
          />
          <YAxis
            domain={['dataMin - 50', 'dataMax + 50']}
            tickFormatter={(v: number) => (v / 1000).toFixed(2).replace('.', ',')}
            fontSize={12}
            width={48}
          />
          <Tooltip
            labelFormatter={(t: number) => new Date(t).toLocaleString('pt-BR')}
            formatter={(v: number) => [formatPrice(v), 'Preço']}
          />
          <Line type="stepAfter" dataKey="price" stroke="#0f766e" strokeWidth={2} dot />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
