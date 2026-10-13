// GastroSync Mobil Veri Katmanı (Web ile Birebir Senkronize)

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CHEF: 'chef',
  WAREHOUSE: 'warehouse',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Sistem Yöneticisi',
  [ROLES.MANAGER]: 'İşletme Yöneticisi',
  [ROLES.CHEF]: 'Mutfak Şefi',
  [ROLES.WAREHOUSE]: 'Depo Sorumlusu',
};

export const ROLE_COLORS = {
  [ROLES.ADMIN]: '#6366f1',
  [ROLES.MANAGER]: '#10b981',
  [ROLES.CHEF]: '#f59e0b',
  [ROLES.WAREHOUSE]: '#0ea5e9',
};

export const ROLE_MODULES = {
  [ROLES.ADMIN]: 'Tüm Sayfalar, Kullanıcı Yönetimi, Rol Atama, Sistem Logları',
  [ROLES.MANAGER]: 'Dashboard, Finansal Raporlar, Satış Analizleri, Tüm Reçeteler',
  [ROLES.CHEF]: 'Reçete Yönetimi, Üretim Planlama, Menü Tasarımı, Stok (Görüntüleme)',
  [ROLES.WAREHOUSE]: 'Mobil Mal Kabul (Barkod), Zayiat Bildirimi, Sayım Ekranı',
};

export const DEMO_USERS = [
  { id: 1, name: 'Ahmet Yılmaz', username: 'admin', role: ROLES.ADMIN, email: 'admin@lezzetrotasi.com', avatar: 'AY' },
  { id: 2, name: 'Mehmet Demir', username: 'mudur', role: ROLES.MANAGER, email: 'mudur@lezzetrotasi.com', avatar: 'MD' },
  { id: 3, name: 'Fatma Kaya', username: 'sef', role: ROLES.CHEF, email: 'sef@lezzetrotasi.com', avatar: 'FK' },
  { id: 4, name: 'Ali Çelik', username: 'depocu', role: ROLES.WAREHOUSE, email: 'depo@lezzetrotasi.com', avatar: 'AÇ' },
];

export const INITIAL_INVENTORY = [
  { id: 1, barcode: '8691234567890', name: 'Dana Kıyma (Özel Karışım)', cat: 'Et & Şarküteri', unit: 'kg', stock: 45.5, min: 20, price: 340.00 },
  { id: 2, barcode: '8691234567891', name: 'Dana Antrikot (Dinlendirilmiş)', cat: 'Et & Şarküteri', unit: 'kg', stock: 24.0, min: 10, price: 720.00 },
  { id: 3, barcode: '8691234567892', name: 'Norveç Somon Fileto', cat: 'Balık & Deniz Ürünleri', unit: 'kg', stock: 16.5, min: 8, price: 580.00 },
  { id: 4, barcode: '8691234567893', name: 'Organik Tavuk Göğsü', cat: 'Et & Şarküteri', unit: 'kg', stock: 32.0, min: 15, price: 185.00 },
  { id: 5, barcode: '8691234567894', name: 'Salkım Çeri Domates', cat: 'Taze Sebze & Meyve', unit: 'kg', stock: 18.5, min: 10, price: 65.00 },
  { id: 6, barcode: '8691234567895', name: 'Hass Avokado', cat: 'Taze Sebze & Meyve', unit: 'adet', stock: 45, min: 20, price: 38.00 },
  { id: 7, barcode: '8691234567896', name: 'Yedikule Marul & Akdeniz Yeşilliği', cat: 'Taze Sebze & Meyve', unit: 'kg', stock: 12.0, min: 6, price: 42.00 },
  { id: 8, barcode: '8691234567897', name: 'Kestane Mantarı (Cremini)', cat: 'Taze Sebze & Meyve', unit: 'kg', stock: 14.0, min: 5, price: 120.00 },
  { id: 9, barcode: '8691234567898', name: 'Kuru Soğan', cat: 'Taze Sebze & Meyve', unit: 'kg', stock: 30.0, min: 10, price: 18.00 },
  { id: 10, barcode: '8691234567899', name: 'İtalyan Arborio Pirinci', cat: 'Kuru Gıda & Bakliyat', unit: 'kg', stock: 25.0, min: 8, price: 110.00 },
  { id: 11, barcode: '8691234567900', name: 'Beyaz Kinoa', cat: 'Kuru Gıda & Bakliyat', unit: 'kg', stock: 18.0, min: 6, price: 135.00 },
  { id: 12, barcode: '8691234567901', name: 'Penne Rigate (Bronz Kalıp)', cat: 'Kuru Gıda & Bakliyat', unit: 'kg', stock: 35.0, min: 12, price: 48.00 },
  { id: 13, barcode: '8691234567902', name: 'Un (Tip 55 Özel Ekmeklik)', cat: 'Kuru Gıda & Bakliyat', unit: 'kg', stock: 100.0, min: 25, price: 32.00 },
  { id: 14, barcode: '8691234567903', name: 'Erken Hasat Soğuk Sıkım Zeytinyağı', cat: 'Sıvı Yağ & Soslar', unit: 'lt', stock: 18.0, min: 8, price: 320.00 },
  { id: 15, barcode: '8691234567904', name: 'Siyah Trüf Yağı (İtalyan)', cat: 'Sıvı Yağ & Soslar', unit: 'lt', stock: 1.2, min: 0.5, price: 1450.00 },
  { id: 16, barcode: '8691234567905', name: 'Parmigiano Reggiano (24 Ay)', cat: 'Süt & Şarküteri', unit: 'kg', stock: 9.5, min: 4, price: 680.00 },
  { id: 17, barcode: '8691234567906', name: 'İtalyan Mascarpone Peyniri', cat: 'Süt & Şarküteri', unit: 'kg', stock: 8.0, min: 3, price: 290.00 },
  { id: 18, barcode: '8691234567907', name: 'Mutfak Kreması (%35 Yağlı)', cat: 'Süt & Şarküteri', unit: 'lt', stock: 15.0, min: 5, price: 98.00 },
  { id: 19, barcode: '8691234567908', name: 'Köy Yumurtası (Serbest Gezen)', cat: 'Yumurta & Taze', unit: 'adet', stock: 180, min: 60, price: 7.20 },
  { id: 20, barcode: '8691234567909', name: 'Kedi Dili Bisküvi (Savoiardi)', cat: 'Kuru Gıda & Pastacılık', unit: 'paket', stock: 22, min: 10, price: 42.00 },
  { id: 21, barcode: '8691234567910', name: 'Espresso Çekirdek Kahve (Arabica)', cat: 'İçecek & Barista', unit: 'kg', stock: 10.0, min: 4, price: 480.00 },
];

