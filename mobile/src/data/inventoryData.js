// GastroSync Mobil Veri Katmanı (Web ile Birebir %100 Eşitlenmiş)

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
  {
    "id": 1,
    "username": "admin",
    "password": "admin123",
    "name": "Ahmet Yılmaz",
    "email": "admin@lezzetrotasi.com",
    "role": "admin",
    "avatar": "AY"
  },
  {
    "id": 2,
    "username": "mudur",
    "password": "mudur123",
    "name": "Mehmet Demir",
    "email": "mudur@lezzetrotasi.com",
    "role": "manager",
    "avatar": "MD"
  },
  {
    "id": 3,
    "username": "sef",
    "password": "sef123",
    "name": "Fatma Kaya",
    "email": "sef@lezzetrotasi.com",
    "role": "chef",
    "avatar": "FK"
  },
  {
    "id": 4,
    "username": "depocu",
    "password": "depo123",
    "name": "Ali Çelik",
    "email": "depo.ali@lezzetrotasi.com",
    "role": "warehouse",
    "avatar": "AÇ"
  },
  {
    "id": 5,
    "username": "muhasebe",
    "password": "muhasebe123",
    "name": "Canan Öztürk (Kasa)",
    "email": "muhasebe@lezzetrotasi.com",
    "role": "accountant",
    "avatar": "CÖ"
  },
  {
    "id": 6,
    "username": "malimusavir",
    "password": "musavir123",
    "name": "SMMM Selim Aydın",
    "email": "malimusavir@lezzetrotasi.com",
    "role": "financial_advisor",
    "avatar": "SA"
  }
];

