import { ExpoPushChannel } from './expo-push.channel';

const USER = { id: 'u1', email: 'a@b.co' };
const MESSAGE = { title: 'Etanol abaixo de R$ 4,500', body: 'Posto X está com Etanol a R$ 4,390.' };

function build(tokens: string[]) {
  const prisma = {
    deviceToken: {
      findMany: jest.fn().mockResolvedValue(tokens.map((token) => ({ token }))),
      deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
    },
  };
  const config = {
    get: jest.fn((key: string) =>
      key === 'EXPO_PUSH_URL'
        ? 'https://push.test/send'
        : key === 'EXPO_ACCESS_TOKEN'
          ? 'secret'
          : undefined,
    ),
  };
  return { channel: new ExpoPushChannel(prisma as never, config as never), prisma };
}

const reply = (body: unknown, status = 200) =>
  jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status }));

afterEach(() => jest.restoreAllMocks());

describe('ExpoPushChannel', () => {
  it('does nothing (and makes no request) when the user has no devices', async () => {
    const { channel } = build([]);
    const fetchSpy = jest.spyOn(globalThis, 'fetch');
    await channel.send(USER, MESSAGE);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('sends one message per device in a single batch request', async () => {
    const { channel } = build(['ExponentPushToken[a]', 'ExponentPushToken[b]']);
    const fetchSpy = reply({ data: [{ status: 'ok' }, { status: 'ok' }] });
    await channel.send(USER, MESSAGE);

    const [url, init] = fetchSpy.mock.calls[0]!;
    expect(url).toBe('https://push.test/send');
    expect((init as RequestInit).headers).toMatchObject({ Authorization: 'Bearer secret' });
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.map((m: { to: string }) => m.to)).toEqual([
      'ExponentPushToken[a]',
      'ExponentPushToken[b]',
    ]);
    expect(body[0]).toMatchObject({ title: MESSAGE.title, body: MESSAGE.body });
  });

  it('deletes only the tokens Expo reports as DeviceNotRegistered', async () => {
    const { channel, prisma } = build(['ExponentPushToken[ok]', 'ExponentPushToken[dead]']);
    reply({
      data: [{ status: 'ok' }, { status: 'error', details: { error: 'DeviceNotRegistered' } }],
    });
    await channel.send(USER, MESSAGE);
    expect(prisma.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { token: { in: ['ExponentPushToken[dead]'] } },
    });
  });

  it('keeps tokens on other errors (e.g. rate limiting) and does not delete', async () => {
    const { channel, prisma } = build(['ExponentPushToken[a]']);
    reply({ data: [{ status: 'error', details: { error: 'MessageRateExceeded' } }] });
    await channel.send(USER, MESSAGE);
    expect(prisma.deviceToken.deleteMany).not.toHaveBeenCalled();
  });

  it('throws on HTTP errors so the failure is logged by the notification service', async () => {
    const { channel } = build(['ExponentPushToken[a]']);
    reply({}, 503);
    await expect(channel.send(USER, MESSAGE)).rejects.toThrow(/HTTP 503/);
  });
});
