import { create } from 'zustand'
import { TOKEN_KEY, USER_KEY, REFRESH_KEY, storeTokens, clearTokens, onTokenRefreshed } from '../api/axiosClient'
import {
  authApi, inventoryApi, recipeApi, salesApi, expenseApi, notificationApi,
} from '../api'
import websocketService from '../services/websocketService'
import { toNumber } from '../utils/format'

/**
 * Uygulama durumu. TEK VERİ KAYNAĞI SUNUCUDUR:
 * - Sahte / örnek veri yoktur; sunucuya ulaşılamazsa liste boş kalır ve hata gösterilir.
 * - İş akışı bildirimleri (onay, ret, kritik stok vb.) sunucuda üretilir; istemci üretmez.
 */

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CHEF: 'chef',
  WAREHOUSE: 'warehouse',
  ACCOUNTANT: 'accountant',
  FINANCIAL_ADVISOR: 'financial_advisor',
  CASHIER: 'cashier',
}

/** Personel ekranında rol seçimi sırası */
export const ROLE_ORDER = [ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.FINANCIAL_ADVISOR, ROLES.CASHIER, ROLES.CHEF, ROLES.WAREHOUSE]

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Yönetici',
  [ROLES.MANAGER]: 'İşletme Müdürü',
  [ROLES.CHEF]: 'Mutfak Şefi',
  [ROLES.WAREHOUSE]: 'Depo Sorumlusu',
  [ROLES.ACCOUNTANT]: 'Muhasebe',
  [ROLES.FINANCIAL_ADVISOR]: 'Mali Müşavir (SMMM)',
  [ROLES.CASHIER]: 'Kasiyer',
}

export const ROLE_COLORS = {
  [ROLES.ADMIN]: '#6366f1',
  [ROLES.MANAGER]: '#10b981',
  [ROLES.CHEF]: '#f59e0b',
  [ROLES.WAREHOUSE]: '#0ea5e9',
  [ROLES.ACCOUNTANT]: '#8b5cf6',
  [ROLES.FINANCIAL_ADVISOR]: '#ec4899',
  [ROLES.CASHIER]: '#14b8a6',
}

/** Tüm bildirimleri (salt okunur) izleyen gözetim rolü */
export const SUPERVISOR_ROLES = [ROLES.ADMIN]
export const FINANCE_ROLES = [ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.FINANCIAL_ADVISOR]

/**
 * Yetki denetimi. İzin listesi sunucudan (/api/auth/me) gelir; istemci kendi yetki tablosu tutmaz.
 * Sunucu her uç noktada aynı kuralı ayrıca uygular; bu kontrol yalnızca düğme / menü görünürlüğü içindir.
 */
export const hasPermission = (user, ...perms) => {
  const list = user?.permissions
  if (!Array.isArray(list)) return false
  return perms.some((p) => list.includes(p))
}

const initials = (name) =>
  name ? name.split(' ').filter(Boolean).map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'GS'

const readStoredUser = () => {
  try { return JSON.parse(localStorage.getItem(USER_KEY) || 'null') } catch (_) { return null }
}

