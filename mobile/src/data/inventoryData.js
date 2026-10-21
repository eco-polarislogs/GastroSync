// GastroSync Mobil Veri Katmanı (Web ile Birebir Senkronize)

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  CHEF: 'chef',
  WAREHOUSE: 'warehouse',
  ACCOUNTANT: 'accountant',
  FINANCIAL_ADVISOR: 'financial_advisor',
};

export const ROLE_LABELS = {
  [ROLES.ADMIN]: 'Sistem Yöneticisi',
  [ROLES.MANAGER]: 'İşletme Yöneticisi',
  [ROLES.CHEF]: 'Mutfak Şefi',
  [ROLES.WAREHOUSE]: 'Depo Sorumlusu',
  [ROLES.ACCOUNTANT]: 'Muhasebeci (Kasa & Ödemeler)',
  [ROLES.FINANCIAL_ADVISOR]: 'Mali Müşavir (Resmi Defter & Vergi)',
};

export const ROLE_COLORS = {
  [ROLES.ADMIN]: '#6366f1',
  [ROLES.MANAGER]: '#10b981',
  [ROLES.CHEF]: '#f59e0b',
  [ROLES.WAREHOUSE]: '#0ea5e9',
  [ROLES.ACCOUNTANT]: '#8b5cf6',
  [ROLES.FINANCIAL_ADVISOR]: '#ec4899',
};

export const ROLE_MODULES = {
  [ROLES.ADMIN]: 'Tüm Sayfalar, Kullanıcı Yönetimi, Rol Atama, Sistem Logları',
  [ROLES.MANAGER]: 'Dashboard, Finansal Raporlar, Satış Analizleri, Tüm Reçeteler',
  [ROLES.ACCOUNTANT]: 'Muhasebe & Kasa, Gider ve Kira Ödemeleri, Fatura Girişleri',
  [ROLES.FINANCIAL_ADVISOR]: 'Resmi Muhasebe Defteri, Vergi ve SGK Tahakkukları, Mali Raporlama',
  [ROLES.CHEF]: 'Reçete Yönetimi, Üretim Planlama, Menü Tasarımı, Stok (Görüntüleme)',
  [ROLES.WAREHOUSE]: 'Mal Kabul Terminali (Elle / Barkod Girişi), Zayiat Bildirimi, Sayım',
};

