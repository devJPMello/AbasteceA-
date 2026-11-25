/**
 * Station map on the native Leaflet API (not react-leaflet): the map is created and destroyed
 * imperatively inside effects, which keeps React 19 StrictMode's double-mount safe and gives full
 * control over marker clustering (leaflet.markercluster has no React wrapper).
 */
import type { NearbyStation, PriceBand } from '@bomba-certa/shared';
import { formatPrice } from '@bomba-certa/shared';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import { useEffect, useRef } from 'react';
import { cheapest, clusterHtml, pillHtml } from '../../lib/mapIcons';

interface Props {
  stations: NearbyStation[];
  bands: PriceBand[];
  center: { lat: number; lng: number };
  radiusMeters: number;
  activeId: string | null;
  onSelect: (id: string) => void;
  /** Space (px) covered by UI at the bottom (e.g. the mobile sheet) when fitting the view. */
  bottomInset?: number;
  className?: string;
}

type PriceMarker = L.Marker & { stationId: string; band: PriceBand; station: NearbyStation };

function pillIcon(station: NearbyStation, band: PriceBand, active: boolean) {
  return L.divIcon({
    className: '', // no default white square
    html: pillHtml({
      band,
      priceMilli: station.price?.priceMilli ?? null,
      stale: station.price?.stale,
      active,
    }),
    iconSize: [0, 0], // the pill positions itself with a CSS transform
  });
}

export function StationMap({
  stations,
  bands,
  center,
  radiusMeters,
  activeId,
  onSelect,
  bottomInset = 24,
  className,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const clusterRef = useRef<L.MarkerClusterGroup | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const meRef = useRef<L.CircleMarker | null>(null);
  const markersRef = useRef(new Map<string, PriceMarker>());
  const activeRef = useRef<string | null>(null);
  const onSelectRef = useRef(onSelect);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Create the map once; destroy it on unmount (also on StrictMode's simulated unmount).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const map = L.map(el, { zoomControl: false }).setView([center.lat, center.lng], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
    }).addTo(map);
    L.control
      .zoom({ position: 'topright', zoomInTitle: 'Aproximar', zoomOutTitle: 'Afastar' })
      .addTo(map);

    const cluster = L.markerClusterGroup({
      showCoverageOnHover: false,
      maxClusterRadius: 50,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: (c) => {
        const markers = c.getAllChildMarkers() as PriceMarker[];
        return L.divIcon({
          className: '',
          html: clusterHtml(
            markers.length,
            cheapest(markers.map((m) => m.station.price?.priceMilli)),
          ),
          iconSize: [46, 46],
        });
      },
    });
    map.addLayer(cluster);

    circleRef.current = L.circle([center.lat, center.lng], {
      radius: radiusMeters,
      className: 'search-radius', // coloured by CSS tokens (var() does not work in SVG attributes)
      weight: 1,
      interactive: false,
    }).addTo(map);
    meRef.current = L.circleMarker([center.lat, center.lng], {
      radius: 7,
      color: '#ffffff',
      weight: 2,
      fillColor: '#2563eb',
      fillOpacity: 1,
      interactive: false,
    }).addTo(map);

    mapRef.current = map;
    clusterRef.current = cluster;
    const markers = markersRef.current;
    return () => {
      map.remove();
      mapRef.current = clusterRef.current = circleRef.current = meRef.current = null;
      markers.clear();
    };
    // Intentionally empty deps: the map is created once; the effects below keep it in sync.
  }, []);

  // Recentre when the search point or radius changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !circleRef.current || !meRef.current) return;
    circleRef.current.setLatLng([center.lat, center.lng]).setRadius(radiusMeters);
    meRef.current.setLatLng([center.lat, center.lng]);
    map.fitBounds(circleRef.current.getBounds(), {
      paddingTopLeft: [24, 24],
      paddingBottomRight: [24, bottomInset],
    });
  }, [center.lat, center.lng, radiusMeters, bottomInset]);

  // Rebuild markers when the data changes.
  useEffect(() => {
    const cluster = clusterRef.current;
    if (!cluster) return;
    cluster.clearLayers();
    markersRef.current.clear();
    const created = stations.map((station, i) => {
      const band = bands[i] ?? 'none';
      const marker = L.marker([station.lat, station.lng], {
        icon: pillIcon(station, band, station.id === activeRef.current),
        title: station.price
          ? `${station.name}, ${formatPrice(station.price.priceMilli)}`
          : `${station.name}, sem preço`,
        keyboard: true,
        riseOnHover: true,
      }) as PriceMarker;
      marker.stationId = station.id;
      marker.band = band;
      marker.station = station;
      marker.on('click', () => onSelectRef.current(station.id));
      markersRef.current.set(station.id, marker);
      return marker;
    });
    cluster.addLayers(created);
  }, [stations, bands]);

  // Highlight the selected pin and bring it into view (un-clustering if needed).
  useEffect(() => {
    const previous = activeRef.current && markersRef.current.get(activeRef.current);
    if (previous) previous.setIcon(pillIcon(previous.station, previous.band, false));
    activeRef.current = activeId;

    const marker = activeId ? markersRef.current.get(activeId) : undefined;
    if (!marker) return;
    marker.setIcon(pillIcon(marker.station, marker.band, true));
    clusterRef.current?.zoomToShowLayer(marker, () => {
      mapRef.current?.panTo(marker.getLatLng());
    });
    // Only on selection changes: re-running on every data refresh would drag the map back to the
    // pin and cancel the fit-to-radius. Markers rebuilt later already honour activeRef.
  }, [activeId]);

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label="Mapa de postos"
      className={className}
      data-testid="station-map"
    />
  );
}