// ============================================================
// Oturum
// ============================================================
export const useAuthStore = create((set, get) => ({
  user: readStoredUser(),
  token: localStorage.getItem(TOKEN_KEY) || null,
  isAuthenticated: !!localStorage.getItem(TOKEN_KEY),
  currentLanguage: localStorage.getItem('gastrosync_lang') || 'tr',
  roleChangedAt: 0,

  setSession: (auth) => {
    const userData = {
      id: auth.userId || auth.id,
      username: auth.username,
      name: auth.name,
      email: auth.email || '',
      role: (auth.role || '').toLowerCase(),
      roleLabel: auth.roleLabel || '',
      permissions: Array.isArray(auth.permissions) ? auth.permissions : [],
      screens: Array.isArray(auth.screens) ? auth.screens : [],
      avatar: initials(auth.name),
      mustChangePassword: !!auth.mustChangePassword,
    }
    storeTokens(auth)
    localStorage.setItem(USER_KEY, JSON.stringify(userData))
    set({ user: userData, token: auth.token, isAuthenticated: true })
    return userData
  },

  login: async (identifier, password) => {
    const id = identifier?.trim()
    if (!id || !password) return { success: false, message: 'Kullanıcı adı / e-posta ve şifre zorunludur.' }
    try {
      const auth = await authApi.login(id, password)
      if (!auth?.token) return { success: false, message: 'Sunucudan oturum anahtarı alınamadı.' }
      const user = get().setSession(auth)
      return { success: true, user }
    } catch (err) {
      return { success: false, message: err.message }
    }
  },

  /**
   * Rol, ad ve hesap durumunu sunucudan tazeler. Yönetici rolü değiştirdiğinde açık ekran yeni role geçer;
   * hesap pasife alındıysa sunucu 401 döner ve oturum kapanır.
   */
  refreshSession: async () => {
    if (!localStorage.getItem(TOKEN_KEY)) return null
    try {
      const me = await authApi.me()
      const prev = get().user
      const next = {
        ...(prev || {}),
        id: me.id,
        username: me.username,
        name: me.name,
        email: me.email || '',
        role: (me.role || '').toLowerCase(),
        roleLabel: me.roleLabel || '',
        permissions: Array.isArray(me.permissions) ? me.permissions : [],
        screens: Array.isArray(me.screens) ? me.screens : [],
        avatar: initials(me.name),
        mustChangePassword: !!me.mustChangePassword,
      }
      const roleChanged = !!prev && prev.role !== next.role
      localStorage.setItem(USER_KEY, JSON.stringify(next))
      set({ user: next, ...(roleChanged ? { roleChangedAt: Date.now() } : {}) })
      return { user: next, roleChanged }
    } catch (_) {
      // Önceki sürümden kalan (ekran listesi olmayan) oturum doğrulanamazsa yeniden giriş istenir
      if (!Array.isArray(get().user?.screens)) get().logout()
      return null
    }
  },

  changePassword: async (currentPassword, newPassword) => {
    try {
      const auth = await authApi.changePassword(currentPassword, newPassword)
      get().setSession(auth)
      websocketService.disconnect()
      return { success: true }
    } catch (err) {
      return { success: false, message: err.message }
    }
  },

  setLanguage: (lang) => {
    localStorage.setItem('gastrosync_lang', lang)
    set({ currentLanguage: lang })
  },

  /** Bu cihazdan çıkış: sunucudaki yenileme token'ı iptal edilir (ağ yoksa yerel oturum yine kapanır) */
  logout: () => {
    const refreshToken = localStorage.getItem(REFRESH_KEY)
    if (refreshToken) authApi.logout(refreshToken).catch(() => {})
    clearTokens()
    websocketService.disconnect()
    useNotificationStore.getState().reset()
    set({ user: null, token: null, isAuthenticated: false })
  },
}))

// Çoklu sekme: bir sekmede çıkış yapılırsa diğerleri de kapanır; yenilenen token store'a yansır
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === TOKEN_KEY && !e.newValue && useAuthStore.getState().isAuthenticated) {
      websocketService.disconnect()
      useNotificationStore.getState().reset()
      useAuthStore.setState({ user: null, token: null, isAuthenticated: false })
    }
  })
  onTokenRefreshed((auth) => useAuthStore.setState({ token: auth.token }))
}

// ============================================================
// Stok
// ============================================================
export const mapInventoryItem = (item) => ({
  id: item.id,
  name: item.name,
  category: item.category,
  stock: toNumber(item.currentStock),
  minStock: toNumber(item.minStock),
  unit: item.unit || 'kg',
  price: toNumber(item.unitCost),
  supplier: item.supplier && item.supplier !== '-' ? item.supplier : '',
  barcode: item.barcode || '',
  lastUpdated: item.lastUpdated || '',
})

const TX_TYPE = { INBOUND: 'receive', WASTE: 'waste', OUTBOUND_SALE: 'sale', SALE_REVERSAL: 'reversal', ADJUSTMENT: 'adjust' }

