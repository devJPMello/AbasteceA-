import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useEffect } from 'react';
import {
  Circle,
  CircleMarker,
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
} from 'react-leaflet';
import { Link } from 'react-router-dom';
import { formatDistance, formatPrice } from '../lib/format';
import type { PriceBand } from '../lib/priceBand';
import type { NearbyStation } from '../lib/types';

interface Props {
  stations: NearbyStation[];
  bands: PriceBand[];
  center: { lat: number; lng: number };
  radiusMeters: number;
  activeId: string | null;
  onSelect: (id: string) => void;
}

function Recenter({ center, radiusMeters }: Pick<Props, 'center' | 'radiusMeters'>) {
  const map = useMap();
  useEffect(() => {
    // toBounds takes the full side length in metres (2 × radius), no layer on the map needed.
    map.fitBounds(L.latLng(center.lat, center.lng).toBounds(radiusMeters * 2), { animate: true });
  }, [map, center.lat, center.lng, radiusMeters]);
  return null;
}

function markerIcon(station: NearbyStation, band: PriceBand, active: boolean) {
  const label = station.price
    ? (station.price.priceMilli / 1000).toFixed(2).replace('.', ',')
    : '—';
  const classes = [
    'price-marker',
    `price-marker--${band}`,
    station.price?.stale ? 'price-marker--stale' : '',
    active ? 'price-marker--active' : '',
  ].join(' ');
  return L.divIcon({
    className: '',
    html: `<div class="${classes}">${label}</div>`,
    iconSize: [0, 0],
  });
}

export function StationMap({ stations, bands, center, radiusMeters, activeId, onSelect }: Props) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={13}
      className="h-full w-full"
      data-testid="station-map"
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Recenter center={center} radiusMeters={radiusMeters} />
      <Circle
        center={[center.lat, center.lng]}
        radius={radiusMeters}
        pathOptions={{ color: '#0f766e', weight: 1, fillOpacity: 0.05 }}
      />
      <CircleMarker
        center={[center.lat, center.lng]}
        radius={7}
        pathOptions={{ color: '#fff', weight: 2, fillColor: '#2563eb', fillOpacity: 1 }}
      >
        <Popup>Você está aqui</Popup>
      </CircleMarker>
      {stations.map((s, i) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={markerIcon(s, bands[i] ?? 'none', s.id === activeId)}
          eventHandlers={{ click: () => onSelect(s.id) }}
        >
          <Popup>
            <strong>{s.name}</strong>
            <br />
            {s.price ? formatPrice(s.price.priceMilli) : 'Sem preço'} ·{' '}
            {formatDistance(s.distanceMeters)}
            <br />
            <Link to={`/stations/${s.id}`}>Ver detalhes</Link>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
