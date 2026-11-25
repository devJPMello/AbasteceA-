import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { api } from './api';

const TOKEN_KEY = 'bomba-certa.push-token';

// Show alerts as banners even while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

export type PushResult =
  | { ok: true; token: string }
  | { ok: false; reason: 'not-a-device' | 'permission-denied' | 'no-project-id' | 'error' };

/**
 * Asks permission, gets the Expo push token and registers it with the API.
 * Push needs a physical device and a development/production build (not Expo Go on Android)
 * with an EAS project id; every failure mode is reported instead of thrown, so the UI can
 * explain it.
 */
export async function registerForPush(): Promise<PushResult> {
  if (!Device.isDevice) return { ok: false, reason: 'not-a-device' };

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('alerts', {
      name: 'Alertas de preço',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  const status =
    existing.status === 'granted'
      ? existing.status
      : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return { ok: false, reason: 'permission-denied' };

  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return { ok: false, reason: 'no-project-id' };

  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    await api('/devices', {
      method: 'POST',
      body: { token, platform: Platform.OS === 'ios' ? 'ios' : 'android' },
    });
    await SecureStore.setItemAsync(TOKEN_KEY, token);
    return { ok: true, token };
  } catch {
    return { ok: false, reason: 'error' };
  }
}

/** Call before logging out so this phone stops receiving the previous user's alerts. */
export async function unregisterPush() {
  try {
    const token = await SecureStore.getItemAsync(TOKEN_KEY);
    if (!token) return;
    await api(`/devices/${encodeURIComponent(token)}`, { method: 'DELETE' });
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  } catch {
    /* best effort: the server also drops tokens Expo reports as unregistered */
  }
}

export const PUSH_MESSAGE: Record<Exclude<PushResult, { ok: true }>['reason'], string> = {
  'not-a-device': 'Notificações push só funcionam em um aparelho físico.',
  'permission-denied': 'Permissão de notificações negada. Ative nas configurações do sistema.',
  'no-project-id': 'Projeto EAS não configurado (defina EAS_PROJECT_ID). Veja o README.',
  error: 'Não foi possível registrar as notificações. Tente novamente.',
};
