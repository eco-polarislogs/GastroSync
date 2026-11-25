// GastroSync Mobil API Katmanı
//
// Üretim kuralları:
//  - Tek veri kaynağı backend'dir. Sahte / örnek veri, çevrimdışı sahte oturum veya şifre tahmini YOKTUR.
//  - Başarısız işlemler { success: false, message } döner; arayüz kullanıcıya gösterir.
//  - Gider iş akışı (onay, ödeme, deftere işleme, ret) ilgili uç noktalara yönlendirilir;
//    yetki ve meslek etiği kuralları (görevler ayrılığı, belge düzeni, dönem kilidi) sunucuda uygulanır.
//  - İş akışı bildirimlerini sunucu üretir; istemci bildirim üretmez.

import {
  getMobileAuthToken, clearMobileAuthToken, getMobileApiBaseUrl, notifySessionExpired,
  setMobileSession, refreshMobileSession, getMobileRefreshToken,
} from './mobileAxiosClient';
import mobileWebSocketService from './websocketService';
import { unregisterRemotePush } from './pushNotifications';
import {
  newIdempotencyKey, isQueueable, isCacheable, enqueue, cachePut, cacheGet, setOnline, flushQueue, getOfflineState,
  setOfflineOwner, loadOfflineStore,
} from './offlineQueue';

export const API_BASE_URL = getMobileApiBaseUrl();

let currentUser = null;
let errorHandler = null;

/** Okuma hatalarını arayüze (toast) iletmek için */
export const setApiErrorHandler = (fn) => { errorHandler = fn; };
const reportError = (message) => {
  if (errorHandler && message) {
    try { errorHandler(message); } catch (_) { /* yoksay */ }
  }
};

const num = (v) => {
  const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const isAuthPath = (path) => /^\/auth\/(login|refresh|logout)/.test(path);

const OFFLINE_QUEUED = 'Çevrimdışı: işlem cihazda sıraya alındı; bağlantı gelince otomatik gönderilecek.';
const OFFLINE_STALE = 'Çevrimdışı: son kaydedilen bilgiler gösteriliyor.';

const request = async (path, {
  method = 'GET', body, timeout = 12000, retried = false, idempotencyKey, noQueue = false,
} = {}) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const headers = { 'Content-Type': 'application/json', Accept: 'application/json' };
  const token = getMobileAuthToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  // Yazma isteklerine benzersiz anahtar: yanıt kaybolup yeniden gönderilirse sunucu işlemi tekrarlamaz
  const key = method !== 'GET' && !isAuthPath(path) ? (idempotencyKey || newIdempotencyKey()) : null;
  if (key) headers['Idempotency-Key'] = key;
  try {
    const res = await fetch(`${getMobileApiBaseUrl()}${path}`, {
      method, headers, body: body !== undefined ? JSON.stringify(body) : undefined, signal: controller.signal,
    });
    let json = null;
    try { json = await res.json(); } catch (_) { json = null; }
    setOnline(true);
    if (res.status === 401 && !isAuthPath(path)) {
      // Erişim token'ı dolmuş olabilir: bir kez yenileyip isteği tekrarla
      if (!retried && getMobileRefreshToken()) {
        const renewed = await refreshMobileSession();
        if (renewed) return request(path, { method, body, timeout, retried: true, idempotencyKey: key || undefined, noQueue });
        if (renewed === undefined) {
          return { ok: false, status: 401, data: null, message: 'Oturum yenilenemedi; bağlantınızı kontrol edip tekrar deneyin.' };
        }
      }
      notifySessionExpired();
      mobileWebSocketService.disconnect();
    }
    const message = json?.message || (res.ok ? '' : `İşlem başarısız (HTTP ${res.status})`);
    const data = json && 'data' in json ? json.data : json;
    if (res.ok && method === 'GET' && isCacheable(path)) cachePut(currentUser?.username, path, data);
    if (res.ok && getOfflineState().pending > 0) setTimeout(flushOfflineQueue, 0);
    return { ok: res.ok, status: res.status, data, message, code: json?.code };
  } catch (err) {
    setOnline(false);
    if (method === 'GET' && isCacheable(path)) {
      const cached = cacheGet(currentUser?.username, path);
      if (cached) return { ok: true, status: 200, data: cached.data, message: OFFLINE_STALE, stale: true };
    }
    if (key && !noQueue && isQueueable(method, path)) {
      try {
        await enqueue({ method, path, body, key });
        return { ok: false, status: 0, data: null, message: OFFLINE_QUEUED, queued: true };
      } catch (_) { /* kuyruk dolu: normal hata */ }
    }
    const message = err?.name === 'AbortError'
      ? 'Sunucu yanıt vermedi (zaman aşımı).'
      : 'Sunucuya ulaşılamıyor. Bağlantınızı ve sunucu adresini kontrol edin.';
    return { ok: false, status: 0, data: null, message };
  } finally {
    clearTimeout(timer);
  }
};