export const INITIAL_RECIPES = [
  {
    id: 1,
    name: 'Odun Ateşinde Izgara Köfte',
    category: 'Ana Yemek',
    salePrice: 340.00,
    cost: 68.20,
    foodCostPercent: 20.1,
    ingredients: [
      { name: 'Dana Kıyma (Özel Karışım)', amount: '0.18 kg' },
      { name: 'Kuru Soğan', amount: '0.03 kg' },
      { name: 'Erken Hasat Zeytinyağı', amount: '0.01 lt' },
    ]
  },
  {
    id: 2,
    name: 'Dry-Aged Izgara Antrikot (300g)',
    category: 'Ana Yemek',
    salePrice: 680.00,
    cost: 242.40,
    foodCostPercent: 35.6,
    ingredients: [
      { name: 'Dana Antrikot', amount: '0.32 kg' },
      { name: 'Zeytinyağı', amount: '0.015 lt' },
      { name: 'Kestane Mantarı', amount: '0.06 kg' },
    ]
  },
  {
    id: 3,
    name: 'Somon & Avokado Poke Bowl',
    category: 'Kase & Hafif Yemek',
    salePrice: 420.00,
    cost: 116.80,
    foodCostPercent: 27.8,
    ingredients: [
      { name: 'Norveç Somon Fileto', amount: '0.14 kg' },
      { name: 'Beyaz Kinoa', amount: '0.08 kg' },
      { name: 'Hass Avokado', amount: '0.5 adet' },
    ]
  },
  {
    id: 4,
    name: 'Trüflü Yabani Mantarlı Risotto',
    category: 'Ana Yemek',
    salePrice: 395.00,
    cost: 72.85,
    foodCostPercent: 18.4,
    ingredients: [
      { name: 'İtalyan Arborio Pirinci', amount: '0.11 kg' },
      { name: 'Kestane Mantarı', amount: '0.09 kg' },
      { name: 'Trüf Yağı', amount: '0.006 lt' },
      { name: 'Parmigiano Reggiano', amount: '0.035 kg' },
    ]
  },
  {
    id: 5,
    name: 'Kremalı Trüflü Penne Rigate',
    category: 'Makarna',
    salePrice: 360.00,
    cost: 48.65,
    foodCostPercent: 13.5,
    ingredients: [
      { name: 'Penne Rigate', amount: '0.13 kg' },
      { name: 'Mutfak Kreması', amount: '0.09 lt' },
      { name: 'Trüf Yağı', amount: '0.005 lt' },
    ]
  },
  {
    id: 6,
    name: 'Izgara Tavuklu Sezar Salata',
    category: 'Salata',
    salePrice: 260.00,
    cost: 51.05,
    foodCostPercent: 19.6,
    ingredients: [
      { name: 'Akdeniz Yeşilliği', amount: '0.12 kg' },
      { name: 'Tavuk Göğsü', amount: '0.13 kg' },
      { name: 'Parmigiano Reggiano', amount: '0.025 kg' },
    ]
  },
  {
    id: 7,
    name: 'Otantik İtalyan Tiramisu',
    category: 'Tatlı',
    salePrice: 220.00,
    cost: 49.30,
    foodCostPercent: 22.4,
    ingredients: [
      { name: 'Mascarpone Peyniri', amount: '0.09 kg' },
      { name: 'Kedi Dili Bisküvi', amount: '0.25 paket' },
      { name: 'Espresso Kahve', amount: '0.02 kg' },
    ]
  },
];

export const INITIAL_SALES_SUMMARY = {
  totalRevenue: 76485,
  totalCost: 18785.85,
  foodCostPercent: 24.5,
  netProfit: 57699.15,
  orderCount: 185,
};

export const INITIAL_SALES_ITEMS = [
  { id: 1, name: 'Odun Ateşinde Izgara Köfte', qty: 38, revenue: 12920, cost: 2591.60, foodCost: 20.1 },
  { id: 2, name: 'Somon & Avokado Poke Bowl', qty: 26, revenue: 10920, cost: 3036.80, foodCost: 27.8 },
  { id: 3, name: 'Dry-Aged Izgara Antrikot', qty: 16, revenue: 10880, cost: 3878.40, foodCost: 35.6 },
  { id: 4, name: 'Otantik İtalyan Tiramisu', qty: 34, revenue: 7480, cost: 1676.20, foodCost: 22.4 },
  { id: 5, name: 'Kremalı Trüflü Penne', qty: 18, revenue: 6480, cost: 875.70, foodCost: 13.5 },
  { id: 6, name: 'Izgara Tavuklu Sezar Salata', qty: 24, revenue: 6240, cost: 1225.20, foodCost: 19.6 },
  { id: 7, name: 'Trüflü Mantarlı Risotto', qty: 15, revenue: 5925, cost: 1092.75, foodCost: 18.4 },
];
