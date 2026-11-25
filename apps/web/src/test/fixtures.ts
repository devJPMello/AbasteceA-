import type {
  AlertDto,
  HistoryResponse,
  NearbyStation,
  NotificationsResponse,
  PendingReport,
  StationDetail,
} from '@bomba-certa/shared';

/** Sample data shared by unit tests and Storybook stories. Prices are fictitious. */
const daysAgo = (d: number) => new Date(Date.now() - d * 86_400_000).toISOString();

export const stations: NearbyStation[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Petrobras Teotônio Segurado',
    brand: 'Petrobras',
    address: 'Av. Teotônio Segurado, 502 Sul',
    lat: -10.2005,
    lng: -48.3342,
    distanceMeters: 1782,
    price: { priceMilli: 6125, source: 'USER', reportedAt: daysAgo(1), stale: false },
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Ipiranga Av. JK',
    brand: 'Ipiranga',
    address: 'Av. Juscelino Kubitschek, 104 Sul',
    lat: -10.1887,
    lng: -48.3318,
    distanceMeters: 515,
    price: { priceMilli: 6195, source: 'ANP', reportedAt: daysAgo(2), stale: false },
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Ale Av. LO-27',
    brand: 'Ale',
    address: 'Av. LO-27, 603 Norte',
    lat: -10.1621,
    lng: -48.3265,
    distanceMeters: 2600,
    price: { priceMilli: 6265, source: 'USER', reportedAt: daysAgo(10), stale: true },
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    name: 'Shell Orla',
    brand: 'Shell',
    address: 'Av. Parque, Orla da Praia da Graciosa',
    lat: -10.1938,
    lng: -48.3151,
    distanceMeters: 2278,
    price: null,
  },
];

export const stationDetail: StationDetail = {
  id: stations[0]!.id,
  name: stations[0]!.name,
  brand: stations[0]!.brand,
  address: stations[0]!.address,
  city: 'Palmas',
  lat: stations[0]!.lat,
  lng: stations[0]!.lng,
  prices: [
    {
      fuelType: 'GASOLINE_COMMON',
      priceMilli: 6125,
      source: 'USER',
      reportedAt: daysAgo(1),
      stale: false,
    },
    { fuelType: 'ETHANOL', priceMilli: 4575, source: 'ANP', reportedAt: daysAgo(3), stale: false },
    {
      fuelType: 'DIESEL_S10',
      priceMilli: 6205,
      source: 'USER',
      reportedAt: daysAgo(9),
      stale: true,
    },
  ],
};

export const history: HistoryResponse = {
  fuelType: 'GASOLINE_COMMON',
  days: 30,
  points: [
    { priceMilli: 6050, source: 'ANP', reportedAt: daysAgo(18) },
    { priceMilli: 6190, source: 'USER', reportedAt: daysAgo(12) },
    { priceMilli: 6100, source: 'USER', reportedAt: daysAgo(6) },
    { priceMilli: 6125, source: 'USER', reportedAt: daysAgo(1) },
  ],
};

export const pendingReports: PendingReport[] = [
  {
    id: 'r1',
    fuelType: 'GASOLINE_COMMON',
    priceMilli: 9500,
    confirmationsCount: 1,
    reportedAt: daysAgo(0),
    isMine: false,
    confirmedByMe: false,
  },
  {
    id: 'r2',
    fuelType: 'ETHANOL',
    priceMilli: 2100,
    confirmationsCount: 0,
    reportedAt: daysAgo(0),
    isMine: true,
    confirmedByMe: false,
  },
];

export const alerts: AlertDto[] = [
  {
    id: 'a1',
    fuelType: 'GASOLINE_COMMON',
    targetPriceMilli: 6300,
    radiusMeters: 3000,
    active: true,
    lat: -10.1844,
    lng: -48.3336,
    lastNotifiedAt: daysAgo(1),
    createdAt: daysAgo(2),
  },
  {
    id: 'a2',
    fuelType: 'ETHANOL',
    targetPriceMilli: 4490,
    radiusMeters: 5000,
    active: true,
    lat: -10.1844,
    lng: -48.3336,
    lastNotifiedAt: null,
    createdAt: daysAgo(4),
  },
];

export const notifications: NotificationsResponse = {
  items: [
    {
      id: 'n1',
      title: 'Gasolina comum abaixo de R$ 6,300',
      body: 'Petrobras Teotônio Segurado está com Gasolina comum a R$ 6,125, dentro do raio do seu alerta.',
      readAt: null,
      createdAt: daysAgo(0),
    },
    {
      id: 'n2',
      title: 'Etanol abaixo de R$ 4,600',
      body: 'Shell Orla está com Etanol a R$ 4,575, dentro do raio do seu alerta.',
      readAt: daysAgo(2),
      createdAt: daysAgo(3),
    },
  ],
  meta: { page: 1, pageSize: 20, total: 2, totalPages: 1 },
  unread: 1,
};