/** Bağlantı gelince sıradaki çevrimdışı işlemleri gönderir; reddedilenleri kullanıcıya bildirir */
export const flushOfflineQueue = async () => {
  if (!getMobileAuthToken()) return 0;
  return flushQueue(
    (op) => request(op.path, { method: op.method, body: op.body, idempotencyKey: op.key, noQueue: true }),
    (op, message) => reportError(`Çevrimdışı işlem gönderilemedi (${op.path}): ${message}`),
  );
};
loadOfflineStore();
setInterval(() => { if (getOfflineState().pending > 0) flushOfflineQueue(); }, 20000);

const result = (res, data) => (res.ok
  ? { success: true, data: data !== undefined ? data : res.data, message: res.message, stale: !!res.stale }
  : { success: false, message: res.message, status: res.status, code: res.code, queued: !!res.queued });

const readList = async (path, mapper = (x) => x) => {
  const res = await request(path);
  if (!res.ok) {
    reportError(res.message);
    return [];
  }
  return Array.isArray(res.data) ? res.data.map(mapper) : [];
};

const initials = (name) => (name ? name.split(' ').filter(Boolean).map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'GS');

const mapUser = (auth) => ({
  id: auth.userId || auth.id,
  username: auth.username,
  name: auth.name,
  email: auth.email || '',
  role: (auth.role || '').toLowerCase(),
  roleLabel: auth.roleLabel || '',
  // Ekranlar ve izinler sunucudaki tek yetki tablosundan gelir (istemci kendi tablosunu tutmaz)
  permissions: Array.isArray(auth.permissions) ? auth.permissions : [],
  screens: Array.isArray(auth.screens) ? auth.screens : [],
  avatar: initials(auth.name),
  mustChangePassword: !!auth.mustChangePassword,
});

// ── Kimlik doğrulama ───────────────────────────────────────────
export const apiLogin = async (username, password) => {
  const identifier = (username || '').trim();
  if (!identifier || !password) return { success: false, message: 'Kullanıcı adı ve şifre zorunludur.' };
  // Ücretsiz bulut sunucusu uykudaysa ilk istek ~1 dk sürebilir: girişte uzun bekleme süresi
  const res = await request('/auth/login', { method: 'POST', body: { identifier, password }, timeout: 75000 });
  if (!res.ok || !res.data?.token) return { success: false, message: res.message || 'Giriş başarısız.' };
  setMobileSession(res.data);
  currentUser = mapUser(res.data);
  setOfflineOwner(currentUser.username);
  return { success: true, user: currentUser };
};

export const apiChangePassword = async (currentPassword, newPassword) => {
  const res = await request('/auth/change-password', { method: 'POST', body: { currentPassword, newPassword } });
  if (!res.ok || !res.data?.token) return { success: false, message: res.message };
  setMobileSession(res.data);
  currentUser = mapUser(res.data);
  setOfflineOwner(currentUser.username);
  mobileWebSocketService.disconnect();
  return { success: true, user: currentUser };
};

/** Sunucudaki güncel rol / ad / hesap durumu (rol değişikliği senkronu için) */
export const apiFetchMe = async () => {
  const res = await request('/auth/me');
  if (res.ok && res.data?.username) {
    // Uygulama yeniden açıldığında oturum geri yüklenir: çevrimdışı kuyruk ve önbellek bu kullanıcıya bağlanır
    if (!currentUser || currentUser.username !== res.data.username) currentUser = mapUser(res.data);
    setOfflineOwner(res.data.username);
  }
  return res.ok ? res.data : null;
};