export const DEMO_USERS = [
  { id: 1, name: 'Ahmet Yılmaz', username: 'admin', role: ROLES.ADMIN, email: 'admin@lezzetrotasi.com', avatar: 'AY' },
  { id: 2, name: 'Mehmet Demir', username: 'mudur', role: ROLES.MANAGER, email: 'mudur@lezzetrotasi.com', avatar: 'MD' },
  { id: 3, name: 'Fatma Kaya', username: 'sef', role: ROLES.CHEF, email: 'sef@lezzetrotasi.com', avatar: 'FK' },
  { id: 4, name: 'Ali Çelik', username: 'depocu', role: ROLES.WAREHOUSE, email: 'depo@lezzetrotasi.com', avatar: 'AÇ' },
  { id: 5, name: 'Canan Öztürk (Kasa)', username: 'muhasebe', role: ROLES.ACCOUNTANT, email: 'muhasebe@lezzetrotasi.com', avatar: 'CÖ' },
  { id: 6, name: 'SMMM Selim Aydın', username: 'malimusavir', role: ROLES.FINANCIAL_ADVISOR, email: 'malimusavir@lezzetrotasi.com', avatar: 'SA' },
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
  {
    id: 8,
    name: 'Kuzu İncik & İsli Firik Pilavı',
    category: 'Ana Yemek',
    salePrice: 540.00,
    cost: 165.20,
    foodCostPercent: 30.6,
    ingredients: [
      { name: 'Kuzu İncik', amount: '0.38 kg' },
      { name: 'Firik Bulguru', amount: '0.08 kg' },
      { name: 'Köy Tereyağı', amount: '0.025 kg' },
      { name: 'Kök Sebzeler', amount: '0.05 kg' },
    ]
  },
  {
    id: 9,
    name: 'Çıtır Kalamar Tava & Ege Tarator',
    category: 'Deniz Ürünleri',
    salePrice: 390.00,
    cost: 112.50,
    foodCostPercent: 28.8,
    ingredients: [
      { name: 'Kalamar Halka', amount: '0.18 kg' },
      { name: 'Süzme Yoğurt & Ceviz (Tarator)', amount: '0.06 kg' },
      { name: 'Ayçiçek & Zeytinyağı', amount: '0.04 lt' },
    ]
  },
  {
    id: 10,
    name: 'Fırında Güveç Karides & Kaşar',
    category: 'Sıcak Başlangıç',
    salePrice: 340.00,
    cost: 95.40,
    foodCostPercent: 28.1,
    ingredients: [
      { name: 'Ayıklanmış Çimçim Karides', amount: '0.15 kg' },
      { name: 'Köy Tereyağı & Sarımsak', amount: '0.02 kg' },
      { name: 'Rende Eski Kaşar', amount: '0.04 kg' },
      { name: 'Çeri Domates Sosu', amount: '0.05 kg' },
    ]
  },
  {
    id: 11,
    name: 'Yanık Bask San Sebastian Cheesecake',
    category: 'Tatlı',
    salePrice: 240.00,
    cost: 54.20,
    foodCostPercent: 22.6,
    ingredients: [
      { name: 'Taze Krem Peynir', amount: '0.12 kg' },
      { name: 'Mutfak Kreması', amount: '0.08 lt' },
      { name: 'Organik Yumurta', amount: '1 adet' },
      { name: 'Eritilmiş Belçika Çikolatası', amount: '0.03 kg' },
    ]
  },
  {
    id: 12,
    name: 'Taze Sıkım Naneli Çilek Limonatası',
    category: 'İçecek',
    salePrice: 140.00,
    cost: 22.80,
    foodCostPercent: 16.3,
    ingredients: [
      { name: 'Taze Sıkılmış Limon Suyu', amount: '0.09 lt' },
      { name: 'Dağ Çileği Püresi', amount: '0.04 kg' },
      { name: 'Taze Bahçe Nanesi', amount: '0.01 bağ' },
      { name: 'Doğal Şeker Şurubu', amount: '0.02 lt' },
    ]
  },
];