export const INITIAL_INVENTORY = [
  {
    "id": 1,
    "barcode": "8691234567890",
    "name": "Dana Kıyma (Özel Karışım)",
    "cat": "Et & Şarküteri",
    "unit": "kg",
    "stock": 45.5,
    "min": 20,
    "price": 340,
    "supplier": "Et Dünyası"
  },
  {
    "id": 2,
    "barcode": "8691234567891",
    "name": "Dana Antrikot (Dinlendirilmiş)",
    "cat": "Et & Şarküteri",
    "unit": "kg",
    "stock": 24,
    "min": 10,
    "price": 720,
    "supplier": "Et Dünyası"
  },
  {
    "id": 3,
    "barcode": "8691234567892",
    "name": "Norveç Somon Fileto",
    "cat": "Balık & Deniz Ürünleri",
    "unit": "kg",
    "stock": 16.5,
    "min": 8,
    "price": 580,
    "supplier": "Merkez Depo"
  },
  {
    "id": 4,
    "barcode": "8691234567893",
    "name": "Organik Tavuk Göğsü",
    "cat": "Et & Şarküteri",
    "unit": "kg",
    "stock": 32,
    "min": 15,
    "price": 185,
    "supplier": "Et Dünyası"
  },
  {
    "id": 5,
    "barcode": "8691234567894",
    "name": "Salkım Çeri Domates",
    "cat": "Taze Sebze & Meyve",
    "unit": "kg",
    "stock": 18.5,
    "min": 10,
    "price": 65,
    "supplier": "Hal Tedarik"
  },
  {
    "id": 6,
    "barcode": "8691234567895",
    "name": "Hass Avokado",
    "cat": "Taze Sebze & Meyve",
    "unit": "adet",
    "stock": 45,
    "min": 20,
    "price": 38,
    "supplier": "Hal Tedarik"
  },
  {
    "id": 7,
    "barcode": "8691234567896",
    "name": "Yedikule Marul & Akdeniz Yeşilliği",
    "cat": "Taze Sebze & Meyve",
    "unit": "kg",
    "stock": 12,
    "min": 6,
    "price": 42,
    "supplier": "Hal Tedarik"
  },
  {
    "id": 8,
    "barcode": "8691234567897",
    "name": "Kestane Mantarı (Cremini)",
    "cat": "Taze Sebze & Meyve",
    "unit": "kg",
    "stock": 14,
    "min": 5,
    "price": 120,
    "supplier": "Hal Tedarik"
  },
  {
    "id": 9,
    "barcode": "8691234567898",
    "name": "Kuru Soğan",
    "cat": "Taze Sebze & Meyve",
    "unit": "kg",
    "stock": 30,
    "min": 10,
    "price": 18,
    "supplier": "Hal Tedarik"
  },
  {
    "id": 10,
    "barcode": "8691234567899",
    "name": "İtalyan Arborio Pirinci",
    "cat": "Kuru Gıda & Bakliyat",
    "unit": "kg",
    "stock": 25,
    "min": 8,
    "price": 110,
    "supplier": "Merkez Depo"
  },
  {
    "id": 11,
    "barcode": "8691234567900",
    "name": "Beyaz Kinoa",
    "cat": "Kuru Gıda & Bakliyat",
    "unit": "kg",
    "stock": 18,
    "min": 6,
    "price": 135,
    "supplier": "Merkez Depo"
  },
  {
    "id": 12,
    "barcode": "8691234567901",
    "name": "Penne Rigate (Bronz Kalıp)",
    "cat": "Kuru Gıda & Bakliyat",
    "unit": "kg",
    "stock": 35,
    "min": 12,
    "price": 48,
    "supplier": "Merkez Depo"
  },
  {
    "id": 13,
    "barcode": "8691234567902",
    "name": "Un (Tip 55 Özel Ekmeklik)",
    "cat": "Kuru Gıda & Bakliyat",
    "unit": "kg",
    "stock": 100,
    "min": 25,
    "price": 32,
    "supplier": "Merkez Depo"
  },
  {
    "id": 14,
    "barcode": "8691234567903",
    "name": "Erken Hasat Soğuk Sıkım Zeytinyağı",
    "cat": "Sıvı Yağ & Soslar",
    "unit": "lt",
    "stock": 18,
    "min": 8,
    "price": 320,
    "supplier": "Merkez Depo"
  },
  {
    "id": 15,
    "barcode": "8691234567904",
    "name": "Siyah Trüf Yağı (İtalyan)",
    "cat": "Sıvı Yağ & Soslar",
    "unit": "lt",
    "stock": 1.2,
    "min": 0.5,
    "price": 1450,
    "supplier": "Merkez Depo"
  },
  {
    "id": 16,
    "barcode": "8691234567905",
    "name": "Parmigiano Reggiano (24 Ay)",
    "cat": "Süt & Şarküteri",
    "unit": "kg",
    "stock": 9.5,
    "min": 4,
    "price": 680,
    "supplier": "Merkez Depo"
  },
  {
    "id": 17,
    "barcode": "8691234567906",
    "name": "İtalyan Mascarpone Peyniri",
    "cat": "Süt & Şarküteri",
    "unit": "kg",
    "stock": 8,
    "min": 3,
    "price": 290,
    "supplier": "Merkez Depo"
  },
  {
    "id": 18,
    "barcode": "8691234567907",
    "name": "Mutfak Kreması (%35 Yağlı)",
    "cat": "Süt & Şarküteri",
    "unit": "lt",
    "stock": 15,
    "min": 5,
    "price": 98,
    "supplier": "Merkez Depo"
  },
  {
    "id": 19,
    "barcode": "8691234567908",
    "name": "Köy Yumurtası (Serbest Gezen)",
    "cat": "Yumurta & Taze",
    "unit": "adet",
    "stock": 180,
    "min": 60,
    "price": 7.2,
    "supplier": "Merkez Depo"
  },
  {
    "id": 20,
    "barcode": "8691234567909",
    "name": "Kedi Dili Bisküvi (Savoiardi)",
    "cat": "Kuru Gıda & Pastacılık",
    "unit": "paket",
    "stock": 22,
    "min": 10,
    "price": 42,
    "supplier": "Merkez Depo"
  },
  {
    "id": 21,
    "barcode": "8691234567910",
    "name": "Espresso Çekirdek Kahve (Arabica)",
    "cat": "İçecek & Barista",
    "unit": "kg",
    "stock": 10,
    "min": 4,
    "price": 480,
    "supplier": "Merkez Depo"
  },
  {
    "id": 22,
    "barcode": "8691234567911",
    "name": "Kırmızı Pancar (Taze Tarla)",
    "cat": "Taze Sebze & Meyve",
    "unit": "kg",
    "stock": 2,
    "min": 10,
    "price": 35,
    "supplier": "Hal Tedarik"
  }
];

