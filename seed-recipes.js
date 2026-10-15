const recipes = [
  {
    name: 'Taş Fırın Pizza Margherita',
    category: 'Pizza & Fırın',
    salePrice: 340.00,
    portions: 1,
    description: 'San Marzano domates sosu, manda mozzarella, taze fesleğen ve sızma zeytinyağı ile.',
    ingredientsJson: JSON.stringify([
      { name: 'Un (Tip 550)', quantity: 0.22, unit: 'kg', unitCost: 28.00, cost: 6.16 },
      { name: 'Domates (Salkım)', quantity: 0.15, unit: 'kg', unitCost: 45.00, cost: 6.75 },
      { name: 'Mozzarella Peyniri', quantity: 0.14, unit: 'kg', unitCost: 320.00, cost: 44.80 },
      { name: 'Zeytinyağı (Sızma)', quantity: 0.02, unit: 'lt', unitCost: 290.00, cost: 5.80 }
    ])
  },
  {
    name: 'Kuşkonmaz Yatağında Fırın Somon',
    category: 'Deniz Ürünleri',
    salePrice: 540.00,
    portions: 1,
    description: 'Norveç somon fileto, erken hasat sızma zeytinyağı, kapari ve fırınlanmış çeri domates.',
    ingredientsJson: JSON.stringify([
      { name: 'Zeytinyağı (Sızma)', quantity: 0.025, unit: 'lt', unitCost: 290.00, cost: 7.25 },
      { name: 'Domates (Salkım)', quantity: 0.12, unit: 'kg', unitCost: 45.00, cost: 5.40 }
    ])
  },
  {
    name: 'Odun Ateşinde Izgara Köfte',
    category: 'Ana Yemek',
    salePrice: 350.00,
    portions: 1,
    description: 'Geleneksel yoğrulmuş dana kıyma, közlenmiş çeri domates ve sumaklı taze soğan.',
    ingredientsJson: JSON.stringify([
      { name: 'Dana Antrikot', quantity: 0.20, unit: 'kg', unitCost: 450.00, cost: 90.00 },
      { name: 'Domates (Salkım)', quantity: 0.08, unit: 'kg', unitCost: 45.00, cost: 3.60 },
      { name: 'Zeytinyağı (Sızma)', quantity: 0.01, unit: 'lt', unitCost: 290.00, cost: 2.90 }
    ])
  },
  {
    name: 'Trüflü Yabani Mantarlı Risotto',
    category: 'Ana Yemek',
    salePrice: 420.00,
    portions: 1,
    description: 'Kestane mantarları, Arborio pirinci, parmesan peyniri ve zengin trüf aroması.',
    ingredientsJson: JSON.stringify([
      { name: 'Krema (%35)', quantity: 0.08, unit: 'lt', unitCost: 115.00, cost: 9.20 },
      { name: 'Zeytinyağı (Sızma)', quantity: 0.03, unit: 'lt', unitCost: 290.00, cost: 8.70 }
    ])
  },
  {
    name: 'Klasik Sezar Salata',
    category: 'Salata',
    salePrice: 260.00,
    portions: 1,
    description: 'Çıtır marul yaprakları, ızgara tavuk göğsü, kruton ekmekler ve ev yapımı sezar sos.',
    ingredientsJson: JSON.stringify([
      { name: 'Tavuk Göğsü', quantity: 0.15, unit: 'kg', unitCost: 180.00, cost: 27.00 },
      { name: 'Zeytinyağı (Sızma)', quantity: 0.02, unit: 'lt', unitCost: 290.00, cost: 5.80 },
      { name: 'Domates (Salkım)', quantity: 0.05, unit: 'kg', unitCost: 45.00, cost: 2.25 }
    ])
  },
  {
    name: 'Otantik İtalyan Tiramisu',
    category: 'Tatlı',
    salePrice: 220.00,
    portions: 1,
    description: 'Espresso ile ıslatılmış Savoiardi kedi dili, zengin mascarpone kreması ve kakao tozu.',
    ingredientsJson: JSON.stringify([
      { name: 'Espresso Çekirdeği', quantity: 0.02, unit: 'kg', unitCost: 520.00, cost: 10.40 },
      { name: 'Krema (%35)', quantity: 0.12, unit: 'lt', unitCost: 115.00, cost: 13.80 }
    ])
  }
];

async function seed() {
  for (const r of recipes) {
    try {
      const res = await fetch('http://localhost:8080/api/recipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(r)
      });
      const data = await res.json();
      console.log('Eklendi:', r.name, data.success);
    } catch (e) {
      console.error('Hata:', r.name, e);
    }
  }
}

seed();
