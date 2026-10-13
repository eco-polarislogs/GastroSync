// GastroSync Mobil API Entegrasyon Katmanı
// Hem yerel cihaz (localhost / 10.0.2.2 Android Emulator), hem fiziksel cihaz (LAN IP / Wi-Fi IP), hem de Expo Tunnel ile uyumlu çalışır.

import Constants from 'expo-constants';
import { INITIAL_INVENTORY, DEMO_USERS, INITIAL_RECIPES } from '../data/inventoryData';

// Dinamik Host Belirleme (Expo Manifest veya Varsayılan Yerel IP)
const getApiBaseUrl = () => {
  // Expo Constants debugger host üzerinden yerel bilgisayarın Wi-Fi IP'sini yakalar
  const debuggerHost = Constants?.expoConfig?.hostUri || Constants?.manifest?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:8080/api`;
  }
  // Varsayılan yerel geliştirme adresi (GastroSync Spring Boot default)
  return 'http://192.168.1.149:8080/api';
};

export const API_BASE_URL = getApiBaseUrl();

// 1. Kullanıcı Girişi
export const apiLogin = async (username, password) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${API_BASE_URL}/users/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      return { success: true, user: data };
    }
  } catch (err) {
    console.log('[Mobile API] Backend erişilemedi, yerel demo kullanıcıları kullanılıyor:', err.message);
  }

  // Fallback: Yerel demo verisi
  const user = DEMO_USERS.find(
    (u) => (u.username === username || u.email === username)
  );
  if (user) {
    return { success: true, user };
  }
  return { success: false, message: 'Kullanıcı adı veya şifre hatalı' };
};

// 2. Stok Listesi Çekme
export const apiFetchInventory = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${API_BASE_URL}/inventory`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const rawList = json.data || json || [];
      if (Array.isArray(rawList) && rawList.length > 0) {
        return rawList.map((item) => ({
          id: item.id,
          barcode: item.barcode || '',
          name: item.name,
          cat: item.category || 'Genel',
          unit: item.unit || 'kg',
          stock: Number(item.currentStock ?? item.stock ?? 0),
          min: Number(item.minStock ?? item.min ?? 5),
          price: Number(item.unitCost ?? item.price ?? 0),
        }));
      }
    }
  } catch (err) {
    console.log('[Mobile API] Envanter API çağrısı yerel belleğe düştü:', err.message);
  }
  return INITIAL_INVENTORY;
};

// 3. Mal Kabul (Stoğa Ekleme)
export const apiReceiveStock = async (itemId, quantity, recordedBy = 'Mobil Depo') => {
  try {
    const res = await fetch(`${API_BASE_URL}/inventory/${itemId}/receive`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity, recordedBy }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json };
    }
  } catch (err) {
    console.log('[Mobile API] Mal kabul API başarısız, yerel modda işlenecek:', err.message);
  }
  return { success: false };
};

// 4. Zayiat / Fire Bildirimi (Stoktan Düşme)
export const apiRecordWaste = async (itemId, quantity, reason = 'Mobil Zayiat', recordedBy = 'Mobil Depo') => {
  try {
    const res = await fetch(`${API_BASE_URL}/inventory/${itemId}/waste`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ quantity, reason, recordedBy }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json };
    }
  } catch (err) {
    console.log('[Mobile API] Zayiat API başarısız, yerel modda işlenecek:', err.message);
  }
  return { success: false };
};

// 5. Kullanıcı Listesi Çekme
export const apiFetchUsers = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);

    const res = await fetch(`${API_BASE_URL}/users`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const rawUsers = json.data || json || [];
      if (Array.isArray(rawUsers) && rawUsers.length > 0) {
        return rawUsers.map((u) => ({
          id: u.id,
          name: u.name,
          username: u.username,
          email: u.email,
          role: (u.role || 'manager').toLowerCase(),
          avatar: u.name ? u.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() : 'GS',
        }));
      }
    }
  } catch (err) {
    console.log('[Mobile API] Kullanıcı API başarısız, yerel kullanıcılar:', err.message);
  }
  return DEMO_USERS;
};

// 6. Kullanıcı Rolü Güncelleme
export const apiUpdateUserRole = async (userId, newRole) => {
  try {
    const res = await fetch(`${API_BASE_URL}/users/${userId}/role`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: newRole.toUpperCase() }),
    });
    if (res.ok) {
      return { success: true };
    }
  } catch (err) {
    console.log('[Mobile API] Rol güncelleme API hatası:', err.message);
  }
  return { success: false };
};