/** Demo modu açıksa çalışan demo hesapları (canlıda boş liste) */
export const apiFetchDemoAccounts = async () => {
  const res = await request('/auth/demo-accounts', { timeout: 75000 });
  return res.ok && Array.isArray(res.data?.accounts) ? res.data.accounts : [];
};

/** Bu cihazdan çıkış: sunucudaki yenileme token'ı iptal edilir (ağ yoksa yerel oturum yine kapanır) */
export const apiLogout = () => {
  // Cihaz push kaydı erişim token'ı silinmeden önce kaldırılır (bu telefona artık bildirim gitmez)
  unregisterRemotePush();
  const refreshToken = getMobileRefreshToken();
  if (refreshToken) request('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
  currentUser = null;
  setOfflineOwner(null);
  mobileWebSocketService.disconnect();
  clearMobileAuthToken();
};

/** Tüm cihazlardan çıkış (kayıp / çalıntı telefon) */
export const apiLogoutAll = async () => {
  const res = await request('/auth/logout-all', { method: 'POST' });
  if (res.ok) {
    currentUser = null;
    mobileWebSocketService.disconnect();
    clearMobileAuthToken();
  }
  return result(res);
};

export const apiFetchSessions = () => readList('/auth/sessions');
export const apiRevokeUserSessions = async (userId) => result(await request(`/users/${userId}/revoke-sessions`, { method: 'POST' }));

// ── Onay talepleri (roller arası: Kasiyer / Depo -> İşletme Müdürü) ─────────
export const apiFetchApprovals = async ({ scope = 'inbox', status = 'PENDING', page = 0, size = 30 } = {}) => {
  const res = await request(`/approvals?scope=${encodeURIComponent(scope)}&status=${encodeURIComponent(status)}&page=${page}&size=${size}`);
  if (!res.ok) return { success: false, message: res.message, content: [], totalElements: 0 };
  return { success: true, content: res.data?.content || [], totalElements: res.data?.totalElements || 0, totalPages: res.data?.totalPages || 0 };
};
export const apiFetchApprovalSummary = async () => {
  const res = await request('/approvals/summary');
  return res.ok ? res.data : null;
};
/** type: ITEM_VOID | CHECK_VOID | COMP | DISCOUNT | STOCK_ADJUST */
export const apiRequestApproval = async (payload) => result(await request('/approvals', { method: 'POST', body: payload }));
export const apiDecideApproval = async (id, decision, note) =>
  result(await request(`/approvals/${id}/decide`, { method: 'PUT', body: { decision, note } }));
export const apiWithdrawApproval = async (id) => result(await request(`/approvals/${id}/withdraw`, { method: 'PUT' }));
export const apiPosComp = async (itemId, reason) => result(await request(`/pos/items/${itemId}/comp`, { method: 'PUT', body: { reason } }));
export const apiPosDiscount = async (checkId, { percent, amount, reason }) =>
  result(await request(`/pos/checks/${checkId}/discount`, { method: 'PUT', body: { percent, amount, reason } }));
export const apiPosRemoveDiscount = async (checkId) => result(await request(`/pos/checks/${checkId}/discount`, { method: 'DELETE' }));

// ── Stok ───────────────────────────────────────────────────────
const mapItem = (item) => ({
  id: item.id,
  barcode: item.barcode || '',
  name: item.name,
  cat: item.category || 'Genel',
  category: item.category || 'Genel',
  unit: item.unit || 'kg',
  stock: num(item.currentStock),
  min: num(item.minStock),
  price: num(item.unitCost),
  supplier: item.supplier && item.supplier !== '-' ? item.supplier : '',
});

export const apiFetchInventory = () => readList('/inventory', mapItem);

export const apiReceiveStock = async (itemId, quantity, _recordedBy, extra = {}) =>
  result(await request(`/inventory/${itemId}/receive`, { method: 'POST', body: { quantity: num(quantity), ...extra } }));

export const apiRecordWaste = async (itemId, quantity, reason) =>
  result(await request(`/inventory/${itemId}/waste`, { method: 'POST', body: { quantity: num(quantity), reason } }));

export const apiAdjustStock = async (itemId, countedQuantity, reason) =>
  result(await request(`/inventory/${itemId}/adjust`, { method: 'POST', body: { countedQuantity: num(countedQuantity), reason } }));

export const apiPurchaseRequest = async (itemId, quantity, urgent = false, note = '') =>
  result(await request(`/inventory/${itemId}/purchase-request`, { method: 'POST', body: { quantity: num(quantity), urgent, note } }));

export const apiFetchPendingDeliveries = () => readList('/inventory/pending-deliveries');

const itemBody = (p) => ({
  name: p.name,
  category: p.cat || p.category || 'Genel',
  currentStock: num(p.stock ?? p.currentStock),
  minStock: num(p.min ?? p.minStock),
  unit: p.unit || 'kg',
  unitCost: num(p.price ?? p.unitCost),
  barcode: p.barcode || '',
  supplier: p.supplier || '',
});

export const apiCreateInventoryItem = async (p) => result(await request('/inventory', { method: 'POST', body: itemBody(p) }));
export const apiUpdateInventoryItem = async (id, p) => result(await request(`/inventory/${id}`, { method: 'PUT', body: itemBody(p) }));
export const apiDeleteInventoryItem = async (id) => result(await request(`/inventory/${id}`, { method: 'DELETE' }));

const TX_TYPES = { INBOUND: 'receive', WASTE: 'waste', OUTBOUND_SALE: 'sale', SALE_REVERSAL: 'reversal', ADJUSTMENT: 'adjust' };
export const apiFetchTransactions = () => readList('/inventory/transactions/recent', (t) => ({
  id: t.id,
  itemName: t.item?.name || '-',
  type: TX_TYPES[t.type] || 'other',
  rawType: t.type,
  quantity: num(t.quantity),
  unit: t.item?.unit || '',
  date: t.timestamp ? new Date(t.timestamp).toLocaleString('tr-TR') : '',
  recordedBy: t.recordedBy || '',
  note: t.reason || '',
}));

// ── Kullanıcılar ───────────────────────────────────────────────
export const apiFetchUsers = () => readList('/users', (u) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email || '',
  role: (u.role || '').toLowerCase(),
  avatar: initials(u.name),
  active: u.active !== false,
}));

