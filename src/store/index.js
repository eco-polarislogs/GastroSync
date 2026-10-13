import { create } from 'zustand'

// ============================================================
// Kullanıcı Rolleri
// ============================================================
export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CHEF: 'chef',
  WAREHOUSE: 'warehouse',
}

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Sistem Yöneticisi',
  [ROLES.MANAGER]: 'İşletme Yöneticisi',
  [ROLES.CHEF]: 'Mutfak Şefi',
  [ROLES.WAREHOUSE]: 'Depo Sorumlusu',
}

export const ROLE_COLORS = {
  [ROLES.ADMIN]: '#6366f1',
  [ROLES.MANAGER]: '#10b981',
  [ROLES.CHEF]: '#f59e0b',
  [ROLES.WAREHOUSE]: '#0ea5e9',
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

    // 1. Backend REST API üzerinden kimlik doğrulama (/api/users/login)
    try {
      const response = await fetch('http://localhost:8080/api/users/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: rawInput, password: cleanPassword })
      })

      if (response.ok) {
        const backendUser = await response.json()
        const normalizedRole = (backendUser.role || 'MANAGER').toLowerCase()
        const initials = backendUser.name
          ? backendUser.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
          : 'GS'

        const userData = {
          id: backendUser.id,
          username: backendUser.username,
          name: backendUser.name,
          email: backendUser.email || `${backendUser.username}@gastrosync.com`,
          role: normalizedRole,
          avatar: initials
        }

        const token = btoa(
          JSON.stringify({ userId: userData.id, role: userData.role, exp: Date.now() + 86400000 })
        )

        localStorage.setItem('gastrosync_token', token)
        localStorage.setItem('gastrosync_user', JSON.stringify(userData))

        set({ user: userData, token, isAuthenticated: true })
        return { success: true, user: userData }
      }
    } catch (err) {
      console.warn('Backend API isteği başarısız oldu, yerel doğrulamaya geçiliyor:', err.message)
    }

    // 2. Yedek / Yerel Doğrulama (Sadece offline veya backend kapalıysa)
    const normalizedLower = rawInput.toLowerCase()
    const isDemoPasswordMatch = (u, p) => {
      if (u === 'admin' && (p === 'admin123' || p === '123456')) return true
      if (u === 'manager' && (p === 'mudur123' || p === '123456')) return true
      if (u === 'chef' && (p === 'sef123' || p === '123456')) return true
      if (u === 'warehouse' && (p === 'depo123' || p === '123456')) return true
      return false
    }

    const found = DEMO_USERS.find((u) => {
      const match = u.username.toLowerCase() === normalizedLower ||
        u.email.toLowerCase() === normalizedLower ||
        (normalizedLower === 'mudur' && u.username === 'manager') ||
        (normalizedLower === 'sef' && u.username === 'chef') ||
        (normalizedLower === 'depocu' && u.username === 'warehouse')
      return match && (u.password === cleanPassword || isDemoPasswordMatch(u.username, cleanPassword))
    })

    if (!found) {
      return { success: false, message: 'Geçersiz kullanıcı adı/e-posta veya şifre!' }
    }

    // JWT token simülasyonu
    const token = btoa(
      JSON.stringify({ userId: found.id, role: found.role, exp: Date.now() + 86400000 })
    )
    const userData = { ...found }
    delete userData.password

    localStorage.setItem('gastrosync_token', token)
    localStorage.setItem('gastrosync_user', JSON.stringify(userData))

    set({ user: userData, token, isAuthenticated: true })
    return { success: true, user: userData }
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
  ],

  recentActions: [
    { id: 1, itemName: 'Dana Antrikot (Dinlendirilmiş)', barcode: '8691234567891', type: 'receive', quantity: 12, unit: 'kg', timestamp: '14:30', date: '2026-10-13' },
    { id: 2, itemName: 'Salkım Çeri Domates', type: 'waste', quantity: 1.2, unit: 'kg', reason: 'Ezilme/Fire', timestamp: '13:15', date: '2026-10-13' },
    { id: 3, itemName: 'Köy Yumurtası (Serbest Gezen)', type: 'waste', quantity: 4, unit: 'adet', reason: 'Kırık Teslimat', timestamp: '12:45', date: '2026-10-13' },
    { id: 4, itemName: 'Norveç Somon Fileto', barcode: '8691234567892', type: 'receive', quantity: 10, unit: 'kg', timestamp: '11:00', date: '2026-10-13' },
  ],

  addStock: (itemId, quantity) => {
    set((state) => ({
      items: state.items.map((item) =>
        item.id === itemId
          ? { ...item, stock: item.stock + quantity, lastUpdated: new Date().toISOString().split('T')[0] }
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
          ? { ...item, stock: Math.max(0, item.stock - quantity), lastUpdated: new Date().toISOString().split('T')[0] }
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
export const useRecipeStore = create((set) => ({
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
  ],

  addRecipe: (recipe) =>
    set((state) => ({ recipes: [...state.recipes, { ...recipe, id: Date.now() }] })),

  updateRecipe: (id, updates) =>
    set((state) => ({
      recipes: state.recipes.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    })),

  deleteRecipe: (id) =>
    set((state) => ({ recipes: state.recipes.filter((r) => r.id !== id) })),
}))

// ============================================================
// Satış / POS Store
// ============================================================
export const useSalesStore = create((set) => ({
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

  addSale: (sale) =>
    set((state) => ({ todaySales: [...state.todaySales, { ...sale, id: Date.now() }] })),
}))
