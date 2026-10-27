import { create } from 'zustand'
import axiosClient from '../api/axiosClient'

// ============================================================
// Kullanıcı Rolleri
// ============================================================
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CHEF: 'chef',
  WAREHOUSE: 'warehouse',
  ACCOUNTANT: 'accountant',
  FINANCIAL_ADVISOR: 'financial_advisor',
}

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Sistem Yöneticisi',
  [ROLES.MANAGER]: 'İşletme Yöneticisi',
  [ROLES.CHEF]: 'Mutfak Şefi',
  [ROLES.WAREHOUSE]: 'Depo Sorumlusu',
  [ROLES.ACCOUNTANT]: 'Muhasebeci (Kasa & Ödemeler)',
  [ROLES.FINANCIAL_ADVISOR]: 'Mali Müşavir (Resmi Defter & Vergi)',
}

export const ROLE_COLORS = {
  [ROLES.ADMIN]: '#6366f1',
  [ROLES.MANAGER]: '#10b981',
  [ROLES.CHEF]: '#f59e0b',
  [ROLES.WAREHOUSE]: '#0ea5e9',
  [ROLES.ACCOUNTANT]: '#8b5cf6',
  [ROLES.FINANCIAL_ADVISOR]: '#ec4899',
}

// Demo kullanıcılar
const DEMO_USERS = [
  {
    id: 1,
    username: 'admin',
    password: 'admin123',
    name: 'Ahmet Yılmaz',
    email: 'admin@lezzetrotasi.com',
    role: ROLES.ADMIN,
    avatar: 'AY',
  },
  {
    id: 2,
    username: 'mudur',
    password: 'mudur123',
    name: 'Mehmet Demir',
    email: 'mudur@lezzetrotasi.com',
    role: ROLES.MANAGER,
    avatar: 'MD',
  },
  {
    id: 3,
    username: 'sef',
    password: 'sef123',
    name: 'Fatma Kaya',
    email: 'sef@lezzetrotasi.com',
    role: ROLES.CHEF,
    avatar: 'FK',
  },
  {
    id: 4,
    username: 'depocu',
    password: 'depo123',
    name: 'Ali Çelik',
    email: 'depo.ali@lezzetrotasi.com',
    role: ROLES.WAREHOUSE,
    avatar: 'AÇ',
  },
  {
    id: 5,
    username: 'muhasebe',
    password: 'muhasebe123',
    name: 'Canan Öztürk (Kasa)',
    email: 'muhasebe@lezzetrotasi.com',
    role: ROLES.ACCOUNTANT,
    avatar: 'CÖ',
  },
  {
    id: 6,
    username: 'malimusavir',
    password: 'musavir123',
    name: 'SMMM örnek müsavir ',
    email: 'malimusavir@lezzetrotasi.com',
    role: ROLES.FINANCIAL_ADVISOR,
    avatar: 'SA',
  },
]

// ============================================================
// Auth Store (Zustand)
// ============================================================
export const useAuthStore = create((set, get) => ({
  user: JSON.parse(localStorage.getItem('gastrosync_user') || 'null'),
  token: localStorage.getItem('gastrosync_token') || null,
  isAuthenticated: !!localStorage.getItem('gastrosync_token'),

  login: async (username, password) => {
    const rawInput = username?.trim()
    const cleanPassword = password?.trim()

    if (!rawInput || !cleanPassword) {
      return { success: false, message: 'Kullanıcı adı veya e-posta ve şifre zorunludur!' }
    }

    const ALIAS_MAP = {
      'mudur': 'manager',
      'sef': 'chef',
      'depocu': 'warehouse',
      'malimusavir': 'advisor',
      'advisor': 'advisor',
    }

    const lowerInput = rawInput.toLowerCase()
    const targetUsername = ALIAS_MAP[lowerInput] || rawInput

    try {
      const payload = await axiosClient.post('/auth/login', {
        identifier: targetUsername,
        username: targetUsername,
        password: cleanPassword
      })

      const backendUser = payload.data || payload
      const token = backendUser.token
      if (!token) {
        return { success: false, message: 'Sunucudan yetkilendirme belirteci (JWT) alınamadı.' }
      }

      const normalizedRole = (backendUser.role || 'MANAGER').toLowerCase()
      const initials = backendUser.name
        ? backendUser.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
        : 'GS'

      const userData = {
        id: backendUser.userId || backendUser.id,
        username: backendUser.username,
        name: backendUser.name,
        email: backendUser.email || `${backendUser.username}@gastrosync.com`,
        role: normalizedRole,
        avatar: initials
      }

      localStorage.setItem('gastrosync_token', token)
      localStorage.setItem('gastrosync_user', JSON.stringify(userData))

      set({ user: userData, token, isAuthenticated: true })
      return { success: true, user: userData }
    } catch (err) {
      const errorMsg = err.response?.data?.message || err.message || 'Geçersiz kullanıcı adı veya şifre!'
      return { success: false, message: errorMsg }
    }
  },

  currentLanguage: localStorage.getItem('gastrosync_lang') || 'tr',
  setLanguage: (lang) => {
    localStorage.setItem('gastrosync_lang', lang)
    set({ currentLanguage: lang })
  },

  logout: () => {
    localStorage.removeItem('gastrosync_token')
    localStorage.removeItem('gastrosync_user')
    set({ user: null, token: null, isAuthenticated: false })
  },

  // Multi-tab oturum senkronizasyonu
  syncSession: () => {
    const token = localStorage.getItem('gastrosync_token')
    if (!token) {
      set({ user: null, token: null, isAuthenticated: false })
    }
  },
}))

// Multi-tab logout listener
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === 'gastrosync_token' && !e.newValue) {
      useAuthStore.getState().logout()
    }
  })
}

