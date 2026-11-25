import { ConfigService } from '@nestjs/config';
import { PricesService } from './prices.service';

const USER = '11111111-1111-1111-1111-111111111111';
const OTHER = '22222222-2222-2222-2222-222222222222';
const STATION = '33333333-3333-3333-3333-333333333333';
const REPORT = '44444444-4444-4444-4444-444444444444';

function build(overrides: Record<string, unknown> = {}) {
  const tx = {
    priceReport: { create: jest.fn(), update: jest.fn() },
    reportConfirmation: { create: jest.fn() },
    $executeRaw: jest.fn(),
  };
  const prisma = {
    station: { findUnique: jest.fn().mockResolvedValue({ id: STATION }) },
    priceReport: { findFirst: jest.fn().mockResolvedValue(null), findUnique: jest.fn() },
    $queryRaw: jest.fn().mockResolvedValue([{ median: 6000, samples: 5n }]),
    $transaction: jest.fn((fn: (t: typeof tx) => unknown) => fn(tx)),
    ...overrides,
  };
  const config = { get: jest.fn().mockReturnValue(15) } as unknown as ConfigService;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { service: new PricesService(prisma as any, config as any), prisma, tx };
}

describe('PricesService.createReport', () => {
  const input = { stationId: STATION, fuelType: 'ETHANOL' as const, priceMilli: 6000 };

  it('404 when the station does not exist', async () => {
    const { service } = build({ station: { findUnique: jest.fn().mockResolvedValue(null) } });
    await expect(service.createReport(USER, input)).rejects.toMatchObject({ status: 404 });
  });

  it('429 when the same user reported the same station and fuel within 6h', async () => {
    const { service } = build({
      priceReport: { findFirst: jest.fn().mockResolvedValue({ reportedAt: new Date() }) },
    });
    await expect(service.createReport(USER, input)).rejects.toMatchObject({ status: 429 });
  });

  it('stores plausible prices as ACTIVE and updates the current price', async () => {
    const { service, tx } = build();
    tx.priceReport.create.mockResolvedValue({ id: REPORT, status: 'ACTIVE' });
    await service.createReport(USER, input);
    expect(tx.priceReport.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ACTIVE', source: 'USER' }),
      }),
    );
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('stores out-of-range prices as PENDING and leaves the current price alone', async () => {
    const { service, tx } = build();
    tx.priceReport.create.mockResolvedValue({ id: REPORT, status: 'PENDING' });
    await service.createReport(USER, { ...input, priceMilli: 8000 }); // +33% over median 6000
    expect(tx.priceReport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'PENDING' }) }),
    );
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });

  it('does not judge plausibility with fewer than 3 samples', async () => {
    const { service, tx } = build({
      $queryRaw: jest.fn().mockResolvedValue([{ median: 6000, samples: 2n }]),
    });
    tx.priceReport.create.mockResolvedValue({ id: REPORT });
    await service.createReport(USER, { ...input, priceMilli: 9000 });
    expect(tx.priceReport.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: 'ACTIVE' }) }),
    );
  });
});

describe('PricesService.confirmReport', () => {
  const base = { id: REPORT, userId: OTHER, source: 'USER', status: 'PENDING' };

  it('rejects confirming your own report', async () => {
    const { service } = build({
      priceReport: { findUnique: jest.fn().mockResolvedValue({ ...base, userId: USER }) },
    });
    await expect(service.confirmReport(USER, REPORT)).rejects.toMatchObject({ status: 403 });
  });

  it('rejects confirming ANP data', async () => {
    const { service } = build({
      priceReport: { findUnique: jest.fn().mockResolvedValue({ ...base, source: 'ANP' }) },
    });
    await expect(service.confirmReport(USER, REPORT)).rejects.toMatchObject({ status: 400 });
  });

  it('activates a PENDING report once it reaches the required confirmations', async () => {
    const { service, tx } = build({
      priceReport: { findUnique: jest.fn().mockResolvedValue(base) },
    });
    tx.priceReport.update
      .mockResolvedValueOnce({ ...base, confirmationsCount: 2 })
      .mockResolvedValueOnce({ ...base, status: 'ACTIVE', confirmationsCount: 2 });
    const result = await service.confirmReport(USER, REPORT);
    expect(result.status).toBe('ACTIVE');
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it('keeps it PENDING below the threshold', async () => {
    const { service, tx } = build({
      priceReport: { findUnique: jest.fn().mockResolvedValue(base) },
    });
    tx.priceReport.update.mockResolvedValueOnce({ ...base, confirmationsCount: 1 });
    const result = await service.confirmReport(USER, REPORT);
    expect(result.status).toBe('PENDING');
    expect(tx.$executeRaw).not.toHaveBeenCalled();
  });
});
