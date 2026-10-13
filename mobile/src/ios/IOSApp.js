import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Dimensions,
  Modal,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ROLES,
  ROLE_LABELS,
  ROLE_COLORS,
  DEMO_USERS,
  INITIAL_INVENTORY,
  INITIAL_RECIPES,
  INITIAL_SALES_SUMMARY,
  INITIAL_SALES_ITEMS,
  ROLE_MODULES,
} from '../data/inventoryData';
import { THEME } from '../theme/tokens';
import CameraScanner from '../components/CameraScanner';
import {
  apiFetchInventory,
  apiReceiveStock,
  apiRecordWaste,
  apiFetchUsers,
} from '../services/api';

const { width } = Dimensions.get('window');

// Web ile Birebir Yetki Matrisi (DashboardLayout.jsx NAV_ITEMS kuralı)
const ROLE_ALLOWED_SCREENS = {
  [ROLES.ADMIN]: ['dashboard', 'inventory', 'recipes', 'sales', 'warehouse', 'users'],
  [ROLES.MANAGER]: ['dashboard', 'inventory', 'recipes', 'sales', 'warehouse'],
  [ROLES.CHEF]: ['recipes', 'inventory'],
  [ROLES.WAREHOUSE]: ['warehouse'],
};

export default function IOSApp({ initialUser, onLogout }) {
  const insets = useSafeAreaInsets();
  const currentUser = initialUser || DEMO_USERS[0];

  // Bu rolün izinli olduğu ekranlar listesi
  const allowedScreens = ROLE_ALLOWED_SCREENS[currentUser.role] || ['warehouse'];

  // Varsayılan açılış ekranı
  const getDefaultScreen = (role) => {
    if (role === ROLES.WAREHOUSE) return 'warehouse';
    if (role === ROLES.CHEF) return 'recipes';
    return 'dashboard';
  };

  const [currentScreen, setCurrentScreen] = useState(getDefaultScreen(currentUser.role));
  const [screenStack, setScreenStack] = useState([getDefaultScreen(currentUser.role)]);

  const [items, setItems] = useState(INITIAL_INVENTORY);
  const [recipes, setRecipes] = useState(INITIAL_RECIPES);
  const [users, setUsers] = useState(DEMO_USERS);
  const [selectedItem, setSelectedItem] = useState(null);

  // Canlı Backend Senkronizasyonu (Mount anında veritabanı verilerini çeker)
  React.useEffect(() => {
    let mounted = true;
    const syncData = async () => {
      try {
        const liveItems = await apiFetchInventory();
        if (mounted && liveItems && liveItems.length > 0) {
          setItems(liveItems);
        }
        const liveUsers = await apiFetchUsers();
        if (mounted && liveUsers && liveUsers.length > 0) {
          setUsers(liveUsers);
        }
      } catch (err) {
        console.log('[iOS Sync] Error:', err);
      }
    };
    syncData();
    return () => { mounted = false; };
  }, []);

  // Kamera barkod tarayıcı
  const [cameraActive, setCameraActive] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [amount, setAmount] = useState('');
  const [toastMsg, setToastMsg] = useState('');

  // Ekleme Modalları
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [newStockItem, setNewStockItem] = useState({ name: '', cat: 'Taze Sebze & Meyve', barcode: '', stock: '', min: '', unit: 'kg', price: '' });

  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [newRecipe, setNewRecipe] = useState({ name: '', category: 'Ana Yemek', salePrice: '', cost: '' });

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', username: '', email: '', role: ROLES.CHEF });

  // Arama ve Filtreleme
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategory, setInventoryCategory] = useState('all');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [usersSearch, setUsersSearch] = useState('');

  const inventoryCategories = ['all', ...new Set(items.map((i) => i.cat))];

  const filteredItems = items.filter((it) => {
    const matchSearch =
      it.name.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      it.barcode.includes(inventorySearch);
    const matchCat = inventoryCategory === 'all' || it.cat === inventoryCategory;
    return matchSearch && matchCat;
  });

  const filteredRecipes = recipes.filter((r) =>
    r.name.toLowerCase().includes(recipeSearch.toLowerCase()) ||
    r.category.toLowerCase().includes(recipeSearch.toLowerCase())
  );

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(usersSearch.toLowerCase()) ||
    u.role.toLowerCase().includes(usersSearch.toLowerCase())
  );

  const navigateTo = (screen) => {
    // Katı Rol Koruması: Kullanıcı kendi yetkisinde olmayan bir ekrana ASLA geçemez
    if (!allowedScreens.includes(screen)) {
      showNotification('Bu modüle erişim yetkiniz bulunmamaktadır.');
      return;
    }
    setScreenStack((prev) => [...prev, screen]);
    setCurrentScreen(screen);
  };

  const handleGoBack = () => {
    if (selectedItem) {
      setSelectedItem(null);
      return;
    }
    if (cameraActive) {
      setCameraActive(false);
      return;
    }
    if (screenStack.length > 1) {
      const nextStack = [...screenStack];
      nextStack.pop();
      const prev = nextStack[nextStack.length - 1];
      setScreenStack(nextStack);
      setCurrentScreen(prev);
    } else {
      setCurrentScreen(getDefaultScreen(currentUser.role));
    }
  };

  const showNotification = (msg) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleStockAction = async (isAdd) => {
    const qty = parseFloat(amount);
    if (!selectedItem || isNaN(qty) || qty <= 0) return;

    // 1. Optimistic UI güncellemesi
    setItems((prev) =>
      prev.map((it) =>
        it.id === selectedItem.id
          ? { ...it, stock: isAdd ? it.stock + qty : Math.max(0, it.stock - qty) }
          : it
      )
    );
    showNotification(
      isAdd
        ? `✓ ${selectedItem.name} +${qty} ${selectedItem.unit} eklendi`
        : `⚠️ ${selectedItem.name} -${qty} ${selectedItem.unit} fire kaydedildi`
    );
    setAmount('');
    const targetItem = selectedItem;
    setSelectedItem(null);

    // 2. PostgreSQL veritabanına kaydeder
    try {
      if (isAdd) {
        await apiReceiveStock(targetItem.id, qty, `${currentUser.name} (iOS)`);
      } else {
        await apiRecordWaste(targetItem.id, qty, 'iOS Depo Zayiat', `${currentUser.name} (iOS)`);
      }
    } catch (e) {
      console.log('[iOS Stock Action] Sync error:', e);
    }
  };

  const onCameraScanned = (scannedCode) => {
    setCameraActive(false);
    const found = items.find((i) => i.barcode === scannedCode);
    if (found) {
      setSelectedItem(found);
      showNotification(`Barkod Tanındı: ${found.name}`);
    } else {
      showNotification(`Bilinmeyen Barkod: ${scannedCode}`);
    }
  };

  // Yeni Ürün Ekle
  const handleAddNewStock = () => {
    if (!newStockItem.name || !newStockItem.stock) {
      showNotification('Lütfen ürün adı ve miktar girin');
      return;
    }
    const created = {
      id: Date.now(),
      name: newStockItem.name,
      cat: newStockItem.cat || 'Kuru Gıda',
      barcode: newStockItem.barcode || `869${Date.now().toString().slice(-10)}`,
      stock: parseFloat(newStockItem.stock) || 0,
      min: parseFloat(newStockItem.min) || 5,
      unit: newStockItem.unit || 'kg',
      price: parseFloat(newStockItem.price) || 50,
    };
    setItems([created, ...items]);
    setShowAddStockModal(false);
    setNewStockItem({ name: '', cat: 'Taze Sebze & Meyve', barcode: '', stock: '', min: '', unit: 'kg', price: '' });
    showNotification(`Yeni Ürün Eklendi: ${created.name}`);
  };

  // Yeni Reçete Ekle
  const handleAddNewRecipe = () => {
    if (!newRecipe.name || !newRecipe.salePrice) {
      showNotification('Lütfen reçete adı ve satış fiyatı girin');
      return;
    }
    const sale = parseFloat(newRecipe.salePrice) || 100;
    const cost = parseFloat(newRecipe.cost) || 30;
    const fc = (cost / sale) * 100;

    const created = {
      id: Date.now(),
      name: newRecipe.name,
      category: newRecipe.category || 'Ana Yemek',
      salePrice: sale,
      cost: cost,
      foodCostPercent: fc,
      ingredients: [{ name: 'Temel Malzeme', amount: 'Porsiyon' }],
    };
    setRecipes([created, ...recipes]);
    setShowAddRecipeModal(false);
    setNewRecipe({ name: '', category: 'Ana Yemek', salePrice: '', cost: '' });
    showNotification(`Yeni Reçete Eklendi: ${created.name}`);
  };

  // Yeni Personel Ekle
  const handleAddNewUser = () => {
    if (!newUser.name || !newUser.username) {
      showNotification('Lütfen isim ve kullanıcı adı girin');
      return;
    }
    const initials = newUser.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    const created = {
      id: Date.now(),
      name: newUser.name,
      username: newUser.username,
      email: newUser.email || `${newUser.username}@gastrosync.com`,
      role: newUser.role,
      avatar: initials,
    };
    setUsers([...users, created]);
    setShowAddUserModal(false);
    setNewUser({ name: '', username: '', email: '', role: ROLES.CHEF });
    showNotification(`Yeni Personel Eklendi: ${created.name}`);
  };

  // iOS Dinamik Ada / Çentik ve Alt Çubuk Güvenli Boşluğu
  const bottomBarPadding = Math.max(insets.bottom, 14);

  return (
    <View style={styles.container}>
      {/* iOS Üst Navigasyon Barı */}
      <View style={styles.navBar}>
        <View style={styles.brandGroup}>
          {(screenStack.length > 1 || selectedItem || cameraActive) ? (
            <TouchableOpacity style={styles.iosBackBtn} onPress={handleGoBack} activeOpacity={0.7}>
              <Text style={styles.iosBackChevron}>‹</Text>
              <Text style={styles.iosBackText}>Geri</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>GS</Text>
            </View>
          )}
          <View>
            <Text style={styles.navTitle}>GastroSync iOS</Text>
            <Text style={styles.navSubTitle}>Lezzet Rotası</Text>
          </View>
        </View>

        {/* Aktif Kullanıcı Kartı & Sabit Rol Rozeti (Değiştirici Kaldırıldı - Sadece Çıkış Yapılabilir) */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View style={[styles.fixedRoleBadge, { backgroundColor: ROLE_COLORS[currentUser.role] }]}>
            <Text style={styles.roleBadgeAvatar}>{currentUser.avatar}</Text>
            <Text style={styles.roleBadgeText}>{ROLE_LABELS[currentUser.role]}</Text>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
            <Text style={styles.logoutBtnText}>Çıkış Yap</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Bildirim Toast */}
      {toastMsg ? (
        <View style={styles.toastBox}>
          <Text style={styles.toastMsgText}>{toastMsg}</Text>
        </View>
      ) : null}

      {/* Ana İçerik */}
      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: 70 + bottomBarPadding }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. EKRAN: FİNANSAL ÖZET (Dashboard - Web ile Birebir) */}
        {currentScreen === 'dashboard' && allowedScreens.includes('dashboard') && (
          <View>
            {/* Web Tarzı Keyvo Executive Culinary Hero Banner */}
            <View style={styles.webExecutiveHero}>
              <View style={styles.webHeroTopPill}>
                <View style={styles.webHeroPillDot} />
                <Text style={styles.webHeroPillTxt}>RESTORAN İŞLETİM & MALİYET ZEKASI</Text>
              </View>
              <Text style={styles.webHeroTitle}>Akıllı Reçete & Karlılık Motoru</Text>
              <Text style={styles.webHeroDesc}>
                Canlı POS satışları, anlık gramaj ve depocu mal kabul faturalarıyla tam senkronize.
              </Text>
              <View style={styles.webHeroBadgesRow}>
                <View style={styles.webHeroStatBadge}>
                  <Text style={styles.webHeroStatNum}>%68.4</Text>
                  <Text style={styles.webHeroStatLbl}>BRÜT KÂR</Text>
                </View>
                <View style={[styles.webHeroStatBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                  <Text style={[styles.webHeroStatNum, { color: '#065f46' }]}>Tier A</Text>
                  <Text style={styles.webHeroStatLbl}>VERİMLİLİK</Text>
                </View>
              </View>
            </View>

            {/* Web 4'lü KPI Metrik Kartları (dashboard-metrics) */}
            <View style={styles.webMetricsGrid}>
              <View style={styles.webMetricCard}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel}>Bugünkü Ciro (POS)</Text>
                  <Text style={styles.webMetricIcon}>💰</Text>
                </View>
                <Text style={styles.webMetricValue}>{INITIAL_SALES_SUMMARY.totalRevenue.toLocaleString('tr-TR')} ₺</Text>
                <Text style={styles.webMetricChange}>▲ %12.5 dünden fazla</Text>
              </View>

              <View style={styles.webMetricCard}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel}>Gıda Maliyeti</Text>
                  <Text style={styles.webMetricIcon}>📦</Text>
                </View>
                <Text style={styles.webMetricValue}>{INITIAL_SALES_SUMMARY.totalCost.toLocaleString('tr-TR')} ₺</Text>
                <Text style={styles.webMetricSubTxt}>Otomatik düşülen stok</Text>
              </View>

              <View style={styles.webMetricCard}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel}>Ortalama Food Cost</Text>
                  <Text style={styles.webMetricIcon}>🎯</Text>
                </View>
                <Text style={[styles.webMetricValue, { color: '#047857' }]}>%{INITIAL_SALES_SUMMARY.foodCostPercent}</Text>
                <Text style={styles.webMetricSubTxt}>Hedef: %28.0 altında</Text>
              </View>

              <View style={styles.webMetricCard}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel}>Kritik Stok Uyarısı</Text>
                  <Text style={styles.webMetricIcon}>⚠️</Text>
                </View>
                <Text style={[styles.webMetricValue, { color: '#f59e0b' }]}>
                  {items.filter((i) => i.stock <= i.min).length} Ürün
                </Text>
                <Text style={styles.webMetricSubTxt}>Tedarik önerisi hazır</Text>
              </View>
            </View>

            <Text style={styles.subSectionTitle}>MODÜL KISAYOLLARI</Text>
            <View style={styles.quickNavRow}>
              {allowedScreens.includes('inventory') && (
                <TouchableOpacity style={styles.quickNavBtn} onPress={() => navigateTo('inventory')}>
                  <Text style={styles.quickNavIcon}>📦</Text>
                  <Text style={styles.quickNavTxt}>Stok Yönetimi</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('recipes') && (
                <TouchableOpacity style={styles.quickNavBtn} onPress={() => navigateTo('recipes')}>
                  <Text style={styles.quickNavIcon}>📖</Text>
                  <Text style={styles.quickNavTxt}>Reçete Merkezi</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('sales') && (
                <TouchableOpacity style={styles.quickNavBtn} onPress={() => navigateTo('sales')}>
                  <Text style={styles.quickNavIcon}>📊</Text>
                  <Text style={styles.quickNavTxt}>Satış Analizi</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('warehouse') && (
                <TouchableOpacity style={styles.quickNavBtn} onPress={() => navigateTo('warehouse')}>
                  <Text style={styles.quickNavIcon}>📷</Text>
                  <Text style={styles.quickNavTxt}>Depo Terminali</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('users') && (
                <TouchableOpacity style={styles.quickNavBtn} onPress={() => navigateTo('users')}>
                  <Text style={styles.quickNavIcon}>👥</Text>
                  <Text style={styles.quickNavTxt}>Kullanıcı Yönetimi</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 2. EKRAN: STOK YÖNETİMİ (admin, mudur, sef) */}
        {currentScreen === 'inventory' && allowedScreens.includes('inventory') && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={styles.screenHeading}>Stok Yönetimi</Text>
                  <Text style={styles.screenSubHeading}>Hammadde ve envanter seviyeleri</Text>
                </View>
                {(currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER) && (
                  <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setShowAddStockModal(true)}>
                    <Text style={styles.primaryActionBtnTxt}>+ Ürün Ekle</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Web Mini-Stats Bar */}
            <View style={styles.webMiniStatsRow}>
              <View style={styles.webMiniStatCard}>
                <Text style={styles.webMiniStatVal}>{items.length}</Text>
                <Text style={styles.webMiniStatLbl}>Toplam Ürün</Text>
              </View>
              <View style={[styles.webMiniStatCard, { borderColor: '#fed7aa' }]}>
                <Text style={[styles.webMiniStatVal, { color: '#f59e0b' }]}>
                  {items.filter((i) => i.stock <= i.min).length}
                </Text>
                <Text style={styles.webMiniStatLbl}>Kritik Stok</Text>
              </View>
              <View style={styles.webMiniStatCard}>
                <Text style={[styles.webMiniStatVal, { color: '#047857' }]}>
                  {Math.round(items.reduce((s, i) => s + i.stock * i.price, 0) / 1000)}k ₺
                </Text>
                <Text style={styles.webMiniStatLbl}>Envanter Değeri</Text>
              </View>
            </View>

            <View style={styles.webFilterBar}>
              <TextInput
                style={styles.webSearchInput}
                placeholder="🔍 Ürün adı veya barkod ile arayın..."
                placeholderTextColor={THEME.colors.textLight}
                value={inventorySearch}
                onChangeText={setInventorySearch}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {inventoryCategories.map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.webChipBtn, inventoryCategory === cat && styles.webChipBtnActive]}
                    onPress={() => setInventoryCategory(cat)}
                  >
                    <Text style={[styles.webChipTxt, inventoryCategory === cat && styles.webChipTxtActive]}>
                      {cat === 'all' ? 'Tüm Kategoriler' : cat}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.webFilterCountRow}>
                <Text style={styles.webFilterCountTxt}>
                  Listelenen: <Text style={{ fontWeight: '800', color: THEME.colors.primary }}>{filteredItems.length}</Text> / {items.length} ürün
                </Text>
              </View>
            </View>

            {filteredItems.map((it) => (
              <TouchableOpacity
                key={it.id}
                style={[styles.dataCard, it.stock <= it.min && styles.dataCardAlert]}
                onPress={() => setSelectedItem(it)}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{it.name}</Text>
                  <Text style={styles.cardSub}>
                    {it.cat} • {it.barcode} • {it.price} ₺/{it.unit}
                  </Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={[styles.stockBold, it.stock <= it.min ? styles.textRed : styles.textGreen]}>
                    {it.stock} {it.unit}
                  </Text>
                  <Text style={[styles.statusTag, it.stock <= it.min ? styles.statusAlert : styles.statusOk]}>
                    {it.stock <= it.min ? '⚠️ Kritik' : '✓ Yeterli'}
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* 3. EKRAN: REÇETE MERKEZİ (admin, mudur, sef) */}
        {currentScreen === 'recipes' && allowedScreens.includes('recipes') && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View>
                  <Text style={styles.screenHeading}>Reçete Merkezi</Text>
                  <Text style={styles.screenSubHeading}>Mutfak gramaj ve maliyet analizi</Text>
                </View>
                <TouchableOpacity style={styles.primaryActionBtn} onPress={() => setShowAddRecipeModal(true)}>
                  <Text style={styles.primaryActionBtnTxt}>+ Reçete Ekle</Text>
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.filterCard}>
              <TextInput
                style={styles.searchInput}
                placeholder="🔍 Reçete veya yemek adı ara..."
                placeholderTextColor={THEME.colors.textLight}
                value={recipeSearch}
                onChangeText={setRecipeSearch}
              />
            </View>

            {filteredRecipes.map((r) => (
              <View key={r.id} style={styles.dataCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{r.name}</Text>
                  <Text style={styles.cardSub}>{r.category} • Satış Fiyatı: {r.salePrice} ₺</Text>
                  <View style={styles.ingredientsBox}>
                    <Text style={styles.ingTitle}>Malzemeler:</Text>
                    {r.ingredients.map((ing, i) => (
                      <Text key={i} style={styles.ingLine}>• {ing.name} ({ing.amount})</Text>
                    ))}
                  </View>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.recipeCostTxt}>Maliyet: {r.cost} ₺</Text>
                  <View style={[
                    styles.costBadge,
                    r.foodCostPercent >= 30 ? styles.badgeCostHigh : styles.badgeCostGood
                  ]}>
                    <Text style={styles.costBadgeTxt}>FC %{r.foodCostPercent.toFixed(1)}</Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 4. EKRAN: SATIŞ ANALİZİ (admin, mudur) */}
        {currentScreen === 'sales' && allowedScreens.includes('sales') && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.screenHeading}>Satış Analizi</Text>
              <Text style={styles.screenSubHeading}>POS entegrasyonu günlük veriler</Text>
            </View>

            <View style={styles.salesHeaderCard}>
              <Text style={styles.statLabel}>Günlük Ciro</Text>
              <Text style={styles.salesHeroNum}>{INITIAL_SALES_SUMMARY.totalRevenue.toLocaleString('tr-TR')} ₺</Text>
              <Text style={styles.salesSubTxt}>Maliyet: {INITIAL_SALES_SUMMARY.totalCost.toLocaleString('tr-TR')} ₺</Text>
            </View>

            <Text style={styles.subSectionTitle}>ÜRÜN BAZLI SATIŞLAR</Text>
            {INITIAL_SALES_ITEMS.map((item) => (
              <View key={item.id} style={styles.dataCard}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardSub}>{item.qty} Porsiyon Satıldı</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.salesItemRev}>{item.revenue.toLocaleString('tr-TR')} ₺</Text>
                  <Text style={styles.salesItemCost}>Maliyet: {item.cost} ₺</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 5. EKRAN: DEPO & MAL KABUL TERMİNALİ (admin, mudur, depocu) */}
        {currentScreen === 'warehouse' && allowedScreens.includes('warehouse') && (
          <View>
            <View style={styles.sectionHeaderRow}>
              <Text style={styles.screenHeading}>Depo ve Mal Kabul</Text>
              <Text style={styles.screenSubHeading}>Kamera ile barkod okutma ve fire kaydı</Text>
            </View>

            {cameraActive ? (
              <CameraScanner
                onBarcodeScanned={onCameraScanned}
                onClose={() => setCameraActive(false)}
              />
            ) : (
              <TouchableOpacity
                style={styles.openCameraHeroBtn}
                onPress={() => setCameraActive(true)}
              >
                <Text style={styles.openCameraIcon}>📷</Text>
                <Text style={styles.openCameraTitle}>Kamerayı Aç ve Barkod Okut</Text>
                <Text style={styles.openCameraSub}>iOS kamera ile anlık mal kabul / zayiat</Text>
              </TouchableOpacity>
            )}

            <View style={styles.filterCard}>
              <Text style={styles.filterCardTitle}>Manuel Barkod Sorgulama:</Text>
              <TextInput
                style={styles.searchInput}
                placeholder="Örn: 8691234567890"
                placeholderTextColor={THEME.colors.textLight}
                value={barcodeInput}
                onChangeText={setBarcodeInput}
                keyboardType="numeric"
              />
              <TouchableOpacity
                style={styles.btnManualSearch}
                onPress={() => {
                  const f = items.find((i) => i.barcode === barcodeInput.trim());
                  if (f) setSelectedItem(f);
                  else showNotification('Barkod bulunamadı');
                }}
              >
                <Text style={styles.btnManualSearchTxt}>Ürünü Getir</Text>
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <View style={styles.selectedItemCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.selectedItemTitle}>{selectedItem.name}</Text>
                  <TouchableOpacity style={styles.inlineBackBtn} onPress={() => setSelectedItem(null)}>
                    <Text style={styles.inlineBackBtnTxt}>✕ Kapat</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.selectedItemBarcode}>Barkod: {selectedItem.barcode}</Text>
                <Text style={styles.selectedItemStock}>
                  Mevcut Stok: {selectedItem.stock} {selectedItem.unit} (Min: {selectedItem.min})
                </Text>

                <TextInput
                  style={[styles.searchInput, { marginTop: 12 }]}
                  placeholder={`Miktar girin (${selectedItem.unit})`}
                  placeholderTextColor={THEME.colors.textLight}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />

                <View style={styles.actionBtnRow}>
                  <TouchableOpacity
                    style={[styles.actionBtnHalf, { backgroundColor: THEME.colors.accent }]}
                    onPress={() => handleStockAction(true)}
                  >
                    <Text style={styles.actionBtnHalfTxt}>+ Mal Kabul</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtnHalf, { backgroundColor: THEME.colors.danger }]}
                    onPress={() => handleStockAction(false)}
                  >
                    <Text style={styles.actionBtnHalfTxt}>⚠️ Zayiat / Fire</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        )}

        {/* 6. EKRAN: KULLANICI YÖNETİMİ (Sadece admin - Web ile Birebir) */}
        {currentScreen === 'users' && allowedScreens.includes('users') && (
          <View>
            <View style={styles.webHeaderRow}>
              <View>
                <Text style={styles.webPageTitle}>Kullanıcı & Personel Yönetimi</Text>
                <Text style={styles.webPageSub}>Personel hesapları ve yetki matrisi</Text>
              </View>
              <TouchableOpacity style={styles.webBtnPrimary} onPress={() => setShowAddUserModal(true)}>
                <Text style={styles.webBtnPrimaryTxt}>+ Yeni Personel Ekle</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.webFilterBar}>
              <TextInput
                style={styles.webSearchInput}
                placeholder="🔍 Personel adı, e-posta veya kullanıcı adı ara..."
                placeholderTextColor={THEME.colors.textLight}
                value={usersSearch}
                onChangeText={setUsersSearch}
              />
              <View style={styles.webFilterCountRow}>
                <Text style={styles.webFilterCountTxt}>
                  Listelenen: <Text style={{ fontWeight: '800', color: THEME.colors.primary }}>{filteredUsers.length}</Text> / {users.length} personel
                </Text>
              </View>
            </View>

            {filteredUsers.map((u) => (
              <View key={u.id} style={styles.webUserCard}>
                <View style={styles.webUserTopRow}>
                  <View style={[styles.webUserAvatar, { backgroundColor: ROLE_COLORS[u.role] }]}>
                    <Text style={styles.webUserAvatarTxt}>{u.avatar}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.webUserName}>{u.name}</Text>
                    <Text style={styles.webUserEmail}>✉️ {u.email}</Text>
                    <Text style={styles.webUserUname}>Kullanıcı Adı: <Text style={{ fontWeight: '700' }}>{u.username}</Text></Text>
                  </View>
                  <View style={[styles.webRolePill, { backgroundColor: ROLE_COLORS[u.role] + '18', borderColor: ROLE_COLORS[u.role] }]}>
                    <Text style={[styles.webRolePillTxt, { color: ROLE_COLORS[u.role] }]}>
                      {ROLE_LABELS[u.role]}
                    </Text>
                  </View>
                </View>

                <View style={styles.webUserModuleBox}>
                  <Text style={styles.webUserModuleLabel}>Erişim Modülleri:</Text>
                  <Text style={styles.webUserModuleTxt}>{ROLE_MODULES[u.role] || 'Yetkilendirilmiş restoran modülleri'}</Text>
                </View>

                <View style={styles.webUserCardFooter}>
                  <Text style={styles.webUserStatusTxt}>Durum: Aktif Oturum</Text>
                  {currentUser.role === ROLES.ADMIN && u.username !== 'admin' && (
                    <TouchableOpacity
                      style={styles.webUserDismissBtn}
                      onPress={() => {
                        setUsers(users.filter(x => x.id !== u.id));
                        showNotification(`${u.name} sistemden çıkarıldı.`);
                      }}
                    >
                      <Text style={styles.webUserDismissTxt}>🗑️ Görevden Al</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* MODAL 1: YENİ ÜRÜN EKLE */}
      <Modal visible={showAddStockModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>Yeni Stok Ürünü Ekle</Text>
              <TouchableOpacity onPress={() => setShowAddStockModal(false)}>
                <Text style={styles.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Ürün Adı"
              placeholderTextColor={THEME.colors.textLight}
              value={newStockItem.name}
              onChangeText={(t) => setNewStockItem({ ...newStockItem, name: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Kategori"
              placeholderTextColor={THEME.colors.textLight}
              value={newStockItem.cat}
              onChangeText={(t) => setNewStockItem({ ...newStockItem, cat: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Barkod (Boşsa otomatik üretilir)"
              placeholderTextColor={THEME.colors.textLight}
              value={newStockItem.barcode}
              onChangeText={(t) => setNewStockItem({ ...newStockItem, barcode: t })}
              keyboardType="numeric"
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Stok"
                placeholderTextColor={THEME.colors.textLight}
                value={newStockItem.stock}
                onChangeText={(t) => setNewStockItem({ ...newStockItem, stock: t })}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Birim (kg, lt)"
                placeholderTextColor={THEME.colors.textLight}
                value={newStockItem.unit}
                onChangeText={(t) => setNewStockItem({ ...newStockItem, unit: t })}
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddNewStock}>
                <Text style={styles.modalSubmitTxt}>Kaydet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddStockModal(false)}>
                <Text style={styles.modalCancelTxt}>Geri Dön</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 2: YENİ REÇETE EKLE */}
      <Modal visible={showAddRecipeModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>Yeni Reçete Ekle</Text>
              <TouchableOpacity onPress={() => setShowAddRecipeModal(false)}>
                <Text style={styles.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Reçete Adı"
              placeholderTextColor={THEME.colors.textLight}
              value={newRecipe.name}
              onChangeText={(t) => setNewRecipe({ ...newRecipe, name: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Kategori (Ana Yemek, Tatlı)"
              placeholderTextColor={THEME.colors.textLight}
              value={newRecipe.category}
              onChangeText={(t) => setNewRecipe({ ...newRecipe, category: t })}
            />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Satış Fiyatı (TL)"
                placeholderTextColor={THEME.colors.textLight}
                value={newRecipe.salePrice}
                onChangeText={(t) => setNewRecipe({ ...newRecipe, salePrice: t })}
                keyboardType="numeric"
              />
              <TextInput
                style={[styles.modalInput, { flex: 1 }]}
                placeholder="Maliyet (TL)"
                placeholderTextColor={THEME.colors.textLight}
                value={newRecipe.cost}
                onChangeText={(t) => setNewRecipe({ ...newRecipe, cost: t })}
                keyboardType="numeric"
              />
            </View>
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddNewRecipe}>
                <Text style={styles.modalSubmitTxt}>Reçeteyi Ekle</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddRecipeModal(false)}>
                <Text style={styles.modalCancelTxt}>Geri Dön</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: YENİ PERSONEL EKLE */}
      <Modal visible={showAddUserModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={styles.modalTitle}>Yeni Personel Ekle</Text>
              <TouchableOpacity onPress={() => setShowAddUserModal(false)}>
                <Text style={styles.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.modalInput}
              placeholder="Ad Soyad"
              placeholderTextColor={THEME.colors.textLight}
              value={newUser.name}
              onChangeText={(t) => setNewUser({ ...newUser, name: t })}
            />
            <TextInput
              style={styles.modalInput}
              placeholder="Kullanıcı Adı"
              placeholderTextColor={THEME.colors.textLight}
              value={newUser.username}
              onChangeText={(t) => setNewUser({ ...newUser, username: t })}
              autoCapitalize="none"
            />
            <TextInput
              style={styles.modalInput}
              placeholder="E-posta"
              placeholderTextColor={THEME.colors.textLight}
              value={newUser.email}
              onChangeText={(t) => setNewUser({ ...newUser, email: t })}
              autoCapitalize="none"
            />
            <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.colors.textMuted, marginVertical: 6 }}>
              Görev Rolü:
            </Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
              {Object.keys(ROLES).map((rKey) => {
                const rVal = ROLES[rKey];
                return (
                  <TouchableOpacity
                    key={rVal}
                    style={[styles.catChip, newUser.role === rVal && styles.catChipActive]}
                    onPress={() => setNewUser({ ...newUser, role: rVal })}
                  >
                    <Text style={[styles.catChipText, newUser.role === rVal && styles.catChipTextActive]}>
                      {ROLE_LABELS[rVal]}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleAddNewUser}>
                <Text style={styles.modalSubmitTxt}>Kaydet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddUserModal(false)}>
                <Text style={styles.modalCancelTxt}>Geri Dön</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* iOS Alt Gezinme Barı (SADECE KULLANICININ YETKİSİ OLAN SEKMELER GÖRÜNÜR) */}
      <View style={[styles.bottomBar, { paddingBottom: bottomBarPadding, height: 54 + bottomBarPadding }]}>
        {allowedScreens.includes('dashboard') && (
          <TouchableOpacity style={styles.bottomTab} onPress={() => navigateTo('dashboard')}>
            <Text style={styles.bottomTabIcon}>🏠</Text>
            <Text style={[styles.bottomTabText, currentScreen === 'dashboard' && styles.bottomTabActive]}>
              Özet
            </Text>
          </TouchableOpacity>
        )}

        {allowedScreens.includes('inventory') && (
          <TouchableOpacity style={styles.bottomTab} onPress={() => navigateTo('inventory')}>
            <Text style={styles.bottomTabIcon}>📦</Text>
            <Text style={[styles.bottomTabText, currentScreen === 'inventory' && styles.bottomTabActive]}>
              Stok
            </Text>
          </TouchableOpacity>
        )}

        {allowedScreens.includes('recipes') && (
          <TouchableOpacity style={styles.bottomTab} onPress={() => navigateTo('recipes')}>
            <Text style={styles.bottomTabIcon}>📖</Text>
            <Text style={[styles.bottomTabText, currentScreen === 'recipes' && styles.bottomTabActive]}>
              Reçete
            </Text>
          </TouchableOpacity>
        )}

        {allowedScreens.includes('sales') && (
          <TouchableOpacity style={styles.bottomTab} onPress={() => navigateTo('sales')}>
            <Text style={styles.bottomTabIcon}>📊</Text>
            <Text style={[styles.bottomTabText, currentScreen === 'sales' && styles.bottomTabActive]}>
              Satış
            </Text>
          </TouchableOpacity>
        )}

        {allowedScreens.includes('warehouse') && (
          <TouchableOpacity style={styles.bottomTab} onPress={() => navigateTo('warehouse')}>
            <Text style={styles.bottomTabIcon}>📷</Text>
            <Text style={[styles.bottomTabText, currentScreen === 'warehouse' && styles.bottomTabActive]}>
              Terminal
            </Text>
          </TouchableOpacity>
        )}

        {allowedScreens.includes('users') && (
          <TouchableOpacity style={styles.bottomTab} onPress={() => navigateTo('users')}>
            <Text style={styles.bottomTabIcon}>👥</Text>
            <Text style={[styles.bottomTabText, currentScreen === 'users' && styles.bottomTabActive]}>
              Kullanıcı
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  navBar: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: THEME.colors.headerBg,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.25)',
  },
  brandGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iosBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingRight: 6,
  },
  iosBackChevron: {
    fontSize: 24,
    color: THEME.colors.accent,
    fontWeight: '300',
    marginTop: -2,
  },
  iosBackText: {
    fontSize: 14,
    color: THEME.colors.accent,
    fontWeight: '700',
    marginLeft: 2,
  },
  brandBadge: {
    backgroundColor: THEME.colors.accent,
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  brandBadgeText: {
    color: '#07190e',
    fontWeight: '900',
    fontSize: 12,
  },
  navTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#ffffff',
  },
  navSubTitle: {
    fontSize: 9,
    color: '#96be9f',
    fontWeight: '500',
  },
  fixedRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 16,
    gap: 4,
  },
  roleBadgeAvatar: {
    fontSize: 10,
    fontWeight: '800',
    color: '#ffffff',
  },
  roleBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
  },
  logoutBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: 10,
    fontWeight: '700',
  },
  toastBox: {
    margin: 12,
    backgroundColor: THEME.colors.accentBg,
    borderWidth: 1,
    borderColor: THEME.colors.accent,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
  },
  toastMsgText: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  scrollContent: {
    padding: 16,
  },
  sectionHeaderRow: {
    marginBottom: 12,
  },
  screenHeading: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  screenSubHeading: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  primaryActionBtn: {
    backgroundColor: THEME.colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 8,
  },
  primaryActionBtnTxt: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '800',
  },
  kpiCardHero: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    elevation: 2,
  },
  kpiHeroLabel: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  kpiHeroVal: {
    fontSize: 28,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginVertical: 4,
  },
  heroBadgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  heroBadge: {
    backgroundColor: THEME.colors.mintSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  heroBadgeTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  statLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  statVal: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 4,
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  quickNavRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  quickNavBtn: {
    width: (width - 42) / 2,
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    gap: 6,
  },
  quickNavIcon: {
    fontSize: 24,
  },
  quickNavTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  filterCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  filterCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  searchInput: {
    backgroundColor: THEME.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 10,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  catChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: THEME.colors.background,
    marginRight: 6,
    marginTop: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  catChipActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  catChipText: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  catChipTextActive: {
    color: '#ffffff',
  },
  counterText: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'right',
    marginBottom: 8,
  },
  dataCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    flexDirection: 'row',
    alignItems: 'center',
  },
  dataCardAlert: {
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.danger,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  cardSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  stockBold: {
    fontSize: 14,
    fontWeight: '800',
  },
  textGreen: {
    color: THEME.colors.accentDark,
  },
  textRed: {
    color: THEME.colors.danger,
  },
  statusTag: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  statusOk: {
    color: THEME.colors.accentDark,
  },
  statusAlert: {
    color: THEME.colors.danger,
  },
  ingredientsBox: {
    marginTop: 6,
    backgroundColor: THEME.colors.background,
    padding: 6,
    borderRadius: 6,
  },
  ingTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  ingLine: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
  },
  recipeCostTxt: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  costBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  badgeCostGood: {
    backgroundColor: '#dcfce7',
  },
  badgeCostHigh: {
    backgroundColor: '#fee2e2',
  },
  costBadgeTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  salesHeaderCard: {
    backgroundColor: THEME.colors.surface,
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    marginBottom: 12,
  },
  salesHeroNum: {
    fontSize: 26,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginVertical: 4,
  },
  salesSubTxt: {
    fontSize: 12,
    color: THEME.colors.textMuted,
  },
  salesItemRev: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.accentDark,
  },
  salesItemCost: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  openCameraHeroBtn: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 4,
  },
  openCameraIcon: {
    fontSize: 36,
    marginBottom: 6,
  },
  openCameraTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  openCameraSub: {
    fontSize: 12,
    color: '#96be9f',
    marginTop: 4,
  },
  btnManualSearch: {
    backgroundColor: THEME.colors.primary,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  btnManualSearchTxt: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  selectedItemCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    padding: 16,
    borderWidth: 2,
    borderColor: THEME.colors.accent,
    marginBottom: 14,
  },
  inlineBackBtn: {
    backgroundColor: '#fee2e2',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  inlineBackBtnTxt: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '700',
  },
  selectedItemTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
  },
  selectedItemBarcode: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  selectedItemStock: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginTop: 6,
  },
  actionBtnRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionBtnHalf: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnHalfTxt: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  userAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarTxt: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  roleTag: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleTagTxt: {
    fontSize: 10,
    fontWeight: '700',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: THEME.colors.surface,
    borderTopWidth: 1,
    borderTopColor: THEME.colors.border,
    flexDirection: 'row',
  },
  bottomTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bottomTabIcon: {
    fontSize: 16,
  },
  bottomTabText: {
    fontSize: 10,
    color: THEME.colors.textMuted,
    fontWeight: '600',
    marginTop: 2,
  },
  bottomTabActive: {
    color: THEME.colors.accentDark,
    fontWeight: '800',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: THEME.colors.surface,
    width: '100%',
    borderRadius: 18,
    padding: 20,
    elevation: 8,
  },
  modalCloseX: {
    fontSize: 18,
    color: THEME.colors.textMuted,
    fontWeight: '700',
    padding: 4,
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  modalInput: {
    backgroundColor: THEME.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 10,
    fontSize: 13,
    color: THEME.colors.textPrimary,
    marginBottom: 10,
  },
  modalSubmitBtn: {
    flex: 1,
    backgroundColor: THEME.colors.primary,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalSubmitTxt: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  modalCancelBtn: {
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelTxt: {
    color: THEME.colors.textMuted,
    fontWeight: '600',
    fontSize: 13,
  },

  /* --- Web Birebir Eşleşme Stilleri --- */
  webExecutiveHero: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 20,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#dbe7df',
    borderTopWidth: 4,
    borderTopColor: '#10b981',
    shadowColor: '#0a1f11',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
  },
  webHeroTopPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#dcfce7',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 16,
    width: 'auto',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#bbf7d0',
    marginBottom: 8,
  },
  webHeroPillDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  webHeroPillTxt: {
    fontSize: 9,
    fontWeight: '800',
    color: '#065f46',
    letterSpacing: 0.5,
  },
  webHeroTitle: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0a1f11',
    marginBottom: 4,
    letterSpacing: -0.3,
  },
  webHeroDesc: {
    fontSize: 12,
    color: '#475569',
    lineHeight: 18,
    marginBottom: 12,
  },
  webHeroBadgesRow: {
    flexDirection: 'row',
    gap: 10,
  },
  webHeroStatBadge: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe7df',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flex: 1,
  },
  webHeroStatNum: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0a1f11',
  },
  webHeroStatLbl: {
    fontSize: 9,
    fontWeight: '700',
    color: '#64748b',
    letterSpacing: 0.4,
    marginTop: 2,
  },
  webMetricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  webMetricCard: {
    width: (width - 42) / 2,
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbe7df',
    shadowColor: '#0a1f11',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
  },
  webMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  webMetricLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
    flex: 1,
  },
  webMetricIcon: {
    fontSize: 16,
  },
  webMetricValue: {
    fontSize: 18,
    fontWeight: '900',
    color: '#0a1f11',
  },
  webMetricChange: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    marginTop: 4,
  },
  webMetricSubTxt: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 4,
  },
  webHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  webPageTitle: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0a1f11',
    letterSpacing: -0.3,
  },
  webPageSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  webBtnPrimary: {
    backgroundColor: '#0a1f11',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#153d24',
  },
  webBtnPrimaryTxt: {
    color: '#ffffff',
    fontSize: 11,
    fontWeight: '800',
  },
  webFilterBar: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dbe7df',
    marginBottom: 12,
  },
  webSearchInput: {
    backgroundColor: '#f2f7f4',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#dbe7df',
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
    color: '#0f172a',
    fontWeight: '600',
  },
  webFilterCountRow: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  webFilterCountTxt: {
    fontSize: 11,
    color: '#64748b',
  },
  webUserCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dbe7df',
    marginBottom: 10,
    shadowColor: '#0a1f11',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  webUserTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 10,
  },
  webUserAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webUserAvatarTxt: {
    color: '#ffffff',
    fontWeight: '900',
    fontSize: 15,
  },
  webUserName: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0a1f11',
  },
  webUserEmail: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  webUserUname: {
    fontSize: 10,
    color: '#94a3b8',
    marginTop: 2,
  },
  webRolePill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
    borderWidth: 1,
  },
  webRolePillTxt: {
    fontSize: 11,
    fontWeight: '800',
  },
  webUserModuleBox: {
    backgroundColor: '#f8faf9',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e8f0ea',
    marginBottom: 10,
  },
  webUserModuleLabel: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 2,
  },
  webUserModuleTxt: {
    fontSize: 11,
    color: '#64748b',
    lineHeight: 16,
  },
  webUserCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f3',
    paddingTop: 8,
  },
  webUserStatusTxt: {
    fontSize: 10,
    color: '#10b981',
    fontWeight: '700',
  },
  webUserDismissBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: '#fee2e2',
    borderRadius: 8,
  },
  webUserDismissTxt: {
    color: '#b91c1c',
    fontSize: 11,
    fontWeight: '700',
  },
  webMiniStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  webMiniStatCard: {
    flex: 1,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#dbe7df',
    alignItems: 'center',
  },
  webMiniStatVal: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0a1f11',
  },
  webMiniStatLbl: {
    fontSize: 10,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
  },
  webChipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: '#f2f7f4',
    marginRight: 6,
    borderWidth: 1,
    borderColor: '#dbe7df',
  },
  webChipBtnActive: {
    backgroundColor: '#0a1f11',
    borderColor: '#0a1f11',
  },
  webChipTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  webChipTxtActive: {
    color: '#ffffff',
  },
  webRecipeCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#dbe7df',
    marginBottom: 10,
    shadowColor: '#0a1f11',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
  },
  webRecipeTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  webRecipeCategory: {
    fontSize: 10,
    fontWeight: '700',
    color: '#059669',
    textTransform: 'uppercase',
  },
  webRecipeTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#0a1f11',
    marginTop: 2,
  },
  webFcBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  webFcBadgeGood: {
    backgroundColor: '#dcfce7',
  },
  webFcBadgeDanger: {
    backgroundColor: '#fee2e2',
  },
  webFcBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
  },
  webFcBadgeTxtGood: {
    color: '#065f46',
  },
  webFcBadgeTxtDanger: {
    color: '#991b1b',
  },
  webRecipeStatsRow: {
    flexDirection: 'row',
    backgroundColor: '#f8faf9',
    borderRadius: 10,
    padding: 10,
    borderWidth: 1,
    borderColor: '#e8f0ea',
    marginBottom: 10,
  },
  webRecipeStatCol: {
    flex: 1,
    alignItems: 'center',
  },
  webRecipeStatLbl: {
    fontSize: 10,
    color: '#64748b',
    fontWeight: '600',
  },
  webRecipeStatVal: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  webRecipeIngBox: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f3',
    paddingTop: 8,
  },
  webRecipeIngHead: {
    fontSize: 10,
    fontWeight: '800',
    color: '#475569',
    marginBottom: 4,
  },
  webRecipeIngLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  webRecipeIngName: {
    fontSize: 11,
    color: '#334155',
  },
  webRecipeIngAmount: {
    fontSize: 11,
    fontWeight: '700',
    color: '#047857',
  },
  webSalesCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbe7df',
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  webWhActionRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  webWhActionBtn: {
    flex: 1,
    borderRadius: 16,
    padding: 18,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  webWhActionIcon: {
    fontSize: 26,
    marginBottom: 4,
  },
  webWhActionTitle: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '800',
  },
  webWhActionSub: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
  },
  webSearchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbe7df',
    marginBottom: 12,
  },
});