// ============================================================
// Stok / Envanter Store
// ============================================================
export const useInventoryStore = create((set, get) => ({
  items: [
    { id: 1, barcode: '8691234567890', name: 'Dana Kıyma (Özel Karışım)', category: 'Et & Şarküteri', unit: 'kg', stock: 45.5, minStock: 20, price: 340.00, lastUpdated: '2026-10-13' },
    { id: 2, barcode: '8691234567891', name: 'Dana Antrikot (Dinlendirilmiş)', category: 'Et & Şarküteri', unit: 'kg', stock: 24.0, minStock: 10, price: 720.00, lastUpdated: '2026-10-13' },
    { id: 3, barcode: '8691234567892', name: 'Norveç Somon Fileto', category: 'Balık & Deniz Ürünleri', unit: 'kg', stock: 16.5, minStock: 8, price: 580.00, lastUpdated: '2026-10-13' },
    { id: 4, barcode: '8691234567893', name: 'Organik Tavuk Göğsü', category: 'Et & Şarküteri', unit: 'kg', stock: 32.0, minStock: 15, price: 185.00, lastUpdated: '2026-10-13' },
    { id: 5, barcode: '8691234567894', name: 'Salkım Çeri Domates', category: 'Taze Sebze & Meyve', unit: 'kg', stock: 18.5, minStock: 10, price: 65.00, lastUpdated: '2026-10-13' },
    { id: 6, barcode: '8691234567895', name: 'Hass Avokado', category: 'Taze Sebze & Meyve', unit: 'adet', stock: 45, minStock: 20, price: 38.00, lastUpdated: '2026-10-13' },
    { id: 7, barcode: '8691234567896', name: 'Yedikule Marul & Akdeniz Yeşilliği', category: 'Taze Sebze & Meyve', unit: 'kg', stock: 12.0, minStock: 6, price: 42.00, lastUpdated: '2026-10-13' },
    { id: 8, barcode: '8691234567897', name: 'Kestane Mantarı (Cremini)', category: 'Taze Sebze & Meyve', unit: 'kg', stock: 14.0, minStock: 5, price: 120.00, lastUpdated: '2026-10-13' },
    { id: 9, barcode: '8691234567898', name: 'Kuru Soğan', category: 'Taze Sebze & Meyve', unit: 'kg', stock: 30.0, minStock: 10, price: 18.00, lastUpdated: '2026-10-12' },
    { id: 10, barcode: '8691234567899', name: 'İtalyan Arborio Pirinci', category: 'Kuru Gıda & Bakliyat', unit: 'kg', stock: 25.0, minStock: 8, price: 110.00, lastUpdated: '2026-10-12' },
    { id: 11, barcode: '8691234567900', name: 'Beyaz Kinoa', category: 'Kuru Gıda & Bakliyat', unit: 'kg', stock: 18.0, minStock: 6, price: 135.00, lastUpdated: '2026-10-12' },
    { id: 12, barcode: '8691234567901', name: 'Penne Rigate (Bronz Kalıp)', category: 'Kuru Gıda & Bakliyat', unit: 'kg', stock: 35.0, minStock: 12, price: 48.00, lastUpdated: '2026-10-12' },
    { id: 13, barcode: '8691234567902', name: 'Un (Tip 55 Özel Ekmeklik)', category: 'Kuru Gıda & Bakliyat', unit: 'kg', stock: 100.0, minStock: 25, price: 32.00, lastUpdated: '2026-10-13' },
    { id: 14, barcode: '8691234567903', name: 'Erken Hasat Soğuk Sıkım Zeytinyağı', category: 'Sıvı Yağ & Soslar', unit: 'lt', stock: 18.0, minStock: 8, price: 320.00, lastUpdated: '2026-10-12' },
    { id: 15, barcode: '8691234567904', name: 'Siyah Trüf Yağı (İtalyan)', category: 'Sıvı Yağ & Soslar', unit: 'lt', stock: 1.2, minStock: 0.5, price: 1450.00, lastUpdated: '2026-10-11' },
    { id: 16, barcode: '8691234567905', name: 'Parmigiano Reggiano (24 Ay)', category: 'Süt & Şarküteri', unit: 'kg', stock: 9.5, minStock: 4, price: 680.00, lastUpdated: '2026-10-13' },
    { id: 17, barcode: '8691234567906', name: 'İtalyan Mascarpone Peyniri', category: 'Süt & Şarküteri', unit: 'kg', stock: 8.0, minStock: 3, price: 290.00, lastUpdated: '2026-10-13' },
    { id: 18, barcode: '8691234567907', name: 'Mutfak Kreması (%35 Yağlı)', category: 'Süt & Şarküteri', unit: 'lt', stock: 15.0, minStock: 5, price: 98.00, lastUpdated: '2026-10-13' },
    { id: 19, barcode: '8691234567908', name: 'Köy Yumurtası (Serbest Gezen)', category: 'Yumurta & Taze', unit: 'adet', stock: 180, minStock: 60, price: 7.20, lastUpdated: '2026-10-13' },
    { id: 20, barcode: '8691234567909', name: 'Kedi Dili Bisküvi (Savoiardi)', category: 'Kuru Gıda & Pastacılık', unit: 'paket', stock: 22, minStock: 10, price: 42.00, lastUpdated: '2026-10-11' },
    { id: 21, barcode: '8691234567910', name: 'Espresso Çekirdek Kahve (Arabica)', category: 'İçecek & Barista', unit: 'kg', stock: 10.0, minStock: 4, price: 480.00, lastUpdated: '2026-10-12' },
    { id: 22, barcode: '8691234567911', name: 'Kırmızı Pancar (Taze Tarla)', category: 'Taze Sebze & Meyve', unit: 'kg', stock: 2.0, minStock: 10, price: 35.00, lastUpdated: '2026-10-20' },
  ],

  recentActions: [
    { id: 1, itemName: 'Dana Antrikot (Dinlendirilmiş)', barcode: '8691234567891', type: 'receive', quantity: 12, unit: 'kg', timestamp: '14:30', date: '2026-10-13' },
    { id: 2, itemName: 'Salkım Çeri Domates', type: 'waste', quantity: 1.2, unit: 'kg', reason: 'Ezilme/Fire', timestamp: '13:15', date: '2026-10-13' },
    { id: 3, itemName: 'Köy Yumurtası (Serbest Gezen)', type: 'waste', quantity: 4, unit: 'adet', reason: 'Kırık Teslimat', timestamp: '12:45', date: '2026-10-13' },
    { id: 4, itemName: 'Norveç Somon Fileto', barcode: '8691234567892', type: 'receive', quantity: 10, unit: 'kg', timestamp: '11:00', date: '2026-10-13' },
  ],

  fetchItems: async () => {
    try {
      const json = await axiosClient.get('/inventory')
      const rawList = Array.isArray(json) ? json : (json?.data || [])
      if (Array.isArray(rawList)) {
        const mapped = rawList.map(item => ({
          id: item.id,
          name: item.name,
          category: item.category,
          stock: parseFloat(item.currentStock ?? item.stock ?? 0) || 0,
          minStock: parseFloat(item.minStock ?? item.min ?? 5) || 5,
          unit: item.unit || 'kg',
          price: parseFloat(item.unitCost ?? item.price ?? 0) || 0,
          supplier: item.supplier || '',
          barcode: item.barcode || '',
          lastUpdated: item.lastUpdated || 'Bugün'
        }))
        set({ items: mapped })
      }
    } catch (_) { }
  },

  fetchTransactions: async () => {
    try {
      const json = await axiosClient.get('/inventory/transactions/recent')
      const rawList = json?.data || (Array.isArray(json) ? json : [])
      if (Array.isArray(rawList)) {
        const mappedTx = rawList.map(tx => {
          const itemObj = tx.item || {}
          const dateObj = tx.timestamp ? new Date(tx.timestamp) : new Date()
          return {
            id: tx.id,
            itemName: itemObj.name || 'Bilinmeyen Ürün',
            barcode: itemObj.barcode || '',
            type: tx.type === 'WASTE' ? 'waste' : 'receive',
            quantity: parseFloat(tx.quantity) || 0,
            unit: itemObj.unit || 'adet',
            reason: tx.reason || (tx.type === 'WASTE' ? 'Zayiat' : 'Mal Kabul'),
            timestamp: dateObj.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
            date: tx.timestamp ? tx.timestamp.split('T')[0] : new Date().toISOString().split('T')[0]
          }
        })
        set({ recentActions: mappedTx })
      }
    } catch (_) { }
  },

  addStock: (itemId, quantity) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? { ...item, stock: Math.round((item.stock + quantity) * 100) / 100, lastUpdated: new Date().toISOString().split('T')[0] }
          : item
      ),
      recentActions: [
        {
          id: Date.now(),
          itemName: state.items.find((i) => i.id === itemId)?.name,
          type: 'receive',
          quantity,
          unit: state.items.find((i) => i.id === itemId)?.unit,
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toISOString().split('T')[0],
        },
        ...state.recentActions,
      ],
    }))
  },

  reportWaste: (itemId, quantity, reason) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? { ...item, stock: Math.max(0, Math.round((item.stock - quantity) * 100) / 100), lastUpdated: new Date().toISOString().split('T')[0] }
          : item
      ),
      recentActions: [
        {
          id: Date.now(),
          itemName: state.items.find((i) => i.id === itemId)?.name,
          type: 'waste',
          quantity,
          unit: state.items.find((i) => i.id === itemId)?.unit,
          reason,
          timestamp: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
          date: new Date().toISOString().split('T')[0],
        },
        ...state.recentActions,
      ],
    }))
  },
}))

// ============================================================
// Reçete Store (Gurme & Restoran Standartlarında)
// ============================================================
export const useRecipeStore = create((set, get) => ({
  recipes: [
    {
      id: 1,
      name: 'Odun Ateşinde Izgara Köfte',
      category: 'Ana Yemek',
      portions: 1,
      salePrice: 340.00,
      ingredients: [
        { itemId: 1, name: 'Dana Kıyma (Özel Karışım)', amount: 0.18, unit: 'kg' },
        { itemId: 9, name: 'Kuru Soğan', amount: 0.03, unit: 'kg' },
        { itemId: 14, name: 'Erken Hasat Soğuk Sıkım Zeytinyağı', amount: 0.01, unit: 'lt' },
        { itemId: 5, name: 'Salkım Çeri Domates', amount: 0.05, unit: 'kg' },
      ],
      cost: 68.20,
      foodCostPercent: 20.1,
    },
    {
      id: 2,
      name: 'Dry-Aged Izgara Antrikot (300g)',
      category: 'Ana Yemek',
      portions: 1,
      salePrice: 680.00,
      ingredients: [
        { itemId: 2, name: 'Dana Antrikot (Dinlendirilmiş)', amount: 0.32, unit: 'kg' },
        { itemId: 14, name: 'Erken Hasat Soğuk Sıkım Zeytinyağı', amount: 0.015, unit: 'lt' },
        { itemId: 8, name: 'Kestane Mantarı (Cremini)', amount: 0.06, unit: 'kg' },
      ],
      cost: 242.40,
      foodCostPercent: 35.6,
    },
    {
      id: 3,
      name: 'Somon & Avokado Poke Bowl',
      category: 'Kase & Hafif Yemek',
      portions: 1,
      salePrice: 420.00,
      ingredients: [
        { itemId: 3, name: 'Norveç Somon Fileto', amount: 0.14, unit: 'kg' },
        { itemId: 11, name: 'Beyaz Kinoa', amount: 0.08, unit: 'kg' },
        { itemId: 6, name: 'Hass Avokado', amount: 0.5, unit: 'adet' },
        { itemId: 5, name: 'Salkım Çeri Domates', amount: 0.04, unit: 'kg' },
        { itemId: 14, name: 'Erken Hasat Soğuk Sıkım Zeytinyağı', amount: 0.01, unit: 'lt' },
      ],
      cost: 116.80,
      foodCostPercent: 27.8,
    },
    {
      id: 4,
      name: 'Trüflü Yabani Mantarlı Risotto',
      category: 'Ana Yemek',
      portions: 1,
      salePrice: 395.00,
      ingredients: [
        { itemId: 10, name: 'İtalyan Arborio Pirinci', amount: 0.11, unit: 'kg' },
        { itemId: 8, name: 'Kestane Mantarı (Cremini)', amount: 0.09, unit: 'kg' },
        { itemId: 15, name: 'Siyah Trüf Yağı (İtalyan)', amount: 0.006, unit: 'lt' },
        { itemId: 16, name: 'Parmigiano Reggiano (24 Ay)', amount: 0.035, unit: 'kg' },
        { itemId: 18, name: 'Mutfak Kreması (%35 Yağlı)', amount: 0.04, unit: 'lt' },
      ],
      cost: 72.85,
      foodCostPercent: 18.4,
    },
    {
      id: 5,
      name: 'Kremalı Trüflü Penne Rigate',
      category: 'Makarna',
      portions: 1,
      salePrice: 360.00,
      ingredients: [
        { itemId: 12, name: 'Penne Rigate (Bronz Kalıp)', amount: 0.13, unit: 'kg' },
        { itemId: 18, name: 'Mutfak Kreması (%35 Yağlı)', amount: 0.09, unit: 'lt' },
        { itemId: 15, name: 'Siyah Trüf Yağı (İtalyan)', amount: 0.005, unit: 'lt' },
        { itemId: 16, name: 'Parmigiano Reggiano (24 Ay)', amount: 0.03, unit: 'kg' },
      ],
      cost: 48.65,
      foodCostPercent: 13.5,
    },
    {
      id: 6,
      name: 'Izgara Tavuklu Klasik Sezar Salata',
      category: 'Salata',
      portions: 1,
      salePrice: 260.00,
      ingredients: [
        { itemId: 7, name: 'Yedikule Marul & Akdeniz Yeşilliği', amount: 0.12, unit: 'kg' },
        { itemId: 4, name: 'Organik Tavuk Göğsü', amount: 0.13, unit: 'kg' },
        { itemId: 16, name: 'Parmigiano Reggiano (24 Ay)', amount: 0.025, unit: 'kg' },
        { itemId: 14, name: 'Erken Hasat Soğuk Sıkım Zeytinyağı', amount: 0.015, unit: 'lt' },
      ],
      cost: 51.05,
      foodCostPercent: 19.6,
    },
    {
      id: 7,
      name: 'Otantik İtalyan Tiramisu',
      category: 'Tatlı',
      portions: 1,
      salePrice: 220.00,
      ingredients: [
        { itemId: 17, name: 'İtalyan Mascarpone Peyniri', amount: 0.09, unit: 'kg' },
        { itemId: 20, name: 'Kedi Dili Bisküvi (Savoiardi)', amount: 0.25, unit: 'paket' },
        { itemId: 19, name: 'Köy Yumurtası (Serbest Gezen)', amount: 1, unit: 'adet' },
        { itemId: 21, name: 'Espresso Çekirdek Kahve (Arabica)', amount: 0.02, unit: 'kg' },
      ],
      cost: 49.30,
      foodCostPercent: 22.4,
    },
    {
      id: 8,
      name: 'Taş Fırın Pizza Margherita',
      category: 'Pizza & Fırın',
      portions: 1,
      salePrice: 340.00,
      ingredients: [
        { itemId: 13, name: 'Un (Tip 55 Özel Ekmeklik)', amount: 0.22, unit: 'kg' },
        { itemId: 5, name: 'Salkım Çeri Domates', amount: 0.15, unit: 'kg' },
        { itemId: 16, name: 'Parmigiano Reggiano (24 Ay)', amount: 0.08, unit: 'kg' },
        { itemId: 14, name: 'Erken Hasat Soğuk Sıkım Zeytinyağı', amount: 0.02, unit: 'lt' },
      ],
      cost: 71.15,
      foodCostPercent: 20.9,
    },
    {
      id: 9,
      name: 'Kuşkonmaz Yatağında Fırın Somon',
      category: 'Deniz Ürünleri',
      portions: 1,
      salePrice: 540.00,
      ingredients: [
        { itemId: 3, name: 'Norveç Somon Fileto', amount: 0.22, unit: 'kg' },
        { itemId: 14, name: 'Erken Hasat Soğuk Sıkım Zeytinyağı', amount: 0.025, unit: 'lt' },
        { itemId: 5, name: 'Salkım Çeri Domates', amount: 0.06, unit: 'kg' },
      ],
      cost: 139.50,
      foodCostPercent: 25.8,
    },
    {
      id: 10,
      name: 'Tavuklu Fettuccine Alfredo',
      category: 'Makarna',
      portions: 1,
      salePrice: 380.00,
      ingredients: [
        { itemId: 12, name: 'Penne Rigate (Bronz Kalıp)', amount: 0.14, unit: 'kg' },
        { itemId: 4, name: 'Organik Tavuk Göğsü', amount: 0.16, unit: 'kg' },
        { itemId: 18, name: 'Mutfak Kreması (%35 Yağlı)', amount: 0.08, unit: 'lt' },
        { itemId: 16, name: 'Parmigiano Reggiano (24 Ay)', amount: 0.03, unit: 'kg' },
      ],
      cost: 64.56,
      foodCostPercent: 17.0,
    },
  ],

  fetchRecipes: async () => {
    try {
      const json = await axiosClient.get('/recipes')
      const rawList = Array.isArray(json) ? json : (json?.data || [])
      if (Array.isArray(rawList)) {
        // En güncel hammadde fiyatlarını inventory store'dan al
        const inventoryItems = useInventoryStore.getState().items || []

        const mapped = rawList.map(r => {
          let rawIngredients = []
          try {
            if (r.ingredientsJson) {
              rawIngredients = typeof r.ingredientsJson === 'string' ? JSON.parse(r.ingredientsJson) : r.ingredientsJson
            }
          } catch (_) { }

          let totalCalculatedCost = 0
          const normalizedIngredients = (Array.isArray(rawIngredients) ? rawIngredients : []).map(ing => {
            const rawAmount = parseFloat(ing.amount ?? ing.quantity ?? 0) || 0.1

            // Hammaddeyi isimle veya ID ile eşle
            const matchedItem = inventoryItems.find(
              i => (ing.name && i.name.trim().toLowerCase() === ing.name.trim().toLowerCase()) ||
                (ing.itemId && i.id === parseInt(ing.itemId)) ||
                (ing.id && i.id === parseInt(ing.id))
            )

            const ingName = ing.name || matchedItem?.name || 'Temel Malzeme'
            const ingUnit = ing.unit || matchedItem?.unit || 'kg'
            const unitCost = parseFloat(ing.unitCost) || (matchedItem ? matchedItem.price : 15)
            const itemCost = parseFloat(ing.cost) || (rawAmount * unitCost) || 5
            totalCalculatedCost += itemCost

            return {
              itemId: matchedItem ? matchedItem.id : (ing.itemId || ing.id || ''),
              name: ingName,
              amount: rawAmount,
              unit: ingUnit,
              unitCost: unitCost,
              cost: Math.round(itemCost * 100) / 100
            }
          })

          const salePrice = parseFloat(r.salePrice) || 0
          const finalCost = Math.round(totalCalculatedCost * 100) / 100
          const foodCostPercent = salePrice > 0 ? (finalCost / salePrice) * 100 : 0

          return {
            id: r.id,
            name: r.name,
            category: r.category || 'Ana Yemek',
            portions: r.portions || 1,
            salePrice,
            ingredients: normalizedIngredients.length > 0 ? normalizedIngredients : [{ name: 'Temel Malzeme', amount: 1, unit: 'porsiyon', unitCost: 15, cost: 15 }],
            cost: finalCost > 0 ? finalCost : (parseFloat(r.cost) || 20),
            foodCostPercent: Math.round(foodCostPercent * 10) / 10
          }
        })
        set({ recipes: mapped })
      }
    } catch (_) { }
  },

  addRecipe: async (recipe) => {
    try {
      const data = await axiosClient.post('/recipes', {
        name: recipe.name,
        category: recipe.category,
        salePrice: recipe.salePrice,
        portions: recipe.portions || 1,
        ingredientsJson: JSON.stringify(recipe.ingredients || [])
      })
      if (data && data.success && data.data) {
        set((state) => ({ recipes: [...state.recipes, data.data] }))
      }
    } catch (_) { }
    // En son backend durumunu garantile
    get().fetchRecipes()
  },

  updateRecipe: async (id, updates) => {
    try {
      await axiosClient.put(`/recipes/${id}`, {
        name: updates.name,
        category: updates.category,
        salePrice: updates.salePrice,
        portions: updates.portions || 1,
        description: updates.description || '',
        ingredientsJson: JSON.stringify(updates.ingredients || [])
      })
    } catch (_) { }
    // Güncellenen veriyi anında yeniden çekerek maliyetleri tazele
    get().fetchRecipes()
  },

  deleteRecipe: async (id) => {
    set((state) => ({ recipes: state.recipes.filter((r) => r.id !== id) }))
    try {
      await axiosClient.delete(`/recipes/${id}`)
    } catch (_) { }
    get().fetchRecipes()
  },
}))