export const apiUpdateUserRole = async (userId, newRole) =>
  result(await request(`/users/${userId}/role`, { method: 'PUT', body: { role: String(newRole).toUpperCase() } }));

export const apiCreateUser = async (p) => result(await request('/users', {
  method: 'POST',
  body: {
    username: (p.username || '').trim().toLowerCase(),
    name: p.name,
    email: p.email || undefined,
    role: String(p.role || '').toUpperCase(),
    password: p.password,
  },
}));

export const apiDeleteUser = async (id) => result(await request(`/users/${id}`, { method: 'DELETE' }));
/** Rol kataloğu (görev tanımı, ekranlar, izinler) — tek kaynak sunucudaki Permissions tablosu */
export const apiFetchRoleCatalog = async () => result(await request('/auth/roles'));
// Yönetici: hesap aktif / pasif, geçici şifre, ad-soyad / e-posta düzeltme (web ile aynı uçlar)
export const apiSetUserActive = async (id, active) =>
  result(await request(`/users/${id}/status`, { method: 'PUT', body: { active } }));
export const apiResetUserPassword = async (id, temporaryPassword) =>
  result(await request(`/users/${id}/reset-password`, { method: 'POST', body: { temporaryPassword } }));
export const apiUpdateUserProfile = async (id, { name, email }) =>
  result(await request(`/users/${id}`, { method: 'PUT', body: { name, email } }));

// ── Reçeteler ──────────────────────────────────────────────────
const parseIngredients = (json) => {
  try {
    const raw = typeof json === 'string' ? JSON.parse(json || '[]') : json;
    return Array.isArray(raw) ? raw : [];
  } catch (_) {
    return [];
  }
};

export const apiFetchRecipes = () => readList('/recipes', (r) => ({
  id: r.id,
  name: r.name,
  category: r.category || 'Ana Yemek',
  salePrice: num(r.salePrice),
  vatRate: num(r.vatRate ?? 10),
  portions: r.portions || 1,
  cost: num(r.portionCost),
  foodCostPercent: num(r.foodCostPercent),
  priceApproved: r.priceApproved !== false,
  description: r.description || '',
  ingredients: parseIngredients(r.ingredientsJson).map((ing) => ({
    itemId: ing.itemId,
    name: ing.name || 'Malzeme',
    quantity: num(ing.quantity ?? ing.amount),
    unit: ing.unit || '',
    amount: `${num(ing.quantity ?? ing.amount)} ${ing.unit || ''}`.trim(),
    cost: 0,
  })),
}));

