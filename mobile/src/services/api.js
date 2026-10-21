// GastroSync Mobil API Entegrasyon Katmanı
// Hem yerel cihaz (localhost / 10.0.2.2 Android Emulator), hem fiziksel cihaz (LAN IP / Wi-Fi IP), hem de Expo Tunnel ile uyumlu çalışır.

let Constants = null;
try {
  Constants = require('expo-constants')?.default || require('expo-constants');
} catch (_) {}

import { INITIAL_INVENTORY, DEMO_USERS, INITIAL_RECIPES } from '../data/inventoryData';

// Dinamik Host Belirleme (Expo Host, Wi-Fi LAN IP veya USB 127.0.0.1)
const getApiBaseUrl = () => {
  try {
    const hostUri = Constants?.expoConfig?.hostUri || Constants?.manifest?.debuggerHost || '';
    if (hostUri) {
      const ip = hostUri.split(':')[0];
      if (ip && ip !== 'localhost' && ip !== '127.0.0.1') {
        return `http://${ip}:8080/api`;
      }
    }
  } catch (_) {}
  // Wi-Fi ağı üzerindeki doğrudan IP adresi
  return 'http://192.168.1.53:8080/api';
};

export const API_BASE_URL = getApiBaseUrl();

// Sessiz hata loglayıcı (Backend kapalıyken veya offline iken terminali kirletmez)
const logDebug = (...args) => {
  // Canlı demo sırasında gereksiz terminal kirliliğini önlemek için sessiz çalışır
  if (__DEV__ && false) {
    console.log(...args);
  }
};

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

// 2. Stok Listesi Çekme
export const apiFetchInventory = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

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
    // Mobil cihaz tünel/Wi-Fi erişemediğinde sorunsuz yerel hafızaya döner (offline fallback)
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
    logDebug('[Mobile API] Mal kabul API başarısız, yerel modda işlenecek:', err.message);
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
    logDebug('[Mobile API] Zayiat API başarısız, yerel modda işlenecek:', err.message);
  }
  return { success: false };
};

// 5. Kullanıcı Listesi Çekme
export const apiFetchUsers = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

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
    // Mobil cihaz tünel/Wi-Fi erişemediğinde sorunsuz yerel kullanıcı hafızasına döner
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
    logDebug('[Mobile API] Rol güncelleme API hatası:', err.message);
  }
  return { success: false };
};

// 7. Yeni Kullanıcı / Personel Oluşturma
export const apiCreateUser = async (userPayload) => {
  try {
    const res = await fetch(`${API_BASE_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`${API_BASE_URL}/users/${userId}`, {
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

// 9. Reçete Listesini Çekme
export const apiFetchRecipes = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const res = await fetch(`${API_BASE_URL}/recipes`, { signal: controller.signal });
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
    const res = await fetch(`${API_BASE_URL}/recipes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`${API_BASE_URL}/recipes/${recipeId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`${API_BASE_URL}/recipes/${recipeId}`, {
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
    const res = await fetch(`${API_BASE_URL}/inventory`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`${API_BASE_URL}/inventory/${itemId}`, {
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
    const res = await fetch(`${API_BASE_URL}/inventory/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
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
    const res = await fetch(`${API_BASE_URL}/inventory/transactions/recent`);
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

// 16. Muhasebe Giderlerini Getir
export const apiFetchExpenses = async () => {
  try {
    const res = await fetch(`${API_BASE_URL}/expenses`);
    if (res.ok) {
      const json = await res.json();
      const rawList = json.data || json || [];
      if (Array.isArray(rawList)) {
        return rawList.map((e) => ({
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
          status: e.status || (e.recordedInLedger ? 'APPROVED_IN_LEDGER' : 'SENT_TO_ADVISOR'),
        }));
      }
    }
  } catch (err) {
    logDebug('[Mobile API] Giderler çekilemedi:', err.message);
  }
  return [];
};

// 17. Yeni Gider Ekle
export const apiCreateExpense = async (payload) => {
  try {
    const res = await fetch(`${API_BASE_URL}/expenses`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
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
        recordedBy: payload.recordedBy || 'Muhasebe',
        note: payload.note || '',
        isOwnedProperty: Boolean(payload.isOwnedProperty),
        paidByCashier: payload.paidByCashier !== false,
        recordedInLedger: Boolean(payload.recordedInLedger),
        sentToAdvisor: payload.sentToAdvisor !== false,
        status: payload.status || (payload.recordedInLedger ? 'APPROVED_IN_LEDGER' : 'SENT_TO_ADVISOR'),
      }),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Gider ekleme hatası:', err.message);
  }
  return { success: false };
};

// 18. Gider Güncelle (Kasadan Ödendi / Deftere İşlendi)
export const apiUpdateExpense = async (id, payload) => {
  try {
    const res = await fetch(`${API_BASE_URL}/expenses/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Gider güncelleme hatası:', err.message);
  }
  return { success: false };
};

// 19. Gider Sil
export const apiDeleteExpense = async (id) => {
  try {
    const res = await fetch(`${API_BASE_URL}/expenses/${id}`, {
      method: 'DELETE',
    });
    if (res.ok) {
      return { success: true };
    }
  } catch (err) {
    logDebug('[Mobile API] Gider silme hatası:', err.message);
  }
  return { success: false };
};

// ==========================================
// 20. BİLDİRİM VE ROL İLETİŞİMİ API
// ==========================================
export const apiFetchNotifications = async (role) => {
  try {
    const url = role
      ? `${API_BASE_URL}/notifications?role=${role.toUpperCase()}`
      : `${API_BASE_URL}/notifications`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json();
      return json.data || json || [];
    }
  } catch (err) {
    logDebug('[Mobile API] Bildirimler çekilemedi:', err.message);
  }
  return [];
};

export const apiCreateNotification = async (payload) => {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      const json = await res.json();
      return { success: true, data: json.data || json };
    }
  } catch (err) {
    logDebug('[Mobile API] Bildirim oluşturma hatası:', err.message);
  }
  return { success: false };
};

export const apiMarkNotificationRead = async (id) => {
  try {
    const res = await fetch(`${API_BASE_URL}/notifications/${id}/read`, {
      method: 'PUT',
    });
    if (res.ok) return { success: true };
  } catch (err) {
    logDebug('[Mobile API] Bildirim okundu hatası:', err.message);
  }
  return { success: false };
};

export const apiMarkAllNotificationsRead = async (role) => {
  try {
    const res = await fetch(
      `${API_BASE_URL}/notifications/mark-all-read?role=${role || ''}`,
      { method: 'PUT' }
    );
    if (res.ok) return { success: true };
  } catch (err) {
    logDebug('[Mobile API] Tümünü okundu yapma hatası:', err.message);
  }
  return { success: false };
};