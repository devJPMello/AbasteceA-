import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { InstallButton } from './InstallButton';

/** What Chromium fires when the PWA becomes installable. */
function installableEvent(outcome: 'accepted' | 'dismissed' = 'accepted') {
  const event = new Event('beforeinstallprompt', { cancelable: true });
  const prompt = vi.fn(async () => {});
  Object.assign(event, { prompt, userChoice: Promise.resolve({ outcome }) });
  return { event, prompt };
}

describe('InstallButton', () => {
  it('is hidden until the browser says the app is installable', () => {
    render(<InstallButton />);
    expect(screen.queryByRole('button', { name: 'Instalar o app' })).not.toBeInTheDocument();
  });

  it('appears on beforeinstallprompt, suppresses the default banner and prompts on click', async () => {
    render(<InstallButton />);
    const { event, prompt } = installableEvent();
    act(() => {
      window.dispatchEvent(event);
    });
    expect(event.defaultPrevented).toBe(true); // we show our own button instead

    await userEvent.click(await screen.findByRole('button', { name: 'Instalar o app' }));
    expect(prompt).toHaveBeenCalledTimes(1);
    // The event can only be used once, so the button goes away.
    await vi.waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Instalar o app' })).not.toBeInTheDocument(),
    );
  });

  it('hides after the app was installed', async () => {
    render(<InstallButton />);
    act(() => {
      window.dispatchEvent(installableEvent().event);
    });
    expect(await screen.findByRole('button', { name: 'Instalar o app' })).toBeInTheDocument();
    act(() => {
      window.dispatchEvent(new Event('appinstalled'));
    });
    expect(screen.queryByRole('button', { name: 'Instalar o app' })).not.toBeInTheDocument();
  });
});