const recipeBody = (p) => ({
  name: p.name,
  category: p.category || 'Ana Yemek',
  salePrice: p.salePrice !== undefined ? num(p.salePrice) : undefined,
  vatRate: p.vatRate,
  portions: num(p.portions) || 1,
  description: p.description || '',
  ingredientsJson: JSON.stringify((p.ingredients || []).map((ing) => (typeof ing === 'string'
    ? { name: ing, quantity: 1, unit: 'porsiyon' }
    : { itemId: ing.itemId, name: ing.name, quantity: num(ing.quantity ?? ing.amount), unit: ing.unit }))),
});

export const apiCreateRecipe = async (p) => result(await request('/recipes', { method: 'POST', body: recipeBody(p) }));
export const apiUpdateRecipe = async (id, p) => result(await request(`/recipes/${id}`, { method: 'PUT', body: recipeBody(p) }));
export const apiDeleteRecipe = async (id) => result(await request(`/recipes/${id}`, { method: 'DELETE' }));
// Menü fiyatı Müdür kararıdır: onay bekleyen reçeteyi menüye alır veya fiyatı gerekçeyle değiştirir
export const apiSetRecipePrice = async (id, salePrice, reason) =>
  result(await request(`/recipes/${id}/price`, { method: 'PUT', body: { salePrice: num(salePrice), reason } }));

// ── Giderler (muhasebe iş akışı) ───────────────────────────────
const mapExpense = (e) => ({
  ...e,
  amount: num(e.amount),
  vatRate: num(e.vatRate),
  vatAmount: num(e.vatAmount),
  paidAmount: num(e.paidAmount),
  remainingAmount: num(e.remainingAmount),
  expenseDate: e.expenseDate || '',
  dueDate: e.dueDate || e.expenseDate || '',
  invoiceNumber: e.invoiceNumber || '',
  counterparty: e.counterparty || '',
  note: e.note || '',
  rejectionReason: e.rejectionReason || '',
  paidByCashier: e.paymentStatus === 'PAID',
  recordedInLedger: e.status === 'FINALIZED',
  // Müşavire gönderim ayrı bir adımdır: sunucunun bilgisi kullanılır (onaylanan her kayıt gönderilmiş sayılmaz)
  sentToAdvisor: e.status === 'FINALIZED' || !!e.sentToAdvisor,
});

export const apiFetchExpenses = () => readList('/expenses', mapExpense);

const expenseBody = (p) => ({
  title: p.title,
  category: p.category,
  subType: p.subType,
  amount: num(p.amount),
  expenseDate: p.expenseDate && /^\d{4}-\d{2}-\d{2}$/.test(p.expenseDate) ? p.expenseDate : undefined,
  dueDate: p.dueDate && /^\d{4}-\d{2}-\d{2}$/.test(p.dueDate) ? p.dueDate : undefined,
  invoiceNumber: p.invoiceNumber || undefined,
  counterparty: p.counterparty || undefined,
  note: p.note || undefined,
  vatRate: p.vatRate !== undefined ? num(p.vatRate) : undefined,
  isOwnedProperty: !!p.isOwnedProperty,
});

export const apiCreateExpense = async (p) => {
  const body = expenseBody(p);
  if (p.paymentStatus === 'PAID' || p.paymentStatus === 'PARTIAL') {
    body.paymentStatus = p.paymentStatus;
    body.paidAmount = p.paidAmount;
    body.paymentMethod = p.paymentMethod || 'CASH';
  }
  return result(await request('/expenses', { method: 'POST', body }));
};

export const apiApproveExpense = async (id) => result(await request(`/expenses/${id}/approve`, { method: 'PUT' }));
/** Mali Müşavir (veya Yönetici) onayı: gönderilen belgeyi resmi deftere işler */
export const apiFinalizeExpense = async (id, note) =>
  result(await request(`/expenses/${id}/finalize`, note ? { method: 'PUT', body: { note } } : { method: 'PUT' }));