export const INITIAL_EXPENSES = [
  { id: 1, title: 'Merkez Restoran Kirası', category: 'FIXED', subType: 'RENT', amount: 45000, period: '2026-10', expenseDate: '2026-10-01', dueDate: '2026-10-05', invoiceNumber: 'KRA-2026/10', counterparty: 'Ahmet Yılmaz (Mal Sahibi)', paymentStatus: 'PAID', note: 'Ana cadde dükkan kirası - Havale ile ödendi', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 2, title: 'Mutfak & Servis Personel Maaşları', category: 'FIXED', subType: 'LABOR', amount: 85000, period: '2026-10', expenseDate: '2026-10-05', dueDate: '2026-10-05', invoiceNumber: 'BORDRO-2026-10', counterparty: 'Restoran Personeli (6 Kişi)', paymentStatus: 'PAID', note: '6 Personel net maaş banka ödemesi', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 3, title: 'Mali Müşavirlik & Danışmanlık', category: 'FIXED', subType: 'ACCOUNTANT', amount: 8500, period: '2026-10', expenseDate: '2026-10-05', dueDate: '2026-10-10', invoiceNumber: 'SMMM-2026-089', counterparty: 'SMMM Selim Aydın', paymentStatus: 'PAID', note: 'Aylık defter tutma ve vergi beyanname danışmanlığı', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 4, title: 'Sanayi Tipi Elektrik Faturası', category: 'VARIABLE', subType: 'ELECTRICITY', amount: 14200, period: '2026-10', expenseDate: '2026-10-10', dueDate: '2026-10-24', invoiceNumber: 'ELEK-8839210', counterparty: 'Enerjisa Dağıtım A.Ş.', paymentStatus: 'UNPAID', note: 'Son ödeme tarihi 24 Ekim - Kasa nakit akışı bekleniyor, borca bırakıldı', isOwnedProperty: false, paidByCashier: false, recordedInLedger: false, sentToAdvisor: true, status: 'PENDING_APPROVAL', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 5, title: 'Şebeke Su Faturası & Arıtma', category: 'VARIABLE', subType: 'WATER', amount: 3800, period: '2026-10', expenseDate: '2026-10-10', dueDate: '2026-10-18', invoiceNumber: 'ISKI-2026-443', counterparty: 'İSKİ Genel Müdürlüğü', paymentStatus: 'PAID', note: 'Bulaşıkhane ve mutfak tüketimi vezneden ödendi', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 6, title: 'Endüstriyel Mutfak Doğalgaz Tüketimi', category: 'VARIABLE', subType: 'GAS', amount: 9600, period: '2026-10', expenseDate: '2026-10-11', dueDate: '2026-10-28', invoiceNumber: 'IGDAS-9921', counterparty: 'İGDAŞ A.Ş.', paymentStatus: 'UNPAID', note: 'Ocak ve fırın hattı - Gelecek hafta ödenecek (Borç/Vade)', isOwnedProperty: false, paidByCashier: false, recordedInLedger: false, sentToAdvisor: true, status: 'PENDING_APPROVAL', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 7, title: 'Restoran Rezervasyon Telefonları', category: 'VARIABLE', subType: 'PHONE', amount: 850, period: '2026-10', expenseDate: '2026-10-08', dueDate: '2026-10-15', invoiceNumber: 'TEL-5542', counterparty: 'Türk Telekom', paymentStatus: 'PAID', note: 'Müşteri rezervasyon iletişim hattı', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 8, title: 'Fiber İnternet & POS Hattı', category: 'VARIABLE', subType: 'INTERNET', amount: 1250, period: '2026-10', expenseDate: '2026-10-08', dueDate: '2026-10-15', invoiceNumber: 'INT-9901', counterparty: 'Turkcell Superonline', paymentStatus: 'PAID', note: 'POS ve restoran Wi-Fi altyapısı', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 9, title: 'KDV ve Geçici Vergi Beyanı', category: 'VARIABLE', subType: 'TAX', amount: 18500, period: '2026-10', expenseDate: '2026-10-12', dueDate: '2026-10-26', invoiceNumber: 'GIB-2026-9', counterparty: 'Gelir İdaresi (Vergi Dairesi)', paymentStatus: 'UNPAID', note: 'Aylık vergi tahakkukları yapıldı, son ödeme 26 Ekim (Borçta)', isOwnedProperty: false, paidByCashier: false, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'SMMM Selim Aydın' },
  { id: 10, title: 'Personel SGK & Prim Ödemesi', category: 'VARIABLE', subType: 'SGK', amount: 27500, period: '2026-10', expenseDate: '2026-10-12', dueDate: '2026-10-31', invoiceNumber: 'SGK-BİLD-10', counterparty: 'Sosyal Güvenlik Kurumu', paymentStatus: 'UNPAID', note: 'Ekim ayı sigorta prim bildirgesi tahakkuku - Vadesi ay sonu', isOwnedProperty: false, paidByCashier: false, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'SMMM Selim Aydın' },
  { id: 11, title: 'Peçete, Paket & Temizlik Sarf', category: 'VARIABLE', subType: 'CONSUMABLES', amount: 6400, period: '2026-10', expenseDate: '2026-10-13', dueDate: '2026-10-13', invoiceNumber: 'SRF-8821', counterparty: 'Paket & Hijyen Toptancısı', paymentStatus: 'PAID', note: 'Ambalaj ve temizlik malzemesi peşin ödendi', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 12, title: 'Soğuk Zincir Et & Sebze Lojistik Nakliyesi', category: 'VARIABLE', subType: 'LOGISTICS', amount: 4800, period: '2026-10', expenseDate: '2026-10-13', dueDate: '2026-10-20', invoiceNumber: 'LOJ-3341', counterparty: 'Örnek Soğuk Hava Taşımacılık', paymentStatus: 'PAID', note: 'Haftalık et ve sebze lojistiği kasadan ödendi', isOwnedProperty: false, paidByCashier: true, recordedInLedger: false, sentToAdvisor: true, status: 'PENDING_APPROVAL', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 13, title: 'Instagram & Gurme Tanıtım Reklamı', category: 'VARIABLE', subType: 'MARKETING', amount: 5000, period: '2026-10', expenseDate: '2026-10-14', dueDate: '2026-10-14', invoiceNumber: 'REK-4001', counterparty: 'Meta Ads / Dijital Ajans', paymentStatus: 'PAID', note: 'Mali Müşavir Reddetmişti: Fatura e-arşiv PDF belgesi bekleniyor', isOwnedProperty: false, paidByCashier: true, recordedInLedger: false, sentToAdvisor: true, status: 'NEEDS_CORRECTION', rejectionReason: 'Resmi e-Arşiv fatura PDF çıktısı eklenmemiş, stopaj tevkifatı kontrol edilmeli', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 14, title: 'Mutfak Havalandırma & Davlumbaz Bakımı', category: 'VARIABLE', subType: 'RENOVATION', amount: 8500, period: '2026-10', expenseDate: '2026-10-14', dueDate: '2026-10-25', invoiceNumber: 'TDL-102', counterparty: 'Usta Havalandırma Ltd.', paymentStatus: 'PARTIAL', note: 'Davlumbaz motor değişimi: 4.000 TL avans verildi, kalan 4.500 TL iş tesliminde ödenecek', isOwnedProperty: false, paidByCashier: true, recordedInLedger: false, sentToAdvisor: true, status: 'PENDING_APPROVAL', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 15, title: 'Taze Sebze & Meyve Hal Alımı (Haftalık)', category: 'VARIABLE', subType: 'CONSUMABLES', amount: 16400, period: '2026-10', expenseDate: '2026-10-16', dueDate: '2026-10-16', invoiceNumber: 'HAL-2026-88', counterparty: 'Bayrampaşa Sebze Hali - Özkaya Tic.', paymentStatus: 'PAID', note: 'Günlük taze yeşillik, domates, mantar ve avokado alımı kasadan ödendi', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 16, title: 'Belediye Çevre Temizlik & İlan Reklam Vergisi', category: 'FIXED', subType: 'TAX', amount: 6200, period: '2026-10', expenseDate: '2026-10-17', dueDate: '2026-10-27', invoiceNumber: 'BLD-2026-44', counterparty: 'Belediye Gelirler Müdürlüğü', paymentStatus: 'UNPAID', note: '2. Taksit ilan reklam ve çöp vergisi tahakkuku - Son ödeme 27 Ekim (Borçta)', isOwnedProperty: false, paidByCashier: false, recordedInLedger: false, sentToAdvisor: true, status: 'PENDING_APPROVAL', recordedBy: 'SMMM Selim Aydın' },
  { id: 17, title: 'Banka POS Cihazı Komisyon & Ekstre Bedeli', category: 'VARIABLE', subType: 'ACCOUNTANT', amount: 4850, period: '2026-10', expenseDate: '2026-10-17', dueDate: '2026-10-17', invoiceNumber: 'POS-EKSTRE-10', counterparty: 'Garanti BBVA Üye İşyeri', paymentStatus: 'PAID', note: 'Ekim ayı POS cihazı bakım ve komisyon ekstresi kesintisi', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 18, title: 'Restoran Haşere İlaçlama & Biyosidal Hizmeti', category: 'VARIABLE', subType: 'RENOVATION', amount: 2800, period: '2026-10', expenseDate: '2026-10-18', dueDate: '2026-10-25', invoiceNumber: 'ILC-774', counterparty: 'Biyokim Hijyen ve İlaçlama A.Ş.', paymentStatus: 'PAID', note: 'Aylık periyodik mutfak ve depo haşere kontrolü, fatura kesildi', isOwnedProperty: false, paidByCashier: true, recordedInLedger: false, sentToAdvisor: true, status: 'PENDING_APPROVAL', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 19, title: 'Paket Servis Kurye & Motosiklet Yakıt Masrafı', category: 'VARIABLE', subType: 'LOGISTICS', amount: 3950, period: '2026-10', expenseDate: '2026-10-18', dueDate: '2026-10-18', invoiceNumber: 'YKT-991', counterparty: 'Petrol Ofisi - İstasyon 14', paymentStatus: 'PAID', note: 'Kurye motosikletlerinin haftalık yakıt alımı fişleri', isOwnedProperty: false, paidByCashier: true, recordedInLedger: false, sentToAdvisor: true, status: 'NEEDS_CORRECTION', rejectionReason: 'Taşıt tanıma fişleri ile plaka eşleşmesi yapılmalı, fatura işletme unvanına düzenlenmeli', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 20, title: 'Derin Dondurucu Kompresör Gaz Dolumu', category: 'VARIABLE', subType: 'RENOVATION', amount: 7200, period: '2026-10', expenseDate: '2026-10-19', dueDate: '2026-10-29', invoiceNumber: 'SGT-550', counterparty: 'Termo Soğutma Sistemleri', paymentStatus: 'PARTIAL', note: 'Kompresör gaz dolumu yapıldı, 3.500 ₺ peşin verildi, 3.700 ₺ ay sonu teslimde ödenecek', isOwnedProperty: false, paidByCashier: true, recordedInLedger: false, sentToAdvisor: true, status: 'PENDING_APPROVAL', recordedBy: 'Canan Öztürk (Kasa)' },
  { id: 21, title: 'Mutfak & Bar Personeli OSGB Sağlık Raporu', category: 'FIXED', subType: 'LABOR', amount: 5400, period: '2026-10', expenseDate: '2026-10-19', dueDate: '2026-10-20', invoiceNumber: 'OSGB-339', counterparty: 'Vizyon OSGB Ortak Sağlık Birimi', paymentStatus: 'PAID', note: 'Personel portör ve akciğer grafisi muayeneleri tamamlandı', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'FINALIZED', recordedBy: 'Canan Öztürk (Kasa)' },
];

