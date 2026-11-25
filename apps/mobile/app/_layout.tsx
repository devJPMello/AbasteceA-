import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as Notifications from 'expo-notifications';
import { Stack, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { ApiError } from '../src/lib/api';
import { registerForPush } from '../src/lib/push';
import { loadSession, useSession, useSessionReady } from '../src/lib/session';
import { colors } from '../src/theme';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      // Retrying a 4xx never helps; only retry network/5xx errors once.
      retry: (count, error) => !(error instanceof ApiError && error.status < 500) && count < 1,
    },
  },
});

/** Registers this phone for push whenever a user is logged in, and opens Alerts on tap. */
function PushBridge() {
  const session = useSession();
  const router = useRouter();

  useEffect(() => {
    if (session) void registerForPush();
  }, [session?.user.id]); // re-register only when the logged-in user changes

  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener(() => {
      void queryClient.invalidateQueries({ queryKey: ['notifications'] });
      router.push('/alerts');
    });
    return () => sub.remove();
  }, [router]);

  return null;
}

export default function RootLayout() {
  const ready = useSessionReady();
  useEffect(() => {
    void loadSession();
  }, []);

  if (!ready) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.brand} />
      </View>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <PushBridge />
      <Stack
        screenOptions={{ headerStyle: { backgroundColor: colors.brand }, headerTintColor: '#fff' }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="station/[id]" options={{ title: 'Posto' }} />
      </Stack>
    </QueryClientProvider>
  );
}