/** Muhasebe: onaylanan gideri faturalandırıp (belge no / tedarikçi) Mali Müşavire gönderir */
export const apiSubmitExpense = async (id, { invoiceNumber, counterparty, note } = {}) =>
  result(await request(`/expenses/${id}/submit`, { method: 'PUT', body: { invoiceNumber, counterparty, note } }));
export const apiRejectExpense = async (id, reason) => result(await request(`/expenses/${id}/reject`, { method: 'PUT', body: { reason } }));
export const apiPayExpense = async (id, amount, method = 'CASH', note) =>
  result(await request(`/expenses/${id}/pay`, { method: 'POST', body: { amount: amount ? num(amount) : undefined, method, note } }));
export const apiDeleteExpense = async (id) => result(await request(`/expenses/${id}`, { method: 'DELETE' }));

/**
 * Eski arayüz uyumluluğu: ekranlar durum değişikliğini PUT ile gönderiyordu.
 * Talep, niyetine göre doğru iş akışı ucuna yönlendirilir; sunucu kuralları uygular.
 */
export const apiUpdateExpense = async (id, payload = {}) => {
  const status = payload.status;
  if (status === 'FINALIZED' || payload.recordedInLedger === true) return apiFinalizeExpense(id);
  if (status === 'NEEDS_CORRECTION' || status === 'REJECTED') return apiRejectExpense(id, payload.rejectionReason);
  if (payload.recordedInLedger === false && status === 'SENT_TO_ADVISOR') {
    return { success: false, message: 'Resmi deftere işlenmiş kayıt geri alınamaz; düzeltme için ters kayıt / ret süreci izlenmelidir.' };
  }
  if (payload.paymentStatus === 'PAID' || payload.paymentStatus === 'PARTIAL' || payload.paidByCashier === true) {
    return apiPayExpense(id, payload.paymentAmount, payload.paymentMethod || 'CASH', payload.paymentNote);
  }
  const current = await request(`/expenses/${id}`);
  if (!current.ok) return result(current);
  const existing = current.data;
  if (status === 'PENDING_APPROVAL' && payload.sentToAdvisor && existing.status !== 'REJECTED') {
    return apiApproveExpense(id);
  }
  return result(await request(`/expenses/${id}`, { method: 'PUT', body: expenseBody({ ...existing, ...payload }) }));
};

// ── Bildirimler ────────────────────────────────────────────────
export const apiFetchNotifications = () => readList('/notifications');

export const apiReportSecurityAlert = async (screenName, action = 'MOBIL_NAVIGASYON_DENEMESI') =>
  (await request('/notifications/security-alert', { method: 'POST', body: { screen: screenName, action } })).ok;

/** İş akışı bildirimleri sunucuda üretilir. Yalnızca Yönetici/Müdür duyurusu gönderilebilir. */
export const apiCreateNotification = async (payload = {}) => {
  if (!payload.announcement || !['admin', 'manager'].includes(currentUser?.role)) {
    return { success: true, skipped: true };
  }
  return result(await request('/notifications', {
    method: 'POST',
    body: { title: payload.title, message: payload.message, targetRole: payload.targetRole || 'ALL', severity: payload.severity },
  }));
};

export const apiMarkNotificationRead = async (id) => result(await request(`/notifications/${id}/read`, { method: 'PUT' }));
export const apiMarkAllNotificationsRead = async () => result(await request('/notifications/mark-all-read', { method: 'PUT' }));

// ── Menü fiyat / maliyet analizi ───────────────────────────────
export const apiFetchMenuPricing = async (days = 30) => {
  const res = await request(`/analytics/menu-pricing?days=${days}`);
  return res.ok ? res.data : null;
};

// ── Sohbet ─────────────────────────────────────────────────────
/** Kanal bazlı okunmamış sayıları (web ve mobil aynı durumu görür) */
export const apiFetchChatUnread = async () => {
  const res = await request('/chat/unread');
  return res.ok && res.data && typeof res.data === 'object' ? res.data : null;
};
export const apiMarkChatRead = async (channelId) =>
  (await request(`/chat/channels/${encodeURIComponent(channelId)}/read`, { method: 'PUT' })).ok;