export const mapTransaction = (tx) => {
  const item = tx.item || {}
  const date = tx.timestamp ? new Date(tx.timestamp) : null
  return {
    id: tx.id,
    rawType: tx.type,
    type: TX_TYPE[tx.type] || 'other',
    itemId: item.id,
    itemName: item.name || '-',
    barcode: item.barcode || '',
    quantity: toNumber(tx.quantity),
    unit: item.unit || '',
    unitCost: toNumber(tx.unitCost),
    totalAmount: toNumber(tx.totalAmount),
    balanceAfter: tx.balanceAfter != null ? toNumber(tx.balanceAfter) : null,
    reason: tx.reason || '',
    recordedBy: tx.recordedBy || '',
    timestamp: date ? date.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : '',
    date: date ? date.toLocaleDateString('tr-TR') : '',
    rawTimestamp: tx.timestamp,
  }
}

export const useInventoryStore = create((set, get) => ({
  items: [],
  recentActions: [],
  loading: false,
  error: null,

  fetchItems: async () => {
    set({ loading: true })
    try {
      const list = await inventoryApi.getAll()
      set({ items: (list || []).map(mapInventoryItem), error: null, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  fetchTransactions: async () => {
    try {
      const list = await inventoryApi.recentTransactions()
      set({ recentActions: (list || []).map(mapTransaction) })
    } catch (err) {
      set({ error: err.message })
    }
  },

  refresh: async () => Promise.all([get().fetchItems(), get().fetchTransactions()]),

  /** Mal kabul. unitCost (alış fiyatı) verilirse ağırlıklı ortalama maliyet güncellenir. */
  receive: async (itemId, quantity, extra = {}) => {
    const tx = await inventoryApi.receive(itemId, { quantity, ...extra })
    await get().refresh()
    return tx
  },
  waste: async (itemId, quantity, reason) => {
    const tx = await inventoryApi.waste(itemId, { quantity, reason })
    await get().refresh()
    return tx
  },
  adjust: async (itemId, countedQuantity, reason) => {
    const tx = await inventoryApi.adjust(itemId, { countedQuantity, reason })
    await get().refresh()
    return tx
  },
  purchaseRequest: (itemId, quantity, urgent, note) => inventoryApi.purchaseRequest(itemId, { quantity, urgent, note }),

  // Eski arayüz uyumluluğu
  addStock: (itemId, quantity) => get().receive(itemId, quantity),
  reportWaste: (itemId, quantity, reason) => get().waste(itemId, quantity, reason),
}))

// ============================================================
// Reçeteler (maliyet sunucuda güncel stok maliyetinden hesaplanır)
// ============================================================
const parseIngredients = (json) => {
  try {
    const raw = typeof json === 'string' ? JSON.parse(json || '[]') : json
    return Array.isArray(raw) ? raw : []
  } catch (_) {
    return []
  }
}

export const mapRecipe = (r, inventoryItems = []) => {
  const ingredients = parseIngredients(r.ingredientsJson).map((ing) => {
    const item = inventoryItems.find((i) => i.id === Number(ing.itemId)) ||
      inventoryItems.find((i) => i.name?.toLowerCase() === String(ing.name || '').toLowerCase())
    const amount = toNumber(ing.quantity ?? ing.amount)
    const unitCost = item ? item.price : 0
    return {
      itemId: item ? item.id : ing.itemId || '',
      name: ing.name || item?.name || '-',
      amount,
      unit: ing.unit || item?.unit || 'kg',
      unitCost,
      cost: Math.round(amount * unitCost * 100) / 100,
      matched: !!item,
    }
  })
  return {
    id: r.id,
    name: r.name,
    category: r.category || 'Ana Yemek',
    portions: r.portions || 1,
    salePrice: toNumber(r.salePrice),
    vatRate: toNumber(r.vatRate ?? 10),
    description: r.description || '',
    ingredients,
    cost: toNumber(r.portionCost),
    foodCostPercent: toNumber(r.foodCostPercent),
    costComplete: r.costComplete !== false,
    priceApproved: r.priceApproved !== false,
  }
}

const serializeRecipe = (recipe) => ({
  name: recipe.name,
  category: recipe.category,
  salePrice: recipe.salePrice,
  vatRate: recipe.vatRate,
  portions: recipe.portions || 1,
  description: recipe.description || '',
  ingredientsJson: JSON.stringify((recipe.ingredients || []).map((i) => ({
    itemId: i.itemId || undefined,
    name: i.name,
    quantity: toNumber(i.amount ?? i.quantity),
    unit: i.unit,
  }))),
})

export const useRecipeStore = create((set, get) => ({
  recipes: [],
  loading: false,
  error: null,

  fetchRecipes: async () => {
    set({ loading: true })
    try {
      const items = useInventoryStore.getState().items
      const list = await recipeApi.getAll()
      set({ recipes: (list || []).map((r) => mapRecipe(r, items)), error: null, loading: false })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  addRecipe: async (recipe) => {
    try {
      await recipeApi.create(serializeRecipe(recipe))
      await get().fetchRecipes()
      return { success: true }
    } catch (err) {
      return { success: false, message: err.message }
    }
  },

  updateRecipe: async (id, updates) => {
    try {
      await recipeApi.update(id, serializeRecipe(updates))
      await get().fetchRecipes()
      return { success: true }
    } catch (err) {
      return { success: false, message: err.message }
    }
  },

  deleteRecipe: async (id) => {
    try {
      await recipeApi.delete(id)
      await get().fetchRecipes()
      return { success: true }
    } catch (err) {
      return { success: false, message: err.message }
    }
  },
}))

// ============================================================
// Satış / POS
// ============================================================
export const mapSale = (s) => ({
  id: s.id,
  orderNo: s.orderNo,
  recipeId: s.recipeId,
  recipeName: s.productName,
  quantity: s.quantity || 1,
  salePrice: toNumber(s.unitPrice),
  portionCost: toNumber(s.unitCost),
  totalRevenue: toNumber(s.totalPrice),
  totalCost: toNumber(s.totalCost),
  vatAmount: toNumber(s.vatAmount),
  vatRate: toNumber(s.vatRate),
  time: s.time || '',
  soldAt: s.soldAt,
  tableNo: s.tableNo || '',
  paymentMethod: s.paymentMethod,
  status: s.status || 'COMPLETED',
  voidReason: s.voidReason,
  voidedBy: s.voidedBy,
  recordedBy: s.recordedBy,
})

const EMPTY_SALES_SUMMARY = {
  totalRevenue: 0, netRevenue: 0, outputVat: 0, totalCost: 0, netProfit: 0,
  foodCostPercent: 0, totalSalesCount: 0, orderCount: 0, byPaymentMethod: {},
}

export const useSalesStore = create((set, get) => ({
  todaySales: [],
  summary: EMPTY_SALES_SUMMARY,
  loading: false,
  error: null,

  fetchSales: async () => {
    set({ loading: true })
    try {
      const [list, summary] = await Promise.all([salesApi.today(), salesApi.summary()])
      set({
        todaySales: (list || []).map(mapSale),
        summary: {
          ...EMPTY_SALES_SUMMARY,
          ...Object.fromEntries(Object.entries(summary || {}).map(([k, v]) => [k, typeof v === 'object' ? v : toNumber(v)])),
          targetFoodCost: 30,
        },
        error: null,
        loading: false,
      })
    } catch (err) {
      set({ error: err.message, loading: false })
    }
  },

  createOrder: async ({ tableNo, paymentMethod, items }) => {
    const created = await salesApi.order({ tableNo, paymentMethod, items })
    await get().fetchSales()
    useInventoryStore.getState().fetchItems()
    return created
  },

  voidSale: async (id, reason) => {
    const res = await salesApi.void(id, reason)
    await get().fetchSales()
    useInventoryStore.getState().fetchItems()
    return res
  },
}))

// ============================================================
// Giderler (özet görünümler için; muhasebe ekranı react-query kullanır)
// ============================================================
export const useExpenseStore = create((set) => ({
  expenses: [],
  summary: { totalFixed: 0, totalVariable: 0, grandTotal: 0, totalExpenseCount: 0 },
  error: null,

  fetchExpenses: async () => {
    try {
      const [list, summary] = await Promise.all([expenseApi.getAll(), expenseApi.summary()])
      set({
        expenses: (list || []).map((e) => ({ ...e, amount: toNumber(e.amount) })),
        summary: {
          totalFixed: toNumber(summary?.totalFixed),
          totalVariable: toNumber(summary?.totalVariable),
          grandTotal: toNumber(summary?.grandTotal),
          totalExpenseCount: summary?.totalExpenseCount || 0,
          unpaidApprovedTotal: toNumber(summary?.unpaidApprovedTotal),
        },
        error: null,
      })
    } catch (err) {
      set({ error: err.message })
    }
  },
}))

// ============================================================
// Bildirimler (kalıcı + canlı, kullanıcı bazlı okundu bilgisi)
// ============================================================
let wsUnsubscribers = []

const mergeNotification = (list, incoming) => {
  if (!incoming || !incoming.id) return list
  const exists = list.some((n) => n.id === incoming.id)
  const next = exists ? list.map((n) => (n.id === incoming.id ? { ...n, ...incoming, isRead: n.isRead } : n)) : [incoming, ...list]
  return next.slice(0, 200)
}

const withCount = (notifications) => ({ notifications, unreadCount: notifications.filter((n) => !n.isRead).length })

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isWsConnected: false,
  error: null,

  reset: () => {
    wsUnsubscribers.forEach((u) => { try { u() } catch (_) { /* yoksay */ } })
    wsUnsubscribers = []
    set({ notifications: [], unreadCount: 0, isWsConnected: false })
  },

  initWebSocket: (role) => {
    wsUnsubscribers.forEach((u) => { try { u() } catch (_) { /* yoksay */ } })
    wsUnsubscribers = []
    const upper = (role || '').toUpperCase()
    const onNew = (n) => set((s) => withCount(mergeNotification(s.notifications, n)))

    wsUnsubscribers.push(websocketService.onStatusChange((connected) => {
      set({ isWsConnected: connected })
      if (connected) get().fetchNotifications()
    }))
    wsUnsubscribers.push(websocketService.subscribe('/topic/notifications', onNew))
    if (upper) wsUnsubscribers.push(websocketService.subscribe(`/topic/notifications/${upper}`, onNew))
    if (upper === 'ADMIN') {
      wsUnsubscribers.push(websocketService.subscribe('/topic/notifications/supervisors', onNew))
    }
    // Aynı kullanıcının diğer cihazlarındaki okundu işlemleri
    wsUnsubscribers.push(websocketService.subscribe('/user/queue/notifications', (evt) => {
      if (evt?.type === 'READ') set((s) => withCount(s.notifications.map((n) => (n.id === evt.id ? { ...n, isRead: true } : n))))
      if (evt?.type === 'READ_ALL') set((s) => withCount(s.notifications.map((n) => ({ ...n, isRead: true }))))
    }))
  },

  fetchNotifications: async () => {
    try {
      const list = await notificationApi.getAll()
      set({ ...withCount(list || []), error: null })
    } catch (err) {
      set({ error: err.message })
    }
  },

  markAsRead: async (id) => {
    set((s) => withCount(s.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n))))
    try { await notificationApi.markRead(id) } catch (_) { get().fetchNotifications() }
  },

  markAllAsRead: async () => {
    set((s) => withCount(s.notifications.map((n) => ({ ...n, isRead: true }))))
    try { await notificationApi.markAllRead() } catch (_) { get().fetchNotifications() }
  },

  /** Yalnızca duyuru yetkisi olanlar (Yönetici / Müdür). İş akışı bildirimleri sunucuda üretilir. */
  sendNotification: async (data) => {
    if (!hasPermission(useAuthStore.getState().user, 'ANNOUNCE')) return null
    return notificationApi.announce({
      title: data.title, message: data.message, targetRole: data.targetRole || 'ALL', severity: data.severity,
    })
  },
}))