export const INITIAL_RECIPES = [
  {
    "id": 1,
    "name": "Odun Ateşinde Izgara Köfte",
    "category": "Ana Yemek",
    "salePrice": 340,
    "cost": 68.2,
    "foodCostPercent": 20.1,
    "ingredients": [
      {
        "name": "Dana Kıyma (Özel Karışım)",
        "amount": "0.18 kg"
      },
      {
        "name": "Kuru Soğan",
        "amount": "0.03 kg"
      },
      {
        "name": "Erken Hasat Soğuk Sıkım Zeytinyağı",
        "amount": "0.01 lt"
      },
      {
        "name": "Salkım Çeri Domates",
        "amount": "0.05 kg"
      }
    ]
  },
  {
    "id": 2,
    "name": "Dry-Aged Izgara Antrikot (300g)",
    "category": "Ana Yemek",
    "salePrice": 680,
    "cost": 242.4,
    "foodCostPercent": 35.6,
    "ingredients": [
      {
        "name": "Dana Antrikot (Dinlendirilmiş)",
        "amount": "0.32 kg"
      },
      {
        "name": "Erken Hasat Soğuk Sıkım Zeytinyağı",
        "amount": "0.015 lt"
      },
      {
        "name": "Kestane Mantarı (Cremini)",
        "amount": "0.06 kg"
      }
    ]
  },
  {
    "id": 3,
    "name": "Somon & Avokado Poke Bowl",
    "category": "Kase & Hafif Yemek",
    "salePrice": 420,
    "cost": 116.8,
    "foodCostPercent": 27.8,
    "ingredients": [
      {
        "name": "Norveç Somon Fileto",
        "amount": "0.14 kg"
      },
      {
        "name": "Beyaz Kinoa",
        "amount": "0.08 kg"
      },
      {
        "name": "Hass Avokado",
        "amount": "0.5 adet"
      },
      {
        "name": "Salkım Çeri Domates",
        "amount": "0.04 kg"
      },
      {
        "name": "Erken Hasat Soğuk Sıkım Zeytinyağı",
        "amount": "0.01 lt"
      }
    ]
  },
  {
    "id": 4,
    "name": "Trüflü Yabani Mantarlı Risotto",
    "category": "Ana Yemek",
    "salePrice": 395,
    "cost": 72.85,
    "foodCostPercent": 18.4,
    "ingredients": [
      {
        "name": "İtalyan Arborio Pirinci",
        "amount": "0.11 kg"
      },
      {
        "name": "Kestane Mantarı (Cremini)",
        "amount": "0.09 kg"
      },
      {
        "name": "Siyah Trüf Yağı (İtalyan)",
        "amount": "0.006 lt"
      },
      {
        "name": "Parmigiano Reggiano (24 Ay)",
        "amount": "0.035 kg"
      },
      {
        "name": "Mutfak Kreması (%35 Yağlı)",
        "amount": "0.04 lt"
      }
    ]
  },
  {
    "id": 5,
    "name": "Kremalı Trüflü Penne Rigate",
    "category": "Makarna",
    "salePrice": 360,
    "cost": 48.65,
    "foodCostPercent": 13.5,
    "ingredients": [
      {
        "name": "Penne Rigate (Bronz Kalıp)",
        "amount": "0.13 kg"
      },
      {
        "name": "Mutfak Kreması (%35 Yağlı)",
        "amount": "0.09 lt"
      },
      {
        "name": "Siyah Trüf Yağı (İtalyan)",
        "amount": "0.005 lt"
      },
      {
        "name": "Parmigiano Reggiano (24 Ay)",
        "amount": "0.03 kg"
      }
    ]
  },
  {
    "id": 6,
    "name": "Izgara Tavuklu Klasik Sezar Salata",
    "category": "Salata",
    "salePrice": 260,
    "cost": 51.05,
    "foodCostPercent": 19.6,
    "ingredients": [
      {
        "name": "Yedikule Marul & Akdeniz Yeşilliği",
        "amount": "0.12 kg"
      },
      {
        "name": "Organik Tavuk Göğsü",
        "amount": "0.13 kg"
      },
      {
        "name": "Parmigiano Reggiano (24 Ay)",
        "amount": "0.025 kg"
      },
      {
        "name": "Erken Hasat Soğuk Sıkım Zeytinyağı",
        "amount": "0.015 lt"
      }
    ]
  },
  {
    "id": 7,
    "name": "Otantik İtalyan Tiramisu",
    "category": "Tatlı",
    "salePrice": 220,
    "cost": 49.3,
    "foodCostPercent": 22.4,
    "ingredients": [
      {
        "name": "İtalyan Mascarpone Peyniri",
        "amount": "0.09 kg"
      },
      {
        "name": "Kedi Dili Bisküvi (Savoiardi)",
        "amount": "0.25 paket"
      },
      {
        "name": "Köy Yumurtası (Serbest Gezen)",
        "amount": "1 adet"
      },
      {
        "name": "Espresso Çekirdek Kahve (Arabica)",
        "amount": "0.02 kg"
      }
    ]
  },
  {
    "id": 8,
    "name": "Taş Fırın Pizza Margherita",
    "category": "Pizza & Fırın",
    "salePrice": 340,
    "cost": 71.15,
    "foodCostPercent": 20.9,
    "ingredients": [
      {
        "name": "Un (Tip 55 Özel Ekmeklik)",
        "amount": "0.22 kg"
      },
      {
        "name": "Salkım Çeri Domates",
        "amount": "0.15 kg"
      },
      {
        "name": "Parmigiano Reggiano (24 Ay)",
        "amount": "0.08 kg"
      },
      {
        "name": "Erken Hasat Soğuk Sıkım Zeytinyağı",
        "amount": "0.02 lt"
      }
    ]
  },
  {
    "id": 9,
    "name": "Kuşkonmaz Yatağında Fırın Somon",
    "category": "Deniz Ürünleri",
    "salePrice": 540,
    "cost": 139.5,
    "foodCostPercent": 25.8,
    "ingredients": [
      {
        "name": "Norveç Somon Fileto",
        "amount": "0.22 kg"
      },
      {
        "name": "Erken Hasat Soğuk Sıkım Zeytinyağı",
        "amount": "0.025 lt"
      },
      {
        "name": "Salkım Çeri Domates",
        "amount": "0.06 kg"
      }
    ]
  },
  {
    "id": 10,
    "name": "Tavuklu Fettuccine Alfredo",
    "category": "Makarna",
    "salePrice": 380,
    "cost": 64.56,
    "foodCostPercent": 17,
    "ingredients": [
      {
        "name": "Penne Rigate (Bronz Kalıp)",
        "amount": "0.14 kg"
      },
      {
        "name": "Organik Tavuk Göğsü",
        "amount": "0.16 kg"
      },
      {
        "name": "Mutfak Kreması (%35 Yağlı)",
        "amount": "0.08 lt"
      },
      {
        "name": "Parmigiano Reggiano (24 Ay)",
        "amount": "0.03 kg"
      }
    ]
  }
];

