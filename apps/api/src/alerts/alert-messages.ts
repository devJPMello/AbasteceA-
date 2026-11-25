const FUEL_LABEL: Record<string, string> = {
  GASOLINE_COMMON: 'Gasolina comum',
  GASOLINE_PREMIUM: 'Gasolina aditivada',
  ETHANOL: 'Etanol',
  DIESEL_S10: 'Diesel S10',
};

export const formatPrice = (priceMilli: number) =>
  `R$ ${(priceMilli / 1000).toFixed(3).replace('.', ',')}`;

export function alertMessage(args: {
  stationName: string;
  fuelType: string;
  priceMilli: number;
  targetPriceMilli: number;
}) {
  const fuel = FUEL_LABEL[args.fuelType] ?? args.fuelType;
  return {
    title: `${fuel} abaixo de ${formatPrice(args.targetPriceMilli)}`,
    body: `${args.stationName} está com ${fuel} a ${formatPrice(args.priceMilli)}, dentro do raio do seu alerta.`,
  };
}