export const apiFetchChatChannels = () => readList('/chat/channels');

export const apiFetchChatMessages = (channelId) =>
  readList(channelId ? `/chat/messages?channelId=${encodeURIComponent(channelId)}` : '/chat/messages');

export const apiSendChatMessage = async (msg = {}) => result(await request('/chat/messages', {
  method: 'POST',
  body: { channelId: msg.channelId, text: msg.text, priority: msg.priority },
}));

// ── Satış ──────────────────────────────────────────────────────
export const apiFetchSales = async () => {
  const res = await request('/sales/today');
  if (!res.ok) {
    reportError(res.message);
    return null;
  }
  return (Array.isArray(res.data) ? res.data : []).map((s) => ({
    ...s,
    name: s.productName,
    recipeName: s.productName,
    totalRevenue: num(s.totalPrice),
    totalCost: num(s.totalCost),
  }));
};

/** Müdür: gerekçeli satış iptali (stok iade edilir, Muhasebe ve Yönetici bilgilendirilir) */
export const apiVoidSale = async (id, reason) =>
  result(await request(`/sales/${id}/void`, { method: 'POST', body: { reason } }));

// ── Muhasebe dönemleri, KDV ve denetim izi (Mali Müşavir / Muhasebe / Yönetici) ──
export const apiFetchPeriods = async () => result(await request('/accounting/periods'));
export const apiClosePeriod = async (period, note) =>
  result(await request(`/accounting/periods/${period}/close`, { method: 'POST', body: { note } }));
export const apiReopenPeriod = async (period, reason) =>
  result(await request(`/accounting/periods/${period}/reopen`, { method: 'POST', body: { reason } }));
export const apiFetchVatReport = async (period) =>
  result(await request(`/reports/vat${period ? `?period=${period}` : ''}`));
export const apiFetchAuditLogs = async ({ page = 0, size = 20, query, entity } = {}) => {
  const q = [`page=${page}`, `size=${size}`, query ? `q=${encodeURIComponent(query)}` : '', entity ? `entityType=${entity}` : '']
    .filter(Boolean).join('&');
  return result(await request(`/audit-logs?${q}`));
};

export const apiFetchSalesSummary = async () => {
  const res = await request('/sales/summary');
  if (!res.ok || !res.data) return null;
  const d = res.data;
  return {
    totalRevenue: num(d.totalRevenue),
    netRevenue: num(d.netRevenue),
    totalCost: num(d.totalCost),
    foodCostPercent: num(d.foodCostPercent),
    targetFoodCost: 30,
    netProfit: num(d.netProfit),
    totalSalesCount: d.totalSalesCount || 0,
    orderCount: d.orderCount || 0,
  };
};

export const apiCreateSaleOrder = async ({ tableNo, paymentMethod, items }) =>
  result(await request('/sales/order', { method: 'POST', body: { tableNo, paymentMethod, items } }));

// ── Masa & adisyon (Kasiyer), mutfak ekranı (Şef), iptal onayı (Müdür) ─────
// Her uç noktada rol izni sunucuda denetlenir; istemci yalnızca sonucu gösterir.
export const apiPosTables = async () => result(await request('/pos/tables'));
export const apiPosMenu = async () => result(await request('/pos/menu'));
export const apiPosSummary = async () => result(await request('/pos/summary'));
export const apiPosOpenCheck = async (tableId, guestCount = 2) =>
  result(await request(`/pos/tables/${tableId}/open`, { method: 'POST', body: { guestCount } }));
export const apiPosCheck = async (checkId) => result(await request(`/pos/checks/${checkId}`));
export const apiPosAddItems = async (checkId, items) =>
  result(await request(`/pos/checks/${checkId}/items`, { method: 'POST', body: { items } }));
export const apiPosItemStatus = async (itemId, status) =>
  result(await request(`/pos/items/${itemId}/status`, { method: 'PUT', body: { status } }));
export const apiPosCancelItem = async (itemId, reason) =>
  result(await request(`/pos/items/${itemId}/cancel`, { method: 'PUT', body: { reason } }));
export const apiPosTransfer = async (checkId, tableId) =>
  result(await request(`/pos/checks/${checkId}/transfer`, { method: 'PUT', body: { tableId } }));