// ============================================================
// Satış / POS Store (Backend ile Canlı Senkronize)
// ============================================================
export const useSalesStore = create((set, get) => ({
  todaySales: [
    { id: 1, recipeId: 1, recipeName: 'Odun Ateşinde Izgara Köfte', quantity: 38, totalRevenue: 12920, totalCost: 2591.60, time: '12:00-14:00' },
    { id: 2, recipeId: 3, recipeName: 'Somon & Avokado Poke Bowl', quantity: 26, totalRevenue: 10920, totalCost: 3036.80, time: '12:00-14:00' },
    { id: 3, recipeId: 6, recipeName: 'Izgara Tavuklu Klasik Sezar Salata', quantity: 24, totalRevenue: 6240, totalCost: 1225.20, time: '12:00-14:00' },
    { id: 4, recipeId: 5, recipeName: 'Kremalı Trüflü Penne Rigate', quantity: 18, totalRevenue: 6480, totalCost: 875.70, time: '12:00-14:00' },
    { id: 5, recipeId: 2, recipeName: 'Dry-Aged Izgara Antrikot (300g)', quantity: 12, totalRevenue: 8160, totalCost: 2908.80, time: '12:00-14:00' },
    { id: 6, recipeId: 4, recipeName: 'Trüflü Yabani Mantarlı Risotto', quantity: 15, totalRevenue: 5925, totalCost: 1092.75, time: '19:00-22:00' },
    { id: 7, recipeId: 1, recipeName: 'Odun Ateşinde Izgara Köfte', quantity: 22, totalRevenue: 7480, totalCost: 1500.40, time: '19:00-22:00' },
    { id: 8, recipeId: 2, recipeName: 'Dry-Aged Izgara Antrikot (300g)', quantity: 16, totalRevenue: 10880, totalCost: 3878.40, time: '19:00-22:00' },
    { id: 9, recipeId: 7, recipeName: 'Otantik İtalyan Tiramisu', quantity: 34, totalRevenue: 7480, totalCost: 1676.20, time: '19:00-22:00' },
  ],

  summary: {
    totalRevenue: 76485,
    totalCost: 18785.85,
    foodCostPercent: 24.5,
    targetFoodCost: 26.0,
    wasteAmount: 380.00,
    netProfit: 57699.15,
  },

  fetchSales: async () => {
    try {
      const json = await axiosClient.get('/sales/today')
      const rawSales = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : [])
      if (Array.isArray(rawSales)) {
        const recipes = useRecipeStore.getState().recipes || []
        const mapped = rawSales.map(s => {
          const unitPrice = parseFloat(s.unitPrice) || 0
          const totalPrice = parseFloat(s.totalPrice) || (unitPrice * (s.quantity || 1))
          const matchedRecipe = recipes.find(r => r.name?.trim().toLowerCase() === s.productName?.trim().toLowerCase())
          const portionCost = matchedRecipe ? matchedRecipe.cost : Math.round(unitPrice * 0.285 * 100) / 100
          const totalCost = Math.round(portionCost * (s.quantity || 1) * 100) / 100

          return {
            id: s.id,
            recipeId: matchedRecipe ? matchedRecipe.id : s.id,
            recipeName: s.productName,
            quantity: s.quantity || 1,
            salePrice: unitPrice,
            portionCost,
            totalRevenue: totalPrice,
            totalCost,
            time: s.time || 'Bugün',
            tableNo: s.tableNo || 'Masa 1',
            paymentMethod: s.paymentMethod || 'Kredi Kartı'
          }
        })

        const totalRevenue = mapped.reduce((sum, s) => sum + s.totalRevenue, 0)
        const totalCost = mapped.reduce((sum, s) => sum + s.totalCost, 0)
        const foodCostPercent = totalRevenue > 0 ? Math.round((totalCost / totalRevenue) * 1000) / 10 : 25.0

        set({
          todaySales: mapped,
          summary: {
            totalRevenue,
            totalCost,
            foodCostPercent,
            targetFoodCost: 26.0,
            wasteAmount: 380.00,
            netProfit: totalRevenue - totalCost
          }
        })
      }
    } catch (_) { }
  },

  addSale: async (sale) => {
    const tempId = Date.now()
    set((state) => ({ todaySales: [...state.todaySales, { ...sale, id: tempId }] }))
    try {
      await axiosClient.post('/sales', {
        productName: sale.recipeName,
        quantity: sale.quantity || 1,
        unitPrice: sale.salePrice || (sale.totalRevenue / (sale.quantity || 1)),
        totalPrice: sale.totalRevenue,
        time: sale.time || new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        tableNo: sale.tableNo || 'Masa 1',
        paymentMethod: sale.paymentMethod || 'Kredi Kartı'
      })
    } catch (_) { }
  },
}))