export const INITIAL_SALES_SUMMARY = {
  totalRevenue: 4620,
  totalCost: 1316.7,
  foodCostPercent: 28.5,
  targetFoodCost: 26.0,
  wasteAmount: 380.0,
  netProfit: 3303.3,
};

export const INITIAL_SALES_ITEMS = [
  { id: 1, name: 'Odun Ateşinde Izgara Köfte', quantity: 38, revenue: 12920, cost: 2591.6, time: '12:00-14:00' },
  { id: 2, name: 'Somon & Avokado Poke Bowl', quantity: 26, revenue: 10920, cost: 3036.8, time: '12:00-14:00' },
  { id: 3, name: 'Izgara Tavuklu Klasik Sezar Salata', quantity: 24, revenue: 6240, cost: 1225.2, time: '12:00-14:00' },
  { id: 4, name: 'Kremalı Trüflü Penne Rigate', quantity: 18, revenue: 6480, cost: 875.7, time: '12:00-14:00' },
  { id: 5, name: 'Dry-Aged Izgara Antrikot (300g)', quantity: 12, revenue: 8160, cost: 2908.8, time: '12:00-14:00' },
  { id: 6, name: 'Trüflü Yabani Mantarlı Risotto', quantity: 15, revenue: 5925, cost: 1092.75, time: '19:00-22:00' },
  { id: 7, name: 'Odun Ateşinde Izgara Köfte', quantity: 22, revenue: 7480, cost: 1500.4, time: '19:00-22:00' },
  { id: 8, name: 'Dry-Aged Izgara Antrikot (300g)', quantity: 16, revenue: 10880, cost: 3878.4, time: '19:00-22:00' },
  { id: 9, name: 'Otantik İtalyan Tiramisu', quantity: 34, revenue: 7480, cost: 1676.2, time: '19:00-22:00' },
];