export const apiPosCancelCheck = async (checkId, reason) =>
  result(await request(`/pos/checks/${checkId}/cancel`, { method: 'PUT', body: { reason } }));
export const apiPosPay = async (checkId, paymentMethod, receivedAmount) =>
  result(await request(`/pos/checks/${checkId}/pay`, { method: 'POST', body: { paymentMethod, receivedAmount } }));
/** Parçalı ödeme / hesap bölme: amount boşsa kalanın tamamı; itemIds ile kalem seçerek ödeme */
export const apiPosAddPayment = async (checkId, { paymentMethod, amount, itemIds, receivedAmount, label }) =>
  result(await request(`/pos/checks/${checkId}/payments`, { method: 'POST', body: { paymentMethod, amount, itemIds, receivedAmount, label } }));
export const apiPosVoidPayment = async (paymentId, reason) =>
  result(await request(`/pos/payments/${paymentId}/void`, { method: 'PUT', body: { reason } }));
// ── Yazdırma (mutfak / bar / kasa fiş yazıcıları) ve mali belge ─────────────
export const apiPrintCheck = async (checkId, type = 'BILL') =>
  result(await request(`/print/checks/${checkId}?type=${type}`, { method: 'POST' }));
export const apiPrintJobs = async () => result(await request('/print/jobs'));
export const apiPrinters = async () => result(await request('/print/printers'));
export const apiFiscalStatus = async () => result(await request('/fiscal/status'));
export const apiFiscalForCheck = async (checkId) => result(await request(`/fiscal/checks/${checkId}`));
export const apiFiscalEArsiv = async (checkId, buyer = {}) =>
  result(await request(`/fiscal/checks/${checkId}/e-arsiv`, { method: 'POST', body: buyer }));
export const apiFiscalOkc = async (checkId, receiptNo, zNo) =>
  result(await request(`/fiscal/checks/${checkId}/okc`, { method: 'POST', body: { receiptNo, zNo } }));
export const apiFiscalSummary = async (date) => result(await request(`/fiscal/summary${date ? `?date=${date}` : ''}`));
export const apiPosKitchen = async () => result(await request('/pos/kitchen'));
// Masa düzeni (Kasiyer / Müdür / Yönetici): işletmeye göre masa ekleme, bölüm, kapasite, kullanım durumu
export const apiPosCreateTable = async ({ number, area, capacity }) =>
  result(await request('/pos/tables', { method: 'POST', body: { number, area, capacity } }));
export const apiPosUpdateTable = async (id, patch) =>
  result(await request(`/pos/tables/${id}`, { method: 'PUT', body: patch }));

// ── Gün sonu kasa sayımı (Kasiyer) ve mutabakat (Muhasebe) ─────────────────
export const apiZReport = async (date) => result(await request(`/reports/z-report${date ? `?date=${date}` : ''}`));
export const apiCreateCashClosing = async ({ openingFloat, countedCash, note }) =>
  result(await request('/reports/cash-closings', { method: 'POST', body: { openingFloat, countedCash, note } }));
export const apiFetchCashClosings = async (from, to) => {
  const q = [from ? `from=${from}` : '', to ? `to=${to}` : ''].filter(Boolean).join('&');
  return result(await request(`/reports/cash-closings${q ? `?${q}` : ''}`));
};
/** Kör sayım sonrası fark açıklaması (yalnızca sayımı giren kişi, mutabakattan önce) */
export const apiExplainCashClosing = async (id, explanation) =>
  result(await request(`/reports/cash-closings/${id}/explanation`, { method: 'PUT', body: { explanation } }));
export const apiReviewCashClosing = async (id, decision, note) =>
  result(await request(`/reports/cash-closings/${id}/review`, { method: 'PUT', body: { decision, note } }));
export const apiCashReport = async (granularity = 'day', period) =>
  result(await request(`/reports/cash-report?granularity=${granularity}${period ? `&period=${period}` : ''}`));

/** Dönem (ay) kâr / zarar özeti: net satış, SMM, faaliyet giderleri, faaliyet kârı (sunucuda hesaplanır) */
export const apiFetchPeriodSummary = async (period) => {
  const res = await request(`/reports/summary${period ? `?period=${period}` : ''}`);
  return res.ok ? res.data : null;
};
