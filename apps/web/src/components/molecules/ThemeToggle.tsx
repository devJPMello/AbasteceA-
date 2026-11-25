import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../../lib/theme';
import { IconButton } from '../atoms/Button';

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  return (
    <IconButton label={dark ? 'Usar tema claro' : 'Usar tema escuro'} onClick={toggleTheme}>
      {dark ? <Sun aria-hidden className="h-5 w-5" /> : <Moon aria-hidden className="h-5 w-5" />}
    </IconButton>
  );
}
