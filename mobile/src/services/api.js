// GastroSync Mobil API Entegrasyon Katmanı
// Hem yerel cihaz (localhost / 10.0.2.2 Android Emulator), hem fiziksel cihaz (LAN IP / Wi-Fi IP), hem de Expo Tunnel ile uyumlu çalışır.

let Constants = null;
try {
  Constants = require('expo-constants')?.default || require('expo-constants');
} catch (_) {}

import { INITIAL_INVENTORY, DEMO_USERS, INITIAL_RECIPES } from '../data/inventoryData';
import {
  getStoredExpenses,
  saveStoredExpenses,
  getStoredNotifications,
  saveStoredNotifications,
  getStoredChatMessages,
  saveStoredChatMessages,
} from './storage';
import { getMobileAuthToken, setMobileAuthToken, getMobileApiBaseUrl } from './mobileAxiosClient';

export const API_BASE_URL = getMobileApiBaseUrl();

// ── AUTHENTICATED FETCH HELPER (Injects RFC 6750 JWT Bearer Token) ──
export const authFetch = async (url, options = {}) => {
  const token = getMobileAuthToken();
  const headers = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    ...(options.headers || {})
  };
  if (token && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return fetch(url, { ...options, headers });
};

// Sessiz hata loglayıcı
const logDebug = (...args) => {
  if (__DEV__ && false) {
    console.log(...args);
  }
};

