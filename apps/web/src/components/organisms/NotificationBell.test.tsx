import { screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../lib/session';
import { json, logIn, mockApi, renderApp } from '../../test/utils';
import { NotificationBell } from './NotificationBell';

const note = (id: string, title: string) => ({
  id,
  title,
  body: `${title} body`,
  readAt: null,
  createdAt: new Date().toISOString(),
});
const response = (unread: number, items = [note('n1', 'Etanol abaixo de R$ 4,500')]) =>
  json({ items, meta: { page: 1, pageSize: 20, total: items.length, totalPages: 1 }, unread });

afterEach(() => {
  session.clear();
  vi.restoreAllMocks();
});

describe('NotificationBell', () => {
  it('shows the unread count in the badge and in the accessible name', async () => {
    logIn();
    mockApi(() => response(3));
    renderApp(<NotificationBell />);

    const link = await screen.findByRole('link', { name: /3 não lidas/ });
    expect(link).toHaveAttribute('href', '/alerts');
    expect(link).toHaveTextContent('3');
  });

  it('caps the badge at 9+', async () => {
    logIn();
    mockApi(() => response(14));
    renderApp(<NotificationBell />);
    expect(await screen.findByRole('link', { name: /14 não lidas/ })).toHaveTextContent('9+');
  });

  it('has no badge when everything was read', async () => {
    logIn();
    mockApi(() => response(0, []));
    renderApp(<NotificationBell />);
    const link = await screen.findByRole('link', { name: 'Alertas e notificações' });
    expect(link).not.toHaveTextContent(/\d/);
  });

  it('does not call the API for visitors who are not logged in', () => {
    const calls = mockApi(() => response(0));
    renderApp(<NotificationBell />);
    expect(calls).toHaveLength(0);
  });
});