export const INITIAL_EXPENSES = [
  {
    "id": 1,
    "title": "Merkez Restoran Kirası",
    "category": "FIXED",
    "subType": "RENT",
    "amount": 45000,
    "period": "2026-10",
    "expenseDate": "2026-10-01",
    "dueDate": "2026-10-05",
    "invoiceNumber": "KRA-2026/10",
    "counterparty": "Ahmet Yılmaz (Mal Sahibi)",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Ana cadde dükkan kirası - Havale ile ödendi",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  },
  {
    "id": 2,
    "title": "Mutfak & Servis Personel Maaşları",
    "category": "FIXED",
    "subType": "LABOR",
    "amount": 85000,
    "period": "2026-10",
    "expenseDate": "2026-10-05",
    "dueDate": "2026-10-05",
    "invoiceNumber": "BORDRO-2026-10",
    "counterparty": "Restoran Personeli (6 Kişi)",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "6 Personel net maaş banka ödemesi",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  },
  {
    "id": 3,
    "title": "Mali Müşavirlik & Danışmanlık",
    "category": "FIXED",
    "subType": "ACCOUNTANT",
    "amount": 8500,
    "period": "2026-10",
    "expenseDate": "2026-10-05",
    "dueDate": "2026-10-10",
    "invoiceNumber": "SMMM-2026-089",
    "counterparty": "SMMM Selim Aydın",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Aylık defter tutma ve vergi beyanname danışmanlığı",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  },
  {
    "id": 4,
    "title": "Sanayi Tipi Elektrik Faturası",
    "category": "VARIABLE",
    "subType": "ELECTRICITY",
    "amount": 14200,
    "period": "2026-10",
    "expenseDate": "2026-10-10",
    "dueDate": "2026-10-24",
    "invoiceNumber": "ELEK-8839210",
    "counterparty": "Enerjisa Dağıtım A.Ş.",
    "paymentStatus": "UNPAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Son ödeme tarihi 24 Ekim - Kasa nakit akışı bekleniyor, borca bırakıldı",
    "isOwnedProperty": false,
    "paidByCashier": false,
    "recordedInLedger": false,
    "sentToAdvisor": true,
    "status": "SENT_TO_ADVISOR"
  },
  {
    "id": 5,
    "title": "Şebeke Su Faturası & Arıtma",
    "category": "VARIABLE",
    "subType": "WATER",
    "amount": 3800,
    "period": "2026-10",
    "expenseDate": "2026-10-10",
    "dueDate": "2026-10-18",
    "invoiceNumber": "ISKI-2026-443",
    "counterparty": "İSKİ Genel Müdürlüğü",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Bulaşıkhane ve mutfak tüketimi vezneden ödendi",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  },
  {
    "id": 6,
    "title": "Endüstriyel Mutfak Doğalgaz Tüketimi",
    "category": "VARIABLE",
    "subType": "GAS",
    "amount": 9600,
    "period": "2026-10",
    "expenseDate": "2026-10-11",
    "dueDate": "2026-10-28",
    "invoiceNumber": "IGDAS-9921",
    "counterparty": "İGDAŞ A.Ş.",
    "paymentStatus": "UNPAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Kuzine ve fırın hattı faturası - Gelecek hafta ödenecek (Borç/Vade)",
    "isOwnedProperty": false,
    "paidByCashier": false,
    "recordedInLedger": false,
    "sentToAdvisor": true,
    "status": "SENT_TO_ADVISOR"
  },
  {
    "id": 7,
    "title": "Restoran Rezervasyon Telefonları",
    "category": "VARIABLE",
    "subType": "PHONE",
    "amount": 850,
    "period": "2026-10",
    "expenseDate": "2026-10-08",
    "dueDate": "2026-10-15",
    "invoiceNumber": "TEL-5542",
    "counterparty": "Türk Telekom",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Müşteri rezervasyon hattı",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  },
  {
    "id": 8,
    "title": "Fiber İnternet & POS Hattı",
    "category": "VARIABLE",
    "subType": "INTERNET",
    "amount": 1250,
    "period": "2026-10",
    "expenseDate": "2026-10-08",
    "dueDate": "2026-10-15",
    "invoiceNumber": "INT-9901",
    "counterparty": "Turkcell Superonline",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "POS ve restoran Wi-Fi altyapısı",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  },
  {
    "id": 9,
    "title": "KDV ve Geçici Vergi Beyanı",
    "category": "VARIABLE",
    "subType": "TAX",
    "amount": 18500,
    "period": "2026-10",
    "expenseDate": "2026-10-12",
    "dueDate": "2026-10-26",
    "invoiceNumber": "GİB-TAH-2026-9",
    "counterparty": "Gelir İdaresi Başkanlığı (Vergi Dairesi)",
    "paymentStatus": "UNPAID",
    "recordedBy": "SMMM Selim Aydın",
    "note": "Aylık vergi tahakkukları yapıldı, son ödeme 26 Ekim (Borçta)",
    "isOwnedProperty": false,
    "paidByCashier": false,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  },
  {
    "id": 10,
    "title": "Personel SGK & Prim Ödemesi",
    "category": "VARIABLE",
    "subType": "SGK",
    "amount": 27500,
    "period": "2026-10",
    "expenseDate": "2026-10-12",
    "dueDate": "2026-10-31",
    "invoiceNumber": "SGK-BİLD-10",
    "counterparty": "Sosyal Güvenlik Kurumu",
    "paymentStatus": "UNPAID",
    "recordedBy": "SMMM Selim Aydın",
    "note": "Ekim ayı sigorta prim bildirgesi tahakkuku - Vadesi ay sonu",
    "isOwnedProperty": false,
    "paidByCashier": false,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  },
  {
    "id": 11,
    "title": "Peçete, Paket & Temizlik Sarf",
    "category": "VARIABLE",
    "subType": "CONSUMABLES",
    "amount": 6400,
    "period": "2026-10",
    "expenseDate": "2026-10-13",
    "dueDate": "2026-10-13",
    "invoiceNumber": "SRF-8821",
    "counterparty": "Paket & Hijyen Toptancısı",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Ambalaj ve temizlik malzemesi peşin ödendi",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  },
  {
    "id": 12,
    "title": "Soğuk Zincir Et & Sebze Lojistik Nakliyesi",
    "category": "VARIABLE",
    "subType": "LOGISTICS",
    "amount": 7500,
    "period": "2026-10",
    "expenseDate": "2026-10-13",
    "dueDate": "2026-10-20",
    "invoiceNumber": "LOJ-3341",
    "counterparty": "Örnek Soğuk Hava Taşımacılık",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Haftalık et ve sebze lojistiği kasadan ödendi",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": false,
    "sentToAdvisor": true,
    "status": "SENT_TO_ADVISOR"
  },
  {
    "id": 13,
    "title": "Instagram & Gurme Tanıtım Reklamı",
    "category": "VARIABLE",
    "subType": "MARKETING",
    "amount": 5000,
    "period": "2026-10",
    "expenseDate": "2026-10-14",
    "dueDate": "2026-10-14",
    "invoiceNumber": "REK-4001",
    "counterparty": "Meta Ads / Dijital Ajans",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Mali Müşavir Reddetmişti: Fatura e-arşiv PDF belgesi bekleniyor",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": false,
    "sentToAdvisor": true,
    "status": "REJECTED",
    "rejectionReason": "Resmi e-Arşiv fatura PDF çıktısı eklenmemiş, stopaj tevkifatı kontrol edilmeli"
  },
  {
    "id": 14,
    "title": "Mutfak Havalandırma & Davlumbaz Tadilatı",
    "category": "VARIABLE",
    "subType": "RENOVATION",
    "amount": 8500,
    "period": "2026-10",
    "expenseDate": "2026-10-14",
    "dueDate": "2026-10-25",
    "invoiceNumber": "TDL-102",
    "counterparty": "Usta Havalandırma Ltd.",
    "paymentStatus": "PARTIAL",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Davlumbaz motor değişimi: 4.000 TL avans verildi, kalan 4.500 TL iş tesliminde ödenecek",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": false,
    "sentToAdvisor": true,
    "status": "SENT_TO_ADVISOR"
  },
  {
    "id": 15,
    "title": "Taze Sebze & Meyve Hal Alımı (Haftalık)",
    "category": "VARIABLE",
    "subType": "CONSUMABLES",
    "amount": 16400,
    "period": "2026-10",
    "expenseDate": "2026-10-16",
    "dueDate": "2026-10-16",
    "invoiceNumber": "HAL-2026-88",
    "counterparty": "Bayrampaşa Sebze Hali - Özkaya Tic.",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Günlük taze yeşillik, domates, mantar ve avokado alımı kasadan ödendi",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  },
  {
    "id": 16,
    "title": "Belediye Çevre Temizlik & İlan Reklam Vergisi",
    "category": "FIXED",
    "subType": "TAX",
    "amount": 6200,
    "period": "2026-10",
    "expenseDate": "2026-10-17",
    "dueDate": "2026-10-27",
    "invoiceNumber": "BLD-2026-44",
    "counterparty": "Belediye Gelirler Müdürlüğü",
    "paymentStatus": "UNPAID",
    "recordedBy": "SMMM Selim Aydın",
    "note": "2. Taksit ilan reklam ve çöp vergisi tahakkuku - Son ödeme 27 Ekim (Borçta)",
    "isOwnedProperty": false,
    "paidByCashier": false,
    "recordedInLedger": false,
    "sentToAdvisor": true,
    "status": "SENT_TO_ADVISOR"
  },
  {
    "id": 17,
    "title": "Banka POS Cihazı Komisyon & Ekstre Bedeli",
    "category": "VARIABLE",
    "subType": "ACCOUNTANT",
    "amount": 4850,
    "period": "2026-10",
    "expenseDate": "2026-10-17",
    "dueDate": "2026-10-17",
    "invoiceNumber": "POS-EKSTRE-10",
    "counterparty": "Garanti BBVA Üye İşyeri",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Ekim ayı POS cihazı bakım ve komisyon ekstresi kesintisi",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  },
  {
    "id": 18,
    "title": "Restoran Haşere İlaçlama & Biyosidal Hizmeti",
    "category": "VARIABLE",
    "subType": "RENOVATION",
    "amount": 2800,
    "period": "2026-10",
    "expenseDate": "2026-10-18",
    "dueDate": "2026-10-25",
    "invoiceNumber": "ILC-774",
    "counterparty": "Biyokim Hijyen ve İlaçlama A.Ş.",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Aylık periyodik mutfak ve depo haşere kontrolü, fatura kesildi",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": false,
    "sentToAdvisor": true,
    "status": "SENT_TO_ADVISOR"
  },
  {
    "id": 19,
    "title": "Paket Servis Kurye & Motosiklet Yakıt Masrafı",
    "category": "VARIABLE",
    "subType": "LOGISTICS",
    "amount": 3950,
    "period": "2026-10",
    "expenseDate": "2026-10-18",
    "dueDate": "2026-10-18",
    "invoiceNumber": "YKT-991",
    "counterparty": "Petrol Ofisi - İstasyon 14",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Kurye motosikletlerinin haftalık yakıt alımı fişleri",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": false,
    "sentToAdvisor": true,
    "status": "REJECTED",
    "rejectionReason": "Taşıt tanıma fişleri ile plaka eşleşmesi yapılmalı, fatura işletme unvanına düzenlenmeli"
  },
  {
    "id": 20,
    "title": "Derin Dondurucu Kompresör Gaz Dolumu",
    "category": "VARIABLE",
    "subType": "RENOVATION",
    "amount": 7200,
    "period": "2026-10",
    "expenseDate": "2026-10-19",
    "dueDate": "2026-10-29",
    "invoiceNumber": "SGT-550",
    "counterparty": "Termo Soğutma Sistemleri",
    "paymentStatus": "PARTIAL",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Kompresör gaz dolumu yapıldı, 3.500 ₺ peşin verildi, 3.700 ₺ ay sonu teslimde ödenecek",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": false,
    "sentToAdvisor": true,
    "status": "SENT_TO_ADVISOR"
  },
  {
    "id": 21,
    "title": "Mutfak & Bar Personeli OSGB Sağlık Raporu",
    "category": "FIXED",
    "subType": "LABOR",
    "amount": 5400,
    "period": "2026-10",
    "expenseDate": "2026-10-19",
    "dueDate": "2026-10-20",
    "invoiceNumber": "OSGB-339",
    "counterparty": "Vizyon OSGB Ortak Sağlık Birimi",
    "paymentStatus": "PAID",
    "recordedBy": "Canan Öztürk (Kasa)",
    "note": "Personel portör ve akciğer grafisi muayeneleri tamamlandı",
    "isOwnedProperty": false,
    "paidByCashier": true,
    "recordedInLedger": true,
    "sentToAdvisor": true,
    "status": "APPROVED_IN_LEDGER"
  }
];