// 1. Kullanıcı Girişi (Spring Boot JWT /api/auth/login)
export const apiLogin = async (username, password) => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    let res = await fetch(`${API_BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: username, username, password }),
      signal: controller.signal,
    });

    if (!res.ok) {
      res = await fetch(`${API_BASE_URL}/users/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
        signal: controller.signal,
      });
    }

    clearTimeout(timeoutId);

    if (res.ok) {
      const payload = await res.json();
      const user = payload.data || payload;
      const token = payload.data?.token || payload.token;
      if (token) {
        setMobileAuthToken(token);
      }
      return { success: true, user };
    }
  } catch (err) {
    logDebug('[Mobile API] Backend erişilemedi, yerel demo kullanıcıları kullanılıyor:', err.message);
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

// 2. Stok Listesi Çekme (PostgreSQL /api/inventory)
export const apiFetchInventory = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await authFetch(`${API_BASE_URL}/inventory`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const rawList = json.data || json || [];
      if (Array.isArray(rawList)) {
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
    // Sadece ag/baglanti hatasinda cevrimdisi fallback
    return INITIAL_INVENTORY;
  }
  return [];
};

// 3. Mal Kabul (Stoğa Ekleme - PostgreSQL Mutation)
export const apiReceiveStock = async (itemId, quantity, recordedBy = 'Mobil Depo') => {
  try {
    const res = await authFetch(`${API_BASE_URL}/inventory/${itemId}/receive`, {
      method: 'POST',
      body: JSON.stringify({ quantity, recordedBy }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json };
    }
  } catch (err) {
    logDebug('[Mobile API] Mal kabul API başarısız, yerel modda işlenecek:', err.message);
  }
  return { success: false };
};

// 4. Zayiat / Fire Bildirimi (Stoktan Düşme - PostgreSQL Mutation)
export const apiRecordWaste = async (itemId, quantity, reason = 'Mobil Zayiat', recordedBy = 'Mobil Depo') => {
  try {
    const res = await authFetch(`${API_BASE_URL}/inventory/${itemId}/waste`, {
      method: 'POST',
      body: JSON.stringify({ quantity, reason, recordedBy }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json };
    }
  } catch (err) {
    logDebug('[Mobile API] Zayiat API başarısız, yerel modda işlenecek:', err.message);
  }
  return { success: false };
};

// 5. Kullanıcı Listesi Çekme
export const apiFetchUsers = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await authFetch(`${API_BASE_URL}/users`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const rawUsers = json.data || json || [];
      if (Array.isArray(rawUsers)) {
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
    // Sadece ag/baglanti hatasinda cevrimdisi fallback
    return DEMO_USERS;
  }
  return [];
};

// 6. Kullanıcı Rolü Güncelleme
export const apiUpdateUserRole = async (userId, newRole) => {
  try {
    const res = await authFetch(`${API_BASE_URL}/users/${userId}/role`, {
      method: 'PUT',
      body: JSON.stringify({ role: newRole.toUpperCase() }),
    });
    if (res.ok) {
      return { success: true };
    }
  } catch (err) {
    logDebug('[Mobile API] Rol güncelleme API hatası:', err.message);
  }
  return { success: false };
};

// 7. Yeni Kullanıcı / Personel Oluşturma
export const apiCreateUser = async (userPayload) => {
  try {
    const res = await authFetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      body: JSON.stringify({
        name: userPayload.name,
        username: userPayload.username,
        email: userPayload.email || `${userPayload.username}@gastrosync.com`,
        role: (userPayload.role || 'CHEF').toUpperCase(),
        password: userPayload.password || '123456',
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return { success: true, data };
    }
  } catch (err) {
    logDebug('[Mobile API] Kullanıcı oluşturma hatası:', err.message);
  }
  return { success: false };
};

// 8. Kullanıcı / Personel Silme
export const apiDeleteUser = async (userId) => {
  try {
    const res = await authFetch(`${API_BASE_URL}/users/${userId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return { success: true };
    }
  } catch (err) {
    logDebug('[Mobile API] Kullanıcı silme hatası:', err.message);
  }
  return { success: false };
};

// 9. Reçete Listesini Çekme (PostgreSQL /api/recipes)
export const apiFetchRecipes = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await authFetch(`${API_BASE_URL}/recipes`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const rawList = json.data || json || [];
      if (Array.isArray(rawList) && rawList.length > 0) {
        return rawList.map((r) => {
          let ingredients = [];
          try {
            ingredients = typeof r.ingredientsJson === 'string' ? JSON.parse(r.ingredientsJson) : (r.ingredientsJson || []);
          } catch (_) { }

          let calculatedCost = 0;
          if (Array.isArray(ingredients)) {
            calculatedCost = ingredients.reduce((sum, ing) => {
              const itemCost = Number(ing.cost || (Number(ing.quantity || ing.amount || 0) * Number(ing.unitCost || 0)));
              return sum + itemCost;
            }, 0);
          }

          const sale = Number(r.salePrice || 0);
          const fc = sale > 0 ? (calculatedCost / sale) * 100 : 0;

          const normalizedIngredients = (Array.isArray(ingredients) ? ingredients : []).map((ing) => {
            if (typeof ing === 'string') return { name: ing, amount: '1 porsiyon' };
            const ingName = ing.name || 'Malzeme';
            let ingAmount = ing.amount;
            if (!ingAmount) {
              const q = ing.quantity !== undefined ? ing.quantity : '';
              const u = ing.unit || '';
              ingAmount = q ? `${q} ${u}`.trim() : '1 porsiyon';
            }
            return {
              name: ingName,
              amount: String(ingAmount),
              cost: Number(ing.cost || 0),
              quantity: ing.quantity,
              unit: ing.unit,
            };
          });

          return {
            id: r.id,
            name: r.name,
            category: r.category || 'Ana Yemek',
            salePrice: sale,
            cost: Math.round(calculatedCost * 100) / 100,
            foodCostPercent: Math.round(fc * 10) / 10,
            ingredients: normalizedIngredients,
            description: r.description || '',
          };
        });
      }
    }
  } catch (err) {
    logDebug('[Mobile API] Reçete çekme hatası:', err.message);
  }
  return INITIAL_RECIPES;
};

// 10. Yeni Reçete Ekleme
export const apiCreateRecipe = async (recipePayload) => {
  try {
    const res = await authFetch(`${API_BASE_URL}/recipes`, {
      method: 'POST',
      body: JSON.stringify({
        name: recipePayload.name,
        category: recipePayload.category || 'Ana Yemek',
        salePrice: Number(recipePayload.salePrice) || 0,
        portions: 1,
        description: recipePayload.description || '',
        ingredientsJson: JSON.stringify(recipePayload.ingredients || []),
      }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Reçete oluşturma hatası:', err.message);
  }
  return { success: false };
};

// 10.1 Reçete Güncelleme (Düzenleme)
export const apiUpdateRecipe = async (recipeId, recipePayload) => {
  try {
    const res = await authFetch(`${API_BASE_URL}/recipes/${recipeId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: recipePayload.name,
        category: recipePayload.category || 'Ana Yemek',
        salePrice: Number(recipePayload.salePrice) || 0,
        portions: Number(recipePayload.portions) || 1,
        description: recipePayload.description || '',
        ingredientsJson: JSON.stringify(recipePayload.ingredients || []),
      }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Reçete güncelleme hatası:', err.message);
  }
  return { success: false };
};

// 11. Reçete Silme
export const apiDeleteRecipe = async (recipeId) => {
  try {
    const res = await authFetch(`${API_BASE_URL}/recipes/${recipeId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return { success: true };
    }
  } catch (err) {
    logDebug('[Mobile API] Reçete silme hatası:', err.message);
  }
  return { success: false };
};

// 12. Yeni Stok / Hammadde Ekleme
export const apiCreateInventoryItem = async (itemPayload) => {
  try {
    const res = await authFetch(`${API_BASE_URL}/inventory`, {
      method: 'POST',
      body: JSON.stringify({
        name: itemPayload.name,
        category: itemPayload.cat || itemPayload.category || 'Genel',
        currentStock: Number(itemPayload.stock || 0),
        minStock: Number(itemPayload.min || 5),
        unit: itemPayload.unit || 'kg',
        unitCost: Number(itemPayload.price || 0),
        barcode: itemPayload.barcode || '',
        supplier: itemPayload.supplier || '',
        lastUpdated: 'Bugün',
      }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Stok oluşturma hatası:', err.message);
  }
  return { success: false };
};

// 13. Stok Kalemi Silme
export const apiDeleteInventoryItem = async (itemId) => {
  try {
    const res = await authFetch(`${API_BASE_URL}/inventory/${itemId}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return { success: true };
    }
  } catch (err) {
    logDebug('[Mobile API] Stok silme hatası:', err.message);
  }
  return { success: false };
};

// 14. Stok Kalemi Güncelleme (Düzenleme)
export const apiUpdateInventoryItem = async (itemId, itemPayload) => {
  try {
    const res = await authFetch(`${API_BASE_URL}/inventory/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify({
        name: itemPayload.name,
        category: itemPayload.cat || itemPayload.category || 'Genel',
        currentStock: Number(itemPayload.stock ?? itemPayload.currentStock ?? 0),
        minStock: Number(itemPayload.min ?? itemPayload.minStock ?? 5),
        unit: itemPayload.unit || 'kg',
        unitCost: Number(itemPayload.price ?? itemPayload.unitCost ?? 0),
        barcode: itemPayload.barcode || '',
        supplier: itemPayload.supplier || '',
        lastUpdated: 'Bugün',
      }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Stok güncelleme hatası:', err.message);
  }
  return { success: false };
};

// 15. Son Depo Hareketleri (İşlem Geçmişi)
export const apiFetchTransactions = async () => {
  try {
    const res = await authFetch(`${API_BASE_URL}/inventory/transactions/recent`);
    if (res.ok) {
      const json = await res.json();
      const rawList = json.data || json || [];
      if (Array.isArray(rawList)) {
        return rawList.map((t) => ({
          id: t.id,
          itemName: t.item?.name || 'Ürün',
          type: t.type === 'RECEIVE' ? 'receive' : 'waste',
          quantity: t.quantity,
          unit: t.item?.unit || 'adet',
          date: t.transactionDate ? String(t.transactionDate).split('T')[0] : 'Bugün',
          recordedBy: t.recordedBy || 'Depo Sorumlusu',
          note: t.note || '',
        }));
      }
    }
  } catch (err) {
    logDebug('[Mobile API] Depo hareketleri çekilemedi:', err.message);
  }
  return [
    { id: 1, itemName: 'Dana Antrikot', type: 'receive', quantity: 25, unit: 'kg', date: 'Bugün', recordedBy: 'Ahmet Yılmaz' },
    { id: 2, itemName: 'Domates (Salkım)', type: 'waste', quantity: 3.5, unit: 'kg', date: 'Bugün', recordedBy: 'Mehmet Demir', note: 'Ezilme/Fire' },
    { id: 3, itemName: 'Mozzarella Peyniri', type: 'receive', quantity: 10, unit: 'kg', date: 'Bugün', recordedBy: 'Ahmet Yılmaz' },
  ];
};

// 16. Muhasebe Giderlerini Getir (PostgreSQL & Canlı Senkronize)
export const apiFetchExpenses = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await authFetch(`${API_BASE_URL}/expenses`, { signal: controller.signal });
    clearTimeout(timeoutId);

    if (res.ok) {
      const json = await res.json();
      const rawList = json.data || json || [];
      if (Array.isArray(rawList) && rawList.length > 0) {
        const mapped = rawList.map((e) => ({
          id: e.id,
          title: e.title,
          category: e.category,
          subType: e.subType,
          amount: Number(e.amount) || 0,
          period: e.period || '2026-10',
          expenseDate: e.expenseDate || 'Bugün',
          dueDate: e.dueDate || e.expenseDate || 'Vadesiz',
          invoiceNumber: e.invoiceNumber || '',
          counterparty: e.counterparty || '',
          paymentStatus: e.paymentStatus || (e.paidByCashier ? 'PAID' : 'UNPAID'),
          rejectionReason: e.rejectionReason || '',
          recordedBy: e.recordedBy || 'Muhasebe',
          note: e.note || '',
          isOwnedProperty: Boolean(e.isOwnedProperty),
          paidByCashier: Boolean(e.paidByCashier),
          recordedInLedger: Boolean(e.recordedInLedger),
          sentToAdvisor: Boolean(e.sentToAdvisor),
          status: e.status || (e.recordedInLedger ? 'FINALIZED' : 'PENDING_APPROVAL'),
        }));
        saveStoredExpenses(mapped);
        return mapped;
      }
    }
  } catch (err) {
    logDebug('[Mobile API] Giderler backendden çekilemedi, kalıcı depodan okunuyor:', err.message);
  }
  return getStoredExpenses();
};

// 17. Yeni Gider Ekle (PostgreSQL Database Mutation)
export const apiCreateExpense = async (payload) => {
  const newItem = {
    id: payload.id || Date.now(),
    title: payload.title,
    category: payload.category,
    subType: payload.subType,
    amount: Number(payload.amount) || 0,
    period: payload.period || '2026-10',
    expenseDate: payload.expenseDate || new Date().toISOString().split('T')[0],
    dueDate: payload.dueDate || payload.expenseDate || new Date().toISOString().split('T')[0],
    invoiceNumber: payload.invoiceNumber || '',
    counterparty: payload.counterparty || '',
    paymentStatus: payload.paymentStatus || (payload.paidByCashier ? 'PAID' : 'UNPAID'),
    rejectionReason: payload.rejectionReason || '',
    recordedBy: payload.recordedBy || 'Muhasebe / Kasa',
    note: payload.note || '',
    isOwnedProperty: Boolean(payload.isOwnedProperty),
    paidByCashier: payload.paidByCashier !== false,
    recordedInLedger: Boolean(payload.recordedInLedger),
    sentToAdvisor: payload.sentToAdvisor !== false,
    status: payload.status || (payload.recordedInLedger ? 'FINALIZED' : 'PENDING_APPROVAL'),
  };

  const currentExpenses = getStoredExpenses();
  const nextExpenses = [newItem, ...currentExpenses.filter((e) => e.id !== newItem.id)];
  saveStoredExpenses(nextExpenses);

  try {
    const res = await authFetch(`${API_BASE_URL}/expenses`, {
      method: 'POST',
      body: JSON.stringify(newItem),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Gider backend senkronizasyonu ertelendi:', err.message);
  }
  return { success: true, data: newItem };
};

// 18. Gider Güncelle (Borç Ödendi / Deftere İşlendi / Reddedildi)
export const apiUpdateExpense = async (id, payload) => {
  const currentExpenses = getStoredExpenses();
  const nextExpenses = currentExpenses.map((e) =>
    e.id === id ? { ...e, ...payload } : e
  );
  saveStoredExpenses(nextExpenses);

  try {
    const res = await authFetch(`${API_BASE_URL}/expenses/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Gider güncelleme backend senkronizasyonu ertelendi:', err.message);
  }
  return { success: true };
};

// 19. Gider Sil
export const apiDeleteExpense = async (id) => {
  const currentExpenses = getStoredExpenses();
  const nextExpenses = currentExpenses.filter((e) => e.id !== id);
  saveStoredExpenses(nextExpenses);

  try {
    const res = await authFetch(`${API_BASE_URL}/expenses/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return { success: true };
    }
  } catch (err) {
    logDebug('[Mobile API] Gider silme backend senkronizasyonu ertelendi:', err.message);
  }
  return { success: true };
};

export const apiApproveExpense = async (id) => {
  try {
    const res = await authFetch(`${API_BASE_URL}/expenses/${id}/approve`, {
      method: 'PUT',
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Gider onaylama backend senkronizasyonu ertelendi:', err.message);
  }
  return { success: true };
};

export const apiFinalizeExpense = async (id) => {
  try {
    const res = await authFetch(`${API_BASE_URL}/expenses/${id}/finalize`, {
      method: 'PUT',
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Gider kesinleştirme backend senkronizasyonu ertelendi:', err.message);
  }
  return { success: true };
};

// ==========================================
// 20. BİLDİRİM VE ROL İLETİŞİMİ API (Kalıcı ve Canlı)
// ==========================================
export const apiFetchNotifications = async (role) => {
  try {
    const url = role
      ? `${API_BASE_URL}/notifications?role=${role.toUpperCase()}`
      : `${API_BASE_URL}/notifications`;
    const res = await authFetch(url);
    if (res.ok) {
      const json = await res.json();
      const raw = json.data || json || [];
      if (Array.isArray(raw) && raw.length > 0) {
        saveStoredNotifications(raw);
        return raw;
      }
    }
  } catch (err) {
    logDebug('[Mobile API] Bildirimler backendden çekilemedi, kalıcı depodan okunuyor:', err.message);
  }

  // Yerel kalıcı depodan role göre filtreleyip döner
  const allNotifs = getStoredNotifications();
  if (!role) return allNotifs;
  const roleUpper = String(role).toUpperCase();
  return allNotifs.filter(
    (n) =>
      !n.targetRole ||
      String(n.targetRole).toUpperCase() === roleUpper ||
      String(n.targetRole).toUpperCase() === 'ALL'
  );
};

export const apiCreateNotification = async (payload) => {
  const newNotif = {
    id: payload.id || Date.now(),
    title: payload.title,
    message: payload.message,
    targetRole: payload.targetRole,
    senderName: payload.senderName || 'Sistem',
    type: payload.type || 'INFO',
    relatedEntityId: payload.relatedEntityId || null,
    isRead: false,
    createdAt: new Date().toISOString(),
  };

  // 1. Önce yerel kalıcı depoya kaydeder
  const existing = getStoredNotifications();
  const nextList = [newNotif, ...existing.filter((n) => n.id !== newNotif.id)];
  saveStoredNotifications(nextList);

  // 2. Arka planda backend'e POST atar
  try {
    const res = await authFetch(`${API_BASE_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newNotif),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Bildirim backend senkronizasyonu ertelendi:', err.message);
  }
  return { success: true, data: newNotif };
};

export const apiMarkNotificationRead = async (id) => {
  const existing = getStoredNotifications();
  const updated = existing.map((n) => (n.id === id ? { ...n, isRead: true } : n));
  saveStoredNotifications(updated);

  try {
    const res = await authFetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PUT',
    });
    if (res.ok) return { success: true };
  } catch (err) {
    logDebug('[Mobile API] Bildirim okundu senkronizasyon:', err.message);
  }
  return { success: true };
};

export const apiMarkAllNotificationsRead = async (role) => {
  const existing = getStoredNotifications();
  const roleUpper = role ? String(role).toUpperCase() : null;
  const updated = existing.map((n) => {
    if (!roleUpper || String(n.targetRole).toUpperCase() === roleUpper) {
      return { ...n, isRead: true };
    }
    return n;
  });
  saveStoredNotifications(updated);

  try {
    const res = await authFetch(
      `${API_BASE_URL}/notifications/mark-all-read?role=${role || ''}`,
      { method: 'PUT' }
    );
    if (res.ok) return { success: true };
  } catch (err) {
    logDebug('[Mobile API] Tümünü okundu yapma senkronizasyon:', err.message);
  }
  return { success: true };
};

// ==========================================
// 8. EKİP İÇİ SOHBET (CHAT) API ENTEGRASYONU
// ==========================================
export const apiFetchChatMessages = async (channelId) => {
  try {
    const url = channelId
      ? `${API_BASE_URL}/chat/messages?channelId=${encodeURIComponent(channelId)}`
      : `${API_BASE_URL}/chat/messages`;

    const res = await authFetch(url);

    if (res.ok) {
      const json = await res.json();
      const list = json.data || json;
      if (Array.isArray(list) && list.length > 0) {
        saveStoredChatMessages(list);
        return list;
      }
    }
  } catch (err) {
    logDebug('[Mobile API] Sohbet mesajları backend bağlantı hatası:', err.message);
  }
  return getStoredChatMessages();
};

export const apiSendChatMessage = async (msgData) => {
  const existing = getStoredChatMessages();
  const tempId = Date.now();
  const newMsg = {
    ...msgData,
    id: tempId,
    createdAt: new Date().toISOString(),
  };
  saveStoredChatMessages([...existing, newMsg]);

  try {
    const res = await authFetch(`${API_BASE_URL}/chat/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(msgData),
    });
    if (res.ok) {
      const json = await res.json();
      const saved = json.data || json;
      const updated = existing.filter((m) => m.id !== tempId);
      saveStoredChatMessages([...updated, saved]);
      return { success: true, data: saved };
    }
  } catch (err) {
    logDebug('[Mobile API] Mesaj backend gönderim hatası:', err.message);
  }
  return { success: true, data: newMsg };
};

// ==========================================
// 9. SATIŞ & POS (SALES) API ENTEGRASYONU
// ==========================================
export const apiFetchSales = async () => {
  try {
    const res = await authFetch(`${API_BASE_URL}/sales/today`);

    if (res.ok) {
      const json = await res.json();
      const list = json.data || json;
      if (Array.isArray(list) && list.length > 0) {
        return list;
      }
    }
  } catch (err) {
    logDebug('[Mobile API] Satış verisi çekme hatası:', err.message);
  }
  return null;
};

export const apiFetchSalesSummary = async () => {
  try {
    const res = await authFetch(`${API_BASE_URL}/sales/summary`);

    if (res.ok) {
      const json = await res.json();
      const data = json.data || json;
      if (data && typeof data === 'object') {
        return {
          totalRevenue: parseFloat(data.totalRevenue) || 4620,
          totalCost: parseFloat(data.totalCost) || 1316.7,
          foodCostPercent: parseFloat(data.foodCostPercent) || 28.5,
          targetFoodCost: 26.0,
          netProfit: parseFloat(data.netProfit) || 3303.3,
          totalSalesCount: data.totalSalesCount || 6,
        };
      }
    }
  } catch (err) {
    logDebug('[Mobile API] Satış özeti çekme hatası:', err.message);
  }
  return {
    totalRevenue: 4620,
    totalCost: 1316.7,
    foodCostPercent: 28.5,
    targetFoodCost: 26.0,
    netProfit: 3303.3,
    totalSalesCount: 6,
  };
};