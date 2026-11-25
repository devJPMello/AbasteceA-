import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { session } from '../../lib/session';
import { json, logIn, mockApi, renderApp } from '../../test/utils';
import { AlertForm } from './AlertForm';

const POSITION = { lat: -10.1844, lng: -48.3336 };

afterEach(() => {
  session.clear();
  vi.restoreAllMocks();
});

describe('AlertForm', () => {
  it('rejects an invalid target without calling the API', async () => {
    logIn();
    const calls = mockApi(() => json({}));
    renderApp(<AlertForm position={POSITION} geoStatus="granted" />);

    await userEvent.type(screen.getByLabelText('Preço-alvo (R$)'), 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Criar alerta' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/preço-alvo válido/);
    expect(calls).toHaveLength(0);
  });

  it('sends the alert in thousandths, centred on the position, and confirms with a toast', async () => {
    logIn();
    const calls = mockApi(() => json({ id: 'a1' }, 201));
    renderApp(<AlertForm position={POSITION} geoStatus="granted" />);

    await userEvent.selectOptions(screen.getByLabelText('Combustível'), 'ETHANOL');
    await userEvent.selectOptions(screen.getByLabelText('Raio'), '5000');
    await userEvent.type(screen.getByLabelText('Preço-alvo (R$)'), '4,49');
    await userEvent.click(screen.getByRole('button', { name: 'Criar alerta' }));

    expect(await screen.findByText('Alerta criado')).toBeInTheDocument();
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({
      path: '/alerts',
      body: { fuelType: 'ETHANOL', targetPriceMilli: 4490, radiusMeters: 5000, ...POSITION },
    });
  });

  it('shows the API message (e.g. alert limit reached) next to the field', async () => {
    logIn();
    mockApi(() => json({ message: 'Limit of 10 alerts reached' }, 400));
    renderApp(<AlertForm position={POSITION} geoStatus="granted" />);

    await userEvent.type(screen.getByLabelText('Preço-alvo (R$)'), '5,99');
    await userEvent.click(screen.getByRole('button', { name: 'Criar alerta' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Limit of 10 alerts reached');
  });

  it('says where the alert will be centred when location is not available', () => {
    renderApp(<AlertForm position={POSITION} geoStatus="denied" />);
    expect(screen.getByText(/o centro de Palmas/)).toBeInTheDocument();
  });
});
