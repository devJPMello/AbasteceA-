import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { ThemeToggle } from '../components/molecules/ThemeToggle';
import { ThemeProvider } from './theme';

afterEach(() => {
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('theme', () => {
  it('starts from the saved preference and applies the dark class', () => {
    localStorage.setItem('bomba-certa.theme', 'dark');
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(document.documentElement).toHaveClass('dark');
    expect(screen.getByRole('button', { name: 'Usar tema claro' })).toBeInTheDocument();
  });

  it('toggles, updates the label and persists the choice', async () => {
    render(
      <ThemeProvider>
        <ThemeToggle />
      </ThemeProvider>,
    );
    expect(document.documentElement).not.toHaveClass('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Usar tema escuro' }));
    expect(document.documentElement).toHaveClass('dark');
    expect(localStorage.getItem('bomba-certa.theme')).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: 'Usar tema claro' }));
    expect(document.documentElement).not.toHaveClass('dark');
    expect(localStorage.getItem('bomba-certa.theme')).toBe('light');
  });
});
