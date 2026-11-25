// GastroSync telefon bildirimleri (expo-notifications, SDK 58)
//
// İki katman:
//  1. Uzak push (Google Play / EAS derlemesi): cihazın Expo push adresi sunucuya kaydedilir; sunucu, bildirim
//     merkezine düşen her bildirimi hedef roldeki kullanıcıların telefonlarına gönderir (uygulama kapalıyken de).
//  2. Yerel bildirim (Expo Go ve yedek): uygulama açıkken / arka plandayken WebSocket ile gelen rol bildirimi
//     telefonun bildirim çubuğunda gösterilir. Uzak push etkinse çift bildirim olmaması için yerel gösterilmez.
// Expo Go (Android, SDK 53+) uzak push desteklemez; bu durumda yalnızca yerel bildirim kullanılır.

import { Platform } from 'react-native';
import { getMobileApiBaseUrl, getMobileAuthToken } from './mobileAxiosClient';

let Notifications = null;
let Constants = null;
try { Notifications = require('expo-notifications'); } catch (_) { Notifications = null; }
try { Constants = require('expo-constants')?.default || require('expo-constants'); } catch (_) { Constants = null; }

export const CHANNEL_ID = 'gastrosync';
let initialized = false;
let permissionGranted = false;
let remotePushToken = null;
let channelReady = false;

const isExpoGo = () => {
  try {
    return Constants?.executionEnvironment === 'storeClient' || Constants?.appOwnership === 'expo';
  } catch (_) {
    return false;
  }
};

/** Bildirim davranışı, Android kanalı ve izin (Android 13+: kanal izin isteminden önce oluşturulmalı) */
export async function initPhoneNotifications() {
  if (!Notifications || Platform.OS === 'web') return false;
  if (!initialized) {
    initialized = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    if (Platform.OS === 'android') {
      try {
        await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
          name: 'GastroSync bildirimleri',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 200, 250],
        });
        channelReady = true;
      } catch (_) { /* bazı Expo Go sürümlerinde kanal oluşturulamaz: varsayılan kanal kullanılır */ }
    }
  }
  try {
    const current = await Notifications.getPermissionsAsync();
    let status = current?.status;
    if (status !== 'granted' && current?.canAskAgain !== false) {
      const asked = await Notifications.requestPermissionsAsync();
      status = asked?.status;
    }
    permissionGranted = status === 'granted';
  } catch (_) {
    permissionGranted = false;
  }
  return permissionGranted;
}

const authHeaders = () => {
  const h = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const t = getMobileAuthToken();
  if (t) h.Authorization = `Bearer ${t}`;
  return h;
};

/**
 * Uzak push adresini alır ve sunucuya kaydeder (EAS derlemesinde). Expo Go'da veya EAS proje kimliği
 * yoksa sessizce atlanır; yerel bildirim yedeği devrede kalır.
 */
export async function registerRemotePush() {
  remotePushToken = null;
  if (!Notifications || Platform.OS === 'web' || !permissionGranted || isExpoGo()) return null;
  const projectId = Constants?.expoConfig?.extra?.eas?.projectId ?? Constants?.easConfig?.projectId;
  if (!projectId) return null;
  try {
    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    if (!token) return null;
    const res = await fetch(`${getMobileApiBaseUrl()}/notifications/devices`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ token, platform: Platform.OS }),
    });
    if (res.ok) remotePushToken = token;
    return remotePushToken;
  } catch (_) {
    return null;
  }
}

/** Çıkışta cihaz kaydını sunucudan siler (erişim token'ı silinmeden ÖNCE çağrılmalı) */
export async function unregisterRemotePush() {
  const token = remotePushToken;
  remotePushToken = null;
  if (!token) return;
  try {
    await fetch(`${getMobileApiBaseUrl()}/notifications/devices/unregister`, {
      method: 'POST', headers: authHeaders(), body: JSON.stringify({ token }),
    });
  } catch (_) { /* ağ yoksa sunucu bir sonraki gönderimde geçersiz adresi temizler */ }
}

export const isRemotePushActive = () => !!remotePushToken;

/** Rol bildirimini telefonun bildirim çubuğunda gösterir (uzak push etkinse sunucu zaten gönderir) */
export async function presentPhoneNotification(notification) {
  if (!Notifications || Platform.OS === 'web' || !permissionGranted || isRemotePushActive() || !notification) return;
  const content = {
    title: String(notification.title || 'GastroSync'),
    body: String(notification.message || notification.body || ''),
    data: { notificationId: notification.id, route: notification.route || null, type: notification.type || null },
    sound: 'default',
  };
  try {
    await Notifications.scheduleNotificationAsync({
      content,
      // Kanal oluşturulamadıysa (bazı Expo Go sürümleri) varsayılan kanal kullanılır
      trigger: Platform.OS === 'android' && channelReady ? { channelId: CHANNEL_ID } : null,
    });
  } catch (_) {
    try { await Notifications.scheduleNotificationAsync({ content, trigger: null }); } catch (__) { /* gösterilemedi */ }
  }
}

/** Kullanıcı telefon bildirimine dokunduğunda ilgili ekranı açmak için dinleyici */
export function onPhoneNotificationTap(handler) {
  if (!Notifications || Platform.OS === 'web') return () => {};
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    try { handler(response?.notification?.request?.content?.data || {}); } catch (_) { /* yoksay */ }
  });
  return () => sub.remove();
}
