import { Toaster } from 'sonner';
import { useTheme } from '../../lib/theme';

/** Global toast host (sonner), following the app theme. Use `toast.success(...)` anywhere. */
export function AppToaster() {
  const { theme } = useTheme();
  return (
    <Toaster
      theme={theme}
      position="top-center"
      offset={72}
      closeButton
      toastOptions={{
        style: {
          background: 'var(--card)',
          color: 'var(--card-foreground)',
          border: '1px solid var(--border)',
        },
      }}
    />
  );
}