export const INITIAL_SALES_SUMMARY = {
  totalRevenue: 128450,
  totalCost: 34180.20,
  foodCostPercent: 26.6,
  netProfit: 94269.80,
  orderCount: 265,
};

export const INITIAL_SALES_ITEMS = [
  { id: 1, name: 'Odun Ateşinde Izgara Köfte', qty: 38, revenue: 12920, cost: 2591.60, foodCost: 20.1 },
  { id: 2, name: 'Somon & Avokado Poke Bowl', qty: 26, revenue: 10920, cost: 3036.80, foodCost: 27.8 },
  { id: 3, name: 'Dry-Aged Izgara Antrikot', qty: 16, revenue: 10880, cost: 3878.40, foodCost: 35.6 },
  { id: 4, name: 'Kuzu İncik & İsli Firik Pilavı', qty: 18, revenue: 9720, cost: 2973.60, foodCost: 30.6 },
  { id: 5, name: 'Otantik İtalyan Tiramisu', qty: 34, revenue: 7480, cost: 1676.20, foodCost: 22.4 },
  { id: 6, name: 'Çıtır Kalamar Tava & Ege Tarator', qty: 18, revenue: 7020, cost: 2025.00, foodCost: 28.8 },
  { id: 7, name: 'Kremalı Trüflü Penne', qty: 18, revenue: 6480, cost: 875.70, foodCost: 13.5 },
  { id: 8, name: 'Izgara Tavuklu Sezar Salata', qty: 24, revenue: 6240, cost: 1225.20, foodCost: 19.6 },
  { id: 9, name: 'Trüflü Mantarlı Risotto', qty: 15, revenue: 5925, cost: 1092.75, foodCost: 18.4 },
  { id: 10, name: 'Fırında Güveç Karides & Kaşar', qty: 16, revenue: 5440, cost: 1526.40, foodCost: 28.1 },
  { id: 11, name: 'Yanık Bask San Sebastian', qty: 22, revenue: 5280, cost: 1192.40, foodCost: 22.6 },
  { id: 12, name: 'Taze Naneli Çilek Limonatası', qty: 32, revenue: 4480, cost: 729.60, foodCost: 16.3 },
];

export const EXPENSE_TYPES = {
  // Sabit Giderler
  RENT: { label: 'Kira (İşyeri)', category: 'FIXED', icon: '🏢' },
  LABOR: { label: 'İşçilik & Personel Maaşları', category: 'FIXED', icon: '👥' },
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
};