// ============================================================
// Muhasebe & Genel Giderler Store (Sabit & Değişken Giderler)
// ============================================================
export const EXPENSE_TYPES = {
  // Sabit Giderler
  RENT: { label: 'Kira (İşyeri)', category: 'FIXED', icon: '🏢' },
  LABOR: { label: 'İşçilik & Maaşlar', category: 'FIXED', icon: '👥' },
  ACCOUNTANT: { label: 'Mali Müşavir', category: 'FIXED', icon: '📑' },
  // Değişken Giderler
  ELECTRICITY: { label: 'Elektrik', category: 'VARIABLE', icon: '⚡' },
  WATER: { label: 'Su', category: 'VARIABLE', icon: '💧' },
  GAS: { label: 'Doğalgaz', category: 'VARIABLE', icon: '🔥' },
  PHONE: { label: 'Telefon', category: 'VARIABLE', icon: '📞' },
  INTERNET: { label: 'İnternet & Ağ', category: 'VARIABLE', icon: '🌐' },
  TAX: { label: 'Vergi (KDV / Stopaj)', category: 'VARIABLE', icon: '🏛️' },
  SGK: { label: 'Sigorta (SGK Prim)', category: 'VARIABLE', icon: '🛡️' },
  CONSUMABLES: { label: 'Sarf Malzeme', category: 'VARIABLE', icon: '📦' },
  LOGISTICS: { label: 'Lojistik & Nakliye', category: 'VARIABLE', icon: '🚚' },
  MARKETING: { label: 'Reklam & Tanıtım', category: 'VARIABLE', icon: '📣' },
  RENOVATION: { label: 'Tadilat & Bakım', category: 'VARIABLE', icon: '🔨' },
}

export const useExpenseStore = create((set, get) => ({
  expenses: [
    {
      id: 1,
      title: 'Merkez Restoran Kirası',
      category: 'FIXED',
      subType: 'RENT',
      amount: 45000,
      period: '2026-10',
      expenseDate: '2026-10-01',
      dueDate: '2026-10-05',
      invoiceNumber: 'KRA-2026/10',
      counterparty: 'Ahmet Yılmaz (Mal Sahibi)',
      paymentStatus: 'PAID', // Ödendi
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Ana cadde dükkan kirası - Havale ile ödendi',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
    {
      id: 2,
      title: 'Mutfak & Servis Personel Maaşları',
      category: 'FIXED',
      subType: 'LABOR',
      amount: 85000,
      period: '2026-10',
      expenseDate: '2026-10-05',
      dueDate: '2026-10-05',
      invoiceNumber: 'BORDRO-2026-10',
      counterparty: 'Restoran Personeli (6 Kişi)',
      paymentStatus: 'PAID', // Ödendi
      recordedBy: 'Canan Öztürk (Kasa)',
      note: '6 Personel net maaş banka ödemesi',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
    {
      id: 3,
      title: 'Mali Müşavirlik & Danışmanlık',
      category: 'FIXED',
      subType: 'ACCOUNTANT',
      amount: 8500,
      period: '2026-10',
      expenseDate: '2026-10-05',
      dueDate: '2026-10-10',
      invoiceNumber: 'SMMM-2026-089',
      counterparty: 'SMMM Selim Aydın',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Aylık defter tutma ve vergi beyanname danışmanlığı',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
    {
      id: 4,
      title: 'Sanayi Tipi Elektrik Faturası',
      category: 'VARIABLE',
      subType: 'ELECTRICITY',
      amount: 14200,
      period: '2026-10',
      expenseDate: '2026-10-10',
      dueDate: '2026-10-24',
      invoiceNumber: 'ELEK-8839210',
      counterparty: 'Enerjisa Dağıtım A.Ş.',
      paymentStatus: 'UNPAID', // ÖDENMEDİ / BORÇTA
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Son ödeme tarihi 24 Ekim - Kasa nakit akışı bekleniyor, borca bırakıldı',
      isOwnedProperty: false,
      paidByCashier: false,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR'
    },
    {
      id: 5,
      title: 'Şebeke Su Faturası & Arıtma',
      category: 'VARIABLE',
      subType: 'WATER',
      amount: 3800,
      period: '2026-10',
      expenseDate: '2026-10-10',
      dueDate: '2026-10-18',
      invoiceNumber: 'ISKI-2026-443',
      counterparty: 'İSKİ Genel Müdürlüğü',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Bulaşıkhane ve mutfak tüketimi vezneden ödendi',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
    {
      id: 6,
      title: 'Endüstriyel Mutfak Doğalgaz Tüketimi',
      category: 'VARIABLE',
      subType: 'GAS',
      amount: 9600,
      period: '2026-10',
      expenseDate: '2026-10-11',
      dueDate: '2026-10-28',
      invoiceNumber: 'IGDAS-9921',
      counterparty: 'İGDAŞ A.Ş.',
      paymentStatus: 'UNPAID', // BORÇTA
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Kuzine ve fırın hattı faturası - Gelecek hafta ödenecek (Borç/Vade)',
      isOwnedProperty: false,
      paidByCashier: false,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR'
    },
    {
      id: 7,
      title: 'Restoran Rezervasyon Telefonları',
      category: 'VARIABLE',
      subType: 'PHONE',
      amount: 850,
      period: '2026-10',
      expenseDate: '2026-10-08',
      dueDate: '2026-10-15',
      invoiceNumber: 'TEL-5542',
      counterparty: 'Türk Telekom',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Müşteri rezervasyon hattı',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
    {
      id: 8,
      title: 'Fiber İnternet & POS Hattı',
      category: 'VARIABLE',
      subType: 'INTERNET',
      amount: 1250,
      period: '2026-10',
      expenseDate: '2026-10-08',
      dueDate: '2026-10-15',
      invoiceNumber: 'INT-9901',
      counterparty: 'Turkcell Superonline',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'POS ve restoran Wi-Fi altyapısı',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
    {
      id: 9,
      title: 'KDV ve Geçici Vergi Beyanı',
      category: 'VARIABLE',
      subType: 'TAX',
      amount: 18500,
      period: '2026-10',
      expenseDate: '2026-10-12',
      dueDate: '2026-10-26',
      invoiceNumber: 'GİB-TAH-2026-9',
      counterparty: 'Gelir İdaresi Başkanlığı (Vergi Dairesi)',
      paymentStatus: 'UNPAID', // Vergi tahakkuk etti, henüz vadesi var
      recordedBy: 'SMMM Selim Aydın',
      note: 'Aylık vergi tahakkukları yapıldı, son ödeme 26 Ekim (Borçta)',
      isOwnedProperty: false,
      paidByCashier: false,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
    {
      id: 10,
      title: 'Personel SGK & Prim Ödemesi',
      category: 'VARIABLE',
      subType: 'SGK',
      amount: 27500,
      period: '2026-10',
      expenseDate: '2026-10-12',
      dueDate: '2026-10-31',
      invoiceNumber: 'SGK-BİLD-10',
      counterparty: 'Sosyal Güvenlik Kurumu',
      paymentStatus: 'UNPAID', // Ay sonu ödenecek
      recordedBy: 'SMMM Selim Aydın',
      note: 'Ekim ayı sigorta prim bildirgesi tahakkuku - Vadesi ay sonu',
      isOwnedProperty: false,
      paidByCashier: false,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
    {
      id: 11,
      title: 'Peçete, Paket & Temizlik Sarf',
      category: 'VARIABLE',
      subType: 'CONSUMABLES',
      amount: 6400,
      period: '2026-10',
      expenseDate: '2026-10-13',
      dueDate: '2026-10-13',
      invoiceNumber: 'SRF-8821',
      counterparty: 'Paket & Hijyen Toptancısı',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Ambalaj ve temizlik malzemesi peşin ödendi',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
    {
      id: 12,
      title: 'Soğuk Zincir Et & Sebze Lojistik Nakliyesi',
      category: 'VARIABLE',
      subType: 'LOGISTICS',
      amount: 7500,
      period: '2026-10',
      expenseDate: '2026-10-13',
      dueDate: '2026-10-20',
      invoiceNumber: 'LOJ-3341',
      counterparty: 'Örnek Soğuk Hava Taşımacılık',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Haftalık et ve sebze lojistiği kasadan ödendi',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR'
    },
    {
      id: 13,
      title: 'Instagram & Gurme Tanıtım Reklamı',
      category: 'VARIABLE',
      subType: 'MARKETING',
      amount: 5000,
      period: '2026-10',
      expenseDate: '2026-10-14',
      dueDate: '2026-10-14',
      invoiceNumber: 'REK-4001',
      counterparty: 'Meta Ads / Dijital Ajans',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Mali Müşavir Reddetmişti: Fatura e-arşiv PDF belgesi bekleniyor',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'REJECTED',
      rejectionReason: 'Resmi e-Arşiv fatura PDF çıktısı eklenmemiş, stopaj tevkifatı kontrol edilmeli'
    },
    {
      id: 14,
      title: 'Mutfak Havalandırma & Davlumbaz Tadilatı',
      category: 'VARIABLE',
      subType: 'RENOVATION',
      amount: 8500,
      period: '2026-10',
      expenseDate: '2026-10-14',
      dueDate: '2026-10-25',
      invoiceNumber: 'TDL-102',
      counterparty: 'Usta Havalandırma Ltd.',
      paymentStatus: 'PARTIAL', // Kısmi Ödendi: 4.000 TL ödendi, 4.500 TL borç
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Davlumbaz motor değişimi: 4.000 TL avans verildi, kalan 4.500 TL iş tesliminde ödenecek',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR'
    },
    {
      id: 15,
      title: 'Taze Sebze & Meyve Hal Alımı (Haftalık)',
      category: 'VARIABLE',
      subType: 'CONSUMABLES',
      amount: 16400,
      period: '2026-10',
      expenseDate: '2026-10-16',
      dueDate: '2026-10-16',
      invoiceNumber: 'HAL-2026-88',
      counterparty: 'Bayrampaşa Sebze Hali - Özkaya Tic.',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Günlük taze yeşillik, domates, mantar ve avokado alımı kasadan ödendi',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
    {
      id: 16,
      title: 'Belediye Çevre Temizlik & İlan Reklam Vergisi',
      category: 'FIXED',
      subType: 'TAX',
      amount: 6200,
      period: '2026-10',
      expenseDate: '2026-10-17',
      dueDate: '2026-10-27',
      invoiceNumber: 'BLD-2026-44',
      counterparty: 'Belediye Gelirler Müdürlüğü',
      paymentStatus: 'UNPAID',
      recordedBy: 'SMMM Selim Aydın',
      note: '2. Taksit ilan reklam ve çöp vergisi tahakkuku - Son ödeme 27 Ekim (Borçta)',
      isOwnedProperty: false,
      paidByCashier: false,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR'
    },
    {
      id: 17,
      title: 'Banka POS Cihazı Komisyon & Ekstre Bedeli',
      category: 'VARIABLE',
      subType: 'ACCOUNTANT',
      amount: 4850,
      period: '2026-10',
      expenseDate: '2026-10-17',
      dueDate: '2026-10-17',
      invoiceNumber: 'POS-EKSTRE-10',
      counterparty: 'Garanti BBVA Üye İşyeri',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Ekim ayı POS cihazı bakım ve komisyon ekstresi kesintisi',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
    {
      id: 18,
      title: 'Restoran Haşere İlaçlama & Biyosidal Hizmeti',
      category: 'VARIABLE',
      subType: 'RENOVATION',
      amount: 2800,
      period: '2026-10',
      expenseDate: '2026-10-18',
      dueDate: '2026-10-25',
      invoiceNumber: 'ILC-774',
      counterparty: 'Biyokim Hijyen ve İlaçlama A.Ş.',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Aylık periyodik mutfak ve depo haşere kontrolü, fatura kesildi',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR'
    },
    {
      id: 19,
      title: 'Paket Servis Kurye & Motosiklet Yakıt Masrafı',
      category: 'VARIABLE',
      subType: 'LOGISTICS',
      amount: 3950,
      period: '2026-10',
      expenseDate: '2026-10-18',
      dueDate: '2026-10-18',
      invoiceNumber: 'YKT-991',
      counterparty: 'Petrol Ofisi - İstasyon 14',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Kurye motosikletlerinin haftalık yakıt alımı fişleri',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'REJECTED',
      rejectionReason: 'Taşıt tanıma fişleri ile plaka eşleşmesi yapılmalı, fatura işletme unvanına düzenlenmeli'
    },
    {
      id: 20,
      title: 'Derin Dondurucu Kompresör Gaz Dolumu',
      category: 'VARIABLE',
      subType: 'RENOVATION',
      amount: 7200,
      period: '2026-10',
      expenseDate: '2026-10-19',
      dueDate: '2026-10-29',
      invoiceNumber: 'SGT-550',
      counterparty: 'Termo Soğutma Sistemleri',
      paymentStatus: 'PARTIAL',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Kompresör gaz dolumu yapıldı, 3.500 ₺ peşin verildi, 3.700 ₺ ay sonu teslimde ödenecek',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR'
    },
    {
      id: 21,
      title: 'Mutfak & Bar Personeli OSGB Sağlık Raporu',
      category: 'FIXED',
      subType: 'LABOR',
      amount: 5400,
      period: '2026-10',
      expenseDate: '2026-10-19',
      dueDate: '2026-10-20',
      invoiceNumber: 'OSGB-339',
      counterparty: 'Vizyon OSGB Ortak Sağlık Birimi',
      paymentStatus: 'PAID',
      recordedBy: 'Canan Öztürk (Kasa)',
      note: 'Personel portör ve akciğer grafisi muayeneleri tamamlandı',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: true,
      sentToAdvisor: true,
      status: 'APPROVED_IN_LEDGER'
    },
  ],

  summary: {
    totalFixed: 138500,
    totalVariable: 103100,
    grandTotal: 241600,
    totalExpenseCount: 14,
  },

  fetchExpenses: async () => {
    try {
      const json = await axiosClient.get('/expenses')
      const rawExpenses = Array.isArray(json?.data) ? json.data : (Array.isArray(json) ? json : [])
      if (Array.isArray(rawExpenses)) {
        const mapped = rawExpenses.map(e => ({
          id: e.id,
          title: e.title,
          category: e.category,
          subType: e.subType,
          amount: parseFloat(e.amount) || 0,
          period: e.period || '2026-10',
          expenseDate: e.expenseDate || 'Bugün',
          dueDate: e.dueDate || e.expenseDate || 'Vadesiz',
          invoiceNumber: e.invoiceNumber || '',
          counterparty: e.counterparty || '',
          paymentStatus: e.paymentStatus || (e.paidByCashier ? 'PAID' : 'UNPAID'),
          rejectionReason: e.rejectionReason || '',
          recordedBy: e.recordedBy || 'Muhasebe',
          note: e.note || '',
          isOwnedProperty: !!e.isOwnedProperty,
          paidByCashier: e.paidByCashier !== false,
          recordedInLedger: !!e.recordedInLedger,
          sentToAdvisor: e.sentToAdvisor !== false,
          status: (e.status === 'APPROVED_IN_LEDGER' || e.status === 'FINALIZED' || e.recordedInLedger)
            ? 'FINALIZED'
            : (e.status === 'REJECTED' || e.status === 'NEEDS_CORRECTION')
              ? 'NEEDS_CORRECTION'
              : 'PENDING_APPROVAL',
        }))

        const totalFixed = mapped.filter(e => e.category === 'FIXED').reduce((s, e) => s + e.amount, 0)
        const totalVariable = mapped.filter(e => e.category === 'VARIABLE').reduce((s, e) => s + e.amount, 0)

        set({
          expenses: mapped,
          summary: {
            totalFixed,
            totalVariable,
            grandTotal: totalFixed + totalVariable,
            totalExpenseCount: mapped.length
          }
        })
      }
    } catch (_) { }
  },

  addExpense: async (expenseData) => {
    try {
      await axiosClient.post('/expenses', {
        title: expenseData.title,
        category: expenseData.category,
        subType: expenseData.subType,
        amount: expenseData.amount,
        period: expenseData.period || '2026-10',
        expenseDate: expenseData.expenseDate || new Date().toISOString().split('T')[0],
        dueDate: expenseData.dueDate || expenseData.expenseDate || new Date().toISOString().split('T')[0],
        invoiceNumber: expenseData.invoiceNumber || '',
        counterparty: expenseData.counterparty || '',
        paymentStatus: expenseData.paymentStatus || (expenseData.paidByCashier ? 'PAID' : 'UNPAID'),
        rejectionReason: expenseData.rejectionReason || '',
        recordedBy: expenseData.recordedBy || 'Muhasebe',
        note: expenseData.note || '',
        isOwnedProperty: !!expenseData.isOwnedProperty,
        paidByCashier: expenseData.paidByCashier !== false,
        recordedInLedger: !!expenseData.recordedInLedger,
        sentToAdvisor: expenseData.sentToAdvisor !== false,
        status: expenseData.status || (expenseData.recordedInLedger ? 'APPROVED_IN_LEDGER' : 'SENT_TO_ADVISOR'),
      })
      get().fetchExpenses()
      return true
    } catch (_) { }
    // Offline fallback
    const temp = { ...expenseData, id: Date.now() }
    set(state => {
      const next = [temp, ...state.expenses]
      const totalFixed = next.filter(e => e.category === 'FIXED').reduce((s, e) => s + e.amount, 0)
      const totalVariable = next.filter(e => e.category === 'VARIABLE').reduce((s, e) => s + e.amount, 0)
      return {
        expenses: next,
        summary: { totalFixed, totalVariable, grandTotal: totalFixed + totalVariable, totalExpenseCount: next.length }
      }
    })
    return true
  },

  updateExpense: async (id, updates) => {
    // 1. İyimser yerel state güncellemesi (UI anında tepki verir, buton durumu anında kilitlenir/güncellenir)
    set((state) => {
      const next = state.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e))
      const totalFixed = next.filter((e) => e.category === 'FIXED').reduce((s, e) => s + e.amount, 0)
      const totalVariable = next.filter((e) => e.category === 'VARIABLE').reduce((s, e) => s + e.amount, 0)
      return {
        expenses: next,
        summary: { totalFixed, totalVariable, grandTotal: totalFixed + totalVariable, totalExpenseCount: next.length }
      }
    })

    // 2. Backend API senkronizasyonu
    try {
      await axiosClient.put(`/expenses/${id}`, updates)
    } catch (_) { }
    get().fetchExpenses()
  },

  deleteExpense: async (id) => {
    set(state => {
      const next = state.expenses.filter(e => e.id !== id)
      const totalFixed = next.filter(e => e.category === 'FIXED').reduce((s, e) => s + e.amount, 0)
      const totalVariable = next.filter(e => e.category === 'VARIABLE').reduce((s, e) => s + e.amount, 0)
      return {
        expenses: next,
        summary: { totalFixed, totalVariable, grandTotal: totalFixed + totalVariable, totalExpenseCount: next.length }
      }
    })
    try {
      await axiosClient.delete(`/expenses/${id}`)
    } catch (_) { }
    get().fetchExpenses()
  }
}))

// ==========================================
// 8. BİLDİRİM VE ROL İLETİŞİM STORE (useNotificationStore) - KALICI & GERÇEK
// ==========================================
const NOTIFICATIONS_STORAGE_KEY = 'gastrosync_persistent_notifications'

const INITIAL_NOTIFICATIONS = [
  {
    id: 1,
    title: '🚀 Yeni Gider Defter Onayı Bekliyor',
    message: "Canan Kasa tarafından 'Sanayi Tipi Mutfak Elektrik Faturası (14.200 ₺)' ödendi ve Mali Müşavir resmi defter onayına iletildi.",
    targetRole: 'FINANCIAL_ADVISOR',
    senderName: 'Canan Kasa (Kasa / Muhasebe)',
    type: 'EXPENSE_APPROVAL',
    isRead: false,
    createdAt: new Date().toISOString()
  },
  {
    id: 2,
    title: '💵 Günlük Kasa Dağıtımı Yapıldı',
    message: "Kasaya giren 5.000 ₺ tutar; Elektrik Avansı, Sarf Malzeme ve Soğuk Zincir Lojistik giderlerine paylaştırıldı.",
    targetRole: 'FINANCIAL_ADVISOR',
    senderName: 'Canan Kasa (Kasa / Muhasebe)',
    type: 'CASH_ALLOCATED',
    isRead: false,
    createdAt: new Date(Date.now() - 3600000).toISOString()
  },
  {
    id: 3,
    title: '❌ Gider Onayı Reddedildi (Gerekçeli)',
    message: "Selahattin Müşavir tarafından 'Instagram & Yerel Yemek Rehberi Reklamı (5.000 ₺)' faturası stopaj/tevkifat gerekçesiyle reddedildi. Düzeltme bekleniyor.",
    targetRole: 'ACCOUNTANT',
    senderName: 'Selahattin Müşavir (Mali Müşavir)',
    type: 'EXPENSE_REJECTED',
    isRead: false,
    createdAt: new Date(Date.now() - 7200000).toISOString()
  },
  {
    id: 4,
    title: '⏳ Yaklaşan Kira Vadesi Hatırlatması',
    message: "Merkez Restoran Kirası (45.000 ₺) için son ödeme vadesi yaklaşıyor. Kasa bakiyesi yeterli.",
    targetRole: 'ALL',
    senderName: 'Sistem Finans Botu',
    type: 'DEBT_ALERT',
    isRead: false,
    createdAt: new Date(Date.now() - 14400000).toISOString()
  }
]

const loadSavedNotifications = () => {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch (_) { }
  return INITIAL_NOTIFICATIONS
}

const saveNotificationsToStorage = (list) => {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(list))
  } catch (_) { }
}

const initialSaved = loadSavedNotifications()

export const useNotificationStore = create((set, get) => ({
  notifications: initialSaved,
  unreadCount: initialSaved.filter(n => !n.isRead).length,

  fetchNotifications: async (role) => {
    try {
      const url = role ? `/notifications?role=${role.toUpperCase()}` : '/notifications'
      const json = await axiosClient.get(url)
      if (json.success && Array.isArray(json.data)) {
        const sortedList = json.data.sort(
          (a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)
        )
        saveNotificationsToStorage(sortedList)
        set({
          notifications: sortedList,
          unreadCount: sortedList.filter(n => !n.isRead).length
        })
      }
    } catch (_) { }
  },

  sendNotification: async (notifData) => {
    const temp = {
      ...notifData,
      id: Date.now(),
      isRead: false,
      createdAt: new Date().toISOString()
    }
    set(state => {
      const next = [temp, ...state.notifications]
      saveNotificationsToStorage(next)
      return {
        notifications: next,
        unreadCount: next.filter(n => !n.isRead).length
      }
    })

    try {
      await axiosClient.post('/notifications', notifData)
    } catch (_) { }
    get().fetchNotifications(notifData.targetRole)
  },

  markAsRead: async (id) => {
    set(state => {
      const updated = state.notifications.map(n => n.id === id ? { ...n, isRead: true } : n)
      saveNotificationsToStorage(updated)
      return {
        notifications: updated,
        unreadCount: updated.filter(n => !n.isRead).length
      }
    })
    try {
      await axiosClient.put(`/notifications/${id}/read`)
    } catch (_) { }
  },

  markAllAsRead: async (role) => {
    set(state => {
      const updated = state.notifications.map(n => ({ ...n, isRead: true }))
      saveNotificationsToStorage(updated)
      return {
        notifications: updated,
        unreadCount: 0
      }
    })
    try {
      await axiosClient.put(`/notifications/mark-all-read?role=${role || ''}`)
    } catch (_) { }
  }
}))


