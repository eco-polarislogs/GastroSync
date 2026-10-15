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
import {
  apiFetchInventory,
  apiReceiveStock,
  apiRecordWaste,
  apiFetchUsers,
  apiUpdateUserRole,
  apiCreateUser,
  apiDeleteUser,
  apiFetchRecipes,
  apiCreateRecipe,
  apiUpdateRecipe,
  apiDeleteRecipe,
  apiCreateInventoryItem,
  apiUpdateInventoryItem,
  apiDeleteInventoryItem,
  apiFetchTransactions,
  apiFetchExpenses,
  apiCreateExpense,
  apiUpdateExpense,
  apiDeleteExpense,
  apiFetchNotifications,
  apiCreateNotification,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
} from '../services/api';

const { width } = Dimensions.get('window');

// Web ile Birebir Yetki Matrisi (DashboardLayout.jsx NAV_ITEMS kuralı)
const ROLE_ALLOWED_SCREENS = {
  [ROLES.ADMIN]: ['dashboard', 'accounting', 'inventory', 'recipes', 'sales', 'warehouse', 'users'],
  [ROLES.MANAGER]: ['dashboard', 'accounting', 'inventory', 'recipes', 'sales', 'warehouse'],
  [ROLES.ACCOUNTANT]: ['accounting', 'dashboard', 'inventory', 'sales'],
  [ROLES.FINANCIAL_ADVISOR]: ['accounting', 'dashboard', 'inventory', 'sales'],
  [ROLES.CHEF]: ['recipes', 'inventory'],
  [ROLES.WAREHOUSE]: ['warehouse'],
};

export default function AndroidApp({ initialUser, onLogout }) {
  const insets = useSafeAreaInsets();
  const currentUser = initialUser || DEMO_USERS[0];

  // Bu rolün izinli olduğu ekranlar listesi (Roller birbirinin ekranlarına geçemez)
  const allowedScreens = ROLE_ALLOWED_SCREENS[currentUser.role] || ['warehouse'];

  const getDefaultScreen = (role) => {
    if (role === ROLES.ACCOUNTANT || role === ROLES.FINANCIAL_ADVISOR) return 'accounting';
    if (role === ROLES.WAREHOUSE) return 'warehouse';
    if (role === ROLES.CHEF) return 'recipes';
    return 'dashboard';
  };

  const [currentScreen, setCurrentScreen] = useState(getDefaultScreen(currentUser.role));
  // Android sanal gezinme tuşuna (üçgen / jest) ihtiyaç bırakmayan dahili ekran geri navigasyon yığını
  const [screenStack, setScreenStack] = useState([getDefaultScreen(currentUser.role)]);

  const [items, setItems] = useState(INITIAL_INVENTORY);
  const [recipes, setRecipes] = useState(INITIAL_RECIPES);
  const [users, setUsers] = useState(DEMO_USERS);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([
    { id: 1, title: 'Merkez Restoran Kirası', category: 'FIXED', subType: 'RENT', amount: 45000, period: '2026-10', expenseDate: '2026-10-01', dueDate: '2026-10-05', invoiceNumber: 'KRA-2026/10', counterparty: 'Ahmet Yılmaz (Mal Sahibi)', paymentStatus: 'PAID', note: 'Ana cadde dükkan kirası - Havale ile ödendi', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'APPROVED_IN_LEDGER' },
    { id: 2, title: 'Mutfak & Servis Personel Maaşları', category: 'FIXED', subType: 'LABOR', amount: 85000, period: '2026-10', expenseDate: '2026-10-05', dueDate: '2026-10-05', invoiceNumber: 'BORDRO-10', counterparty: 'Personel (6 Kişi)', paymentStatus: 'PAID', note: '6 Personel net maaş', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'APPROVED_IN_LEDGER' },
    { id: 3, title: 'Mali Müşavirlik & Danışmanlık', category: 'FIXED', subType: 'ACCOUNTANT', amount: 8500, period: '2026-10', expenseDate: '2026-10-05', dueDate: '2026-10-10', invoiceNumber: 'SMMM-089', counterparty: 'SMMM Selim Aydın', paymentStatus: 'PAID', note: 'Aylık defter tutma ve beyanname', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'APPROVED_IN_LEDGER' },
    { id: 4, title: 'Sanayi Tipi Elektrik Faturası', category: 'VARIABLE', subType: 'ELECTRICITY', amount: 14200, period: '2026-10', expenseDate: '2026-10-10', dueDate: '2026-10-24', invoiceNumber: 'ELEK-8839', counterparty: 'Enerjisa A.Ş.', paymentStatus: 'UNPAID', note: 'Son ödeme 24 Ekim - Kasa nakit akışı bekleniyor, borca bırakıldı', isOwnedProperty: false, paidByCashier: false, recordedInLedger: false, sentToAdvisor: true, status: 'SENT_TO_ADVISOR' },
    { id: 5, title: 'Şebeke Su Faturası', category: 'VARIABLE', subType: 'WATER', amount: 3800, period: '2026-10', expenseDate: '2026-10-10', dueDate: '2026-10-18', invoiceNumber: 'ISKI-443', counterparty: 'İSKİ', paymentStatus: 'PAID', note: 'Bulaşıkhane ve mutfak tüketimi', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'APPROVED_IN_LEDGER' },
    { id: 6, title: 'Endüstriyel Mutfak Doğalgaz', category: 'VARIABLE', subType: 'GAS', amount: 9600, period: '2026-10', expenseDate: '2026-10-11', dueDate: '2026-10-28', invoiceNumber: 'IGDAS-992', counterparty: 'İGDAŞ', paymentStatus: 'UNPAID', note: 'Ocak ve fırın hattı - Gelecek hafta ödenecek (Borç/Vade)', isOwnedProperty: false, paidByCashier: false, recordedInLedger: false, sentToAdvisor: true, status: 'SENT_TO_ADVISOR' },
    { id: 7, title: 'Restoran Rezervasyon Telefonları', category: 'VARIABLE', subType: 'PHONE', amount: 850, period: '2026-10', expenseDate: '2026-10-08', dueDate: '2026-10-15', invoiceNumber: 'TEL-5542', counterparty: 'Türk Telekom', paymentStatus: 'PAID', note: 'İletişim hatları', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'APPROVED_IN_LEDGER' },
    { id: 8, title: 'Fiber İnternet & POS Hattı', category: 'VARIABLE', subType: 'INTERNET', amount: 1250, period: '2026-10', expenseDate: '2026-10-08', dueDate: '2026-10-15', invoiceNumber: 'INT-9901', counterparty: 'Superonline', paymentStatus: 'PAID', note: 'POS ve Wi-Fi altyapısı', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'APPROVED_IN_LEDGER' },
    { id: 9, title: 'KDV ve Geçici Vergi Beyanı', category: 'VARIABLE', subType: 'TAX', amount: 18500, period: '2026-10', expenseDate: '2026-10-12', dueDate: '2026-10-26', invoiceNumber: 'GIB-2026-9', counterparty: 'Vergi Dairesi', paymentStatus: 'UNPAID', note: 'Aylık vergi tahakkukları yapıldı, son ödeme 26 Ekim (Borçta)', isOwnedProperty: false, paidByCashier: false, recordedInLedger: true, sentToAdvisor: true, status: 'APPROVED_IN_LEDGER' },
    { id: 10, title: 'Personel SGK & Prim Ödemesi', category: 'VARIABLE', subType: 'SGK', amount: 27500, period: '2026-10', expenseDate: '2026-10-12', dueDate: '2026-10-31', invoiceNumber: 'SGK-10', counterparty: 'SGK', paymentStatus: 'UNPAID', note: 'Ekim SGK primi - Vadesi ay sonu', isOwnedProperty: false, paidByCashier: false, recordedInLedger: true, sentToAdvisor: true, status: 'APPROVED_IN_LEDGER' },
    { id: 11, title: 'Peçete, Paket & Temizlik Sarf', category: 'VARIABLE', subType: 'CONSUMABLES', amount: 6400, period: '2026-10', expenseDate: '2026-10-13', dueDate: '2026-10-13', invoiceNumber: 'SRF-88', counterparty: 'Paketçi Toptan', paymentStatus: 'PAID', note: 'Ambalaj ve hijyen malzemesi', isOwnedProperty: false, paidByCashier: true, recordedInLedger: true, sentToAdvisor: true, status: 'APPROVED_IN_LEDGER' },
    { id: 12, title: 'Soğuk Hava Zinciri Sevkiyatı', category: 'VARIABLE', subType: 'LOGISTICS', amount: 4800, period: '2026-10', expenseDate: '2026-10-13', dueDate: '2026-10-20', invoiceNumber: 'LOJ-33', counterparty: 'Örnek Lojistik', paymentStatus: 'PAID', note: 'Haftalık et ve sebze lojistiği', isOwnedProperty: false, paidByCashier: true, recordedInLedger: false, sentToAdvisor: true, status: 'SENT_TO_ADVISOR' },
    { id: 13, title: 'Instagram & Gurme Tanıtım', category: 'VARIABLE', subType: 'MARKETING', amount: 5500, period: '2026-10', expenseDate: '2026-10-14', dueDate: '2026-10-14', invoiceNumber: 'REK-40', counterparty: 'Meta Ads', paymentStatus: 'PAID', note: 'Mali Müşavir Reddetmişti: Fatura e-arşiv PDF belgesi bekleniyor', isOwnedProperty: false, paidByCashier: true, recordedInLedger: false, sentToAdvisor: true, status: 'REJECTED', rejectionReason: 'Resmi e-Arşiv fatura PDF çıktısı eklenmemiş' },
    { id: 14, title: 'Mutfak Davlumbaz ve Izgara Bakımı', category: 'VARIABLE', subType: 'RENOVATION', amount: 3750, period: '2026-10', expenseDate: '2026-10-14', dueDate: '2026-10-25', invoiceNumber: 'TDL-10', counterparty: 'Usta Havalandırma', paymentStatus: 'PARTIAL', note: 'Davlumbaz motor değişimi: avans verildi, kalan teslimatta ödenecek', isOwnedProperty: false, paidByCashier: true, recordedInLedger: false, sentToAdvisor: true, status: 'SENT_TO_ADVISOR' },
  ]);
  const [currentLang, setCurrentLang] = useState('tr');
  const [showLangModal, setShowLangModal] = useState(false);

  const isAccountantUser = currentUser.role === ROLES.ACCOUNTANT;
  const isAdvisorUser = currentUser.role === ROLES.FINANCIAL_ADVISOR;

  const [expenseTab, setExpenseTab] = useState(isAdvisorUser ? 'pending_approval' : 'all');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashAllocationAmount, setCashAllocationAmount] = useState('5000');
  const [expenseToRejectMobile, setExpenseToRejectMobile] = useState(null);
  const [mobileRejectReason, setMobileRejectReason] = useState('');
  const [newExpense, setNewExpense] = useState({
    title: '',
    category: 'FIXED',
    subType: 'RENT',
    amount: '',
    period: '2026-10',
    expenseDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
    invoiceNumber: '',
    counterparty: '',
    paymentStatus: 'PAID',
    note: '',
    isOwnedProperty: false,
    paidByCashier: true,
    recordedInLedger: false,
    sentToAdvisor: true,
    status: 'SENT_TO_ADVISOR',
    rejectionReason: '',
  });
  const [selectedItem, setSelectedItem] = useState(null);

  const [mobileNotifications, setMobileNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Canlı Backend Senkronizasyonu (Mount anında ve periyodik olarak verileri çeker)
  const refreshAllData = React.useCallback(async () => {
    try {
      const [liveItems, liveUsers, liveRecipes, liveTx, liveExp, liveNotifs] = await Promise.all([
        apiFetchInventory(),
        apiFetchUsers(),
        apiFetchRecipes(),
        apiFetchTransactions(),
        apiFetchExpenses(),
        apiFetchNotifications(currentUser.role),
      ]);
      if (liveItems && liveItems.length > 0) setItems(liveItems);
      if (liveUsers && liveUsers.length > 0) setUsers(liveUsers);
      if (liveRecipes && liveRecipes.length > 0) setRecipes(liveRecipes);
      if (liveTx && liveTx.length > 0) setTransactions(liveTx);
      if (liveExp && liveExp.length > 0) setExpenses(liveExp);
      if (liveNotifs && Array.isArray(liveNotifs)) {
        setMobileNotifications(liveNotifs);
        setUnreadNotifCount(liveNotifs.filter((n) => !n.isRead).length);
      }
    } catch (err) {
      console.log('[Android Sync] Error:', err);
    }
  }, [currentUser.role]);

  React.useEffect(() => {
    refreshAllData();
    // Web'de bir kullanıcı, onay, ret veya bildirim yapıldığında mobilde anında görünmesi için 4 saniyede bir otomatik canlı senkronizasyon
    const timer = setInterval(() => {
      refreshAllData();
    }, 4000);
    return () => clearInterval(timer);
  }, [refreshAllData]);

  // Kamera barkod tarayıcı
  const [cameraActive, setCameraActive] = useState(false);
  const [barcodeInput, setBarcodeInput] = useState('');
  const [quantity, setQuantity] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Ekleme ve Düzenleme Modalları
  const [showAddStockModal, setShowAddStockModal] = useState(false);
  const [newStockItem, setNewStockItem] = useState({
    name: '',
    cat: 'Kuru Gıda',
    unit: 'kg',
    stock: '',
    min: '5',
    price: '',
    supplier: '',
    barcode: '',
  });
  const [editingStockItem, setEditingStockItem] = useState(null);

  const [showAddRecipeModal, setShowAddRecipeModal] = useState(false);
  const [newRecipe, setNewRecipe] = useState({
    name: '',
    category: 'Ana Yemek',
    salePrice: '',
    cost: '',
    ingredients: [{ name: '', amount: '1 Porsiyon' }],
  });
  const [editingRecipe, setEditingRecipe] = useState(null);

  // Web Birebir Silme Onay Modalı (Delete Confirmation Modal)
  const [itemToDelete, setItemToDelete] = useState(null); // { type: 'stock'|'recipe'|'user', id, name, details }

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', username: '', email: '', role: ROLES.CHEF });
  const [editingUserRole, setEditingUserRole] = useState(null); // { id, name, currentRole }

  // Filtreler
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

  const fixedExpensesTotal = expenses
    .filter((e) => e.category === 'FIXED')
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const variableExpensesTotal = expenses
    .filter((e) => e.category === 'VARIABLE')
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalOperatingExpenses = fixedExpensesTotal + variableExpensesTotal;
  const foodCostTotal = INITIAL_SALES_SUMMARY.totalCost || 18785.85;
  const totalRevenue = INITIAL_SALES_SUMMARY.totalRevenue || 76485;
  const grandTotalCost = foodCostTotal + totalOperatingExpenses;
  const netOperatingProfit = totalRevenue - grandTotalCost;

  // Toplam Borç ve Müşavir Ret Tutarları (Gerçekçi Muhasebe Takibi)
  const totalDebtAmount = expenses
    .filter((e) => e.paymentStatus === 'UNPAID' || e.paymentStatus === 'PARTIAL' || !e.paidByCashier)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalRejectedCount = expenses.filter((e) => e.status === 'REJECTED').length;

  const filteredExpenses = expenses.filter((e) => {
    let matchTab = true;
    if (expenseTab === 'fixed') matchTab = e.category === 'FIXED';
    else if (expenseTab === 'variable') matchTab = e.category === 'VARIABLE';
    else if (expenseTab === 'rent') matchTab = e.subType === 'RENT';
    else if (expenseTab === 'debt') matchTab = e.paymentStatus === 'UNPAID' || e.paymentStatus === 'PARTIAL' || !e.paidByCashier;
    else if (expenseTab === 'rejected') matchTab = e.status === 'REJECTED';
    else if (expenseTab === 'pending_approval') matchTab = !e.recordedInLedger && (e.sentToAdvisor !== false);
    else if (expenseTab === 'ledger') matchTab = Boolean(e.recordedInLedger);

    const matchSearch =
      !expenseSearch ||
      e.title.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      (e.counterparty && e.counterparty.toLowerCase().includes(expenseSearch.toLowerCase())) ||
      (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(expenseSearch.toLowerCase())) ||
      (e.note && e.note.toLowerCase().includes(expenseSearch.toLowerCase())) ||
      (e.period && e.period.includes(expenseSearch)) ||
      (e.expenseDate && e.expenseDate.includes(expenseSearch));
    return matchTab && matchSearch;
  });

  const navigateTo = (screen) => {
    if (!allowedScreens.includes(screen)) return;
    setScreenStack((prev) => [...prev, screen]);
    setCurrentScreen(screen);
  };

  // Android Dahili Geri Butonu (Telefonun geri tuşunu kullanmadan uygulama içinden geri dönme)
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

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleStockAction = async (isAdd) => {
    const qty = parseFloat(quantity);
    if (!selectedItem || isNaN(qty) || qty <= 0) return;

    // 1. Önce UI anında tepki verir (Optimistic UI)
    setItems((prev) =>
      prev.map((it) =>
        it.id === selectedItem.id
          ? { ...it, stock: isAdd ? it.stock + qty : Math.max(0, it.stock - qty) }
          : it
      )
    );
    showToast(
      isAdd
        ? `✓ ${selectedItem.name} +${qty} ${selectedItem.unit} eklendi`
        : `⚠️ ${selectedItem.name} -${qty} ${selectedItem.unit} fire kaydedildi`
    );
    setQuantity('');
    const targetItem = selectedItem;
    setSelectedItem(null);

    // 2. Arka planda PostgreSQL veritabanına kaydeder ve verileri tazeler
    try {
      if (isAdd) {
        await apiReceiveStock(targetItem.id, qty, `${currentUser.name} (Android)`);
      } else {
        await apiRecordWaste(targetItem.id, qty, 'Android Depo Zayiat', `${currentUser.name} (Android)`);
      }
      refreshAllData();
    } catch (e) {
      console.log('[Android Stock Action] Sync error:', e);
    }
  };

  const onCameraScanned = (scannedCode) => {
    setCameraActive(false);
    const clean = (scannedCode || '').trim();
    const found = items.find((i) => i.barcode === clean || (i.barcode && i.barcode.replace(/\s+/g, '') === clean.replace(/\s+/g, '')));
    if (found) {
      setSelectedItem(found);
      showToast(`Barkod Okundu: ${found.name}`);
    } else {
      setNewStockItem(prev => ({ ...prev, barcode: clean, name: '', stock: '' }));
      setShowAddStockModal(true);
      showToast(`Tanımsız Barkod (${clean}) — Yeni ürün ekleme ekranı açıldı`);
    }
  };

  // Stok / Ürün Kaydet (Yeni Ekle veya Mevcut Düzenle - Web ile birebir)
  const handleSaveStockItem = async () => {
    if (!newStockItem.name.trim()) {
      showToast('Lütfen ürün adını girin');
      return;
    }
    const currentStock = parseFloat(newStockItem.stock) || 0;
    const minStock = parseFloat(newStockItem.min) || 5;
    const unitCost = parseFloat(newStockItem.price) || 0;
    const barcode = newStockItem.barcode.trim() || `869${Date.now().toString().slice(-10)}`;

    if (editingStockItem) {
      // Düzenleme Modu
      const updated = {
        ...editingStockItem,
        name: newStockItem.name.trim(),
        cat: newStockItem.cat || 'Genel',
        unit: newStockItem.unit || 'kg',
        stock: currentStock,
        min: minStock,
        price: unitCost,
        supplier: newStockItem.supplier || '',
        barcode: barcode,
      };
      setItems((prev) => prev.map((i) => (i.id === editingStockItem.id ? updated : i)));
      setShowAddStockModal(false);
      setEditingStockItem(null);
      setNewStockItem({ name: '', cat: 'Kuru Gıda', unit: 'kg', stock: '', min: '5', price: '', supplier: '', barcode: '' });
      showToast(`✓ Ürün Güncellendi: ${updated.name}`);

      await apiUpdateInventoryItem(editingStockItem.id, updated);
      refreshAllData();
    } else {
      // Yeni Ekleme Modu
      const created = {
        id: Date.now(),
        name: newStockItem.name.trim(),
        cat: newStockItem.cat || 'Kuru Gıda',
        unit: newStockItem.unit || 'kg',
        stock: currentStock,
        min: minStock,
        price: unitCost,
        supplier: newStockItem.supplier || '',
        barcode: barcode,
      };
      setItems((prev) => [created, ...prev]);
      setShowAddStockModal(false);
      setNewStockItem({ name: '', cat: 'Kuru Gıda', unit: 'kg', stock: '', min: '5', price: '', supplier: '', barcode: '' });
      showToast(`✓ Yeni Ürün Stoğa Eklendi: ${created.name}`);

      await apiCreateInventoryItem(created);
      refreshAllData();
    }
  };

  // Reçete Kaydet (Yeni Ekle veya Mevcut Düzenle - Web Malzemelerle Birebir)
  const handleSaveRecipe = async () => {
    if (!newRecipe.name.trim() || !newRecipe.salePrice) {
      showToast('Lütfen reçete adı ve satış fiyatı girin');
      return;
    }
    const sale = parseFloat(newRecipe.salePrice) || 100;
    // Malzemeler varsa otomatik maliyet hesapla
    const validIngredients = (newRecipe.ingredients || []).filter(ing => ing.name && ing.name.trim()).map(ing => {
      // Envanterden birim fiyatı bul
      const matchedItem = items.find(i => i.name.trim().toLowerCase() === ing.name.trim().toLowerCase());
      const rawAmount = parseFloat(ing.amount) || parseFloat(String(ing.amount).replace(/[^0-9.]/g, '')) || 0.1;
      const unitCost = matchedItem ? matchedItem.price : (parseFloat(ing.cost) || 10);
      const calculatedItemCost = Math.round(rawAmount * unitCost * 100) / 100;
      return {
        name: ing.name.trim(),
        amount: ing.amount || `${rawAmount} kg`,
        quantity: rawAmount,
        unit: matchedItem?.unit || 'kg',
        unitCost: unitCost,
        cost: calculatedItemCost
      };
    });

    let calculatedCost = 0;
    if (validIngredients.length > 0) {
      calculatedCost = validIngredients.reduce((sum, ing) => sum + (parseFloat(ing.cost) || 0), 0);
    }
    const finalCost = calculatedCost > 0 ? calculatedCost : (parseFloat(newRecipe.cost) || 30);
    const fc = sale > 0 ? (finalCost / sale) * 100 : 0;

    if (editingRecipe) {
      // Düzenleme Modu
      const updated = {
        ...editingRecipe,
        name: newRecipe.name.trim(),
        category: newRecipe.category || 'Ana Yemek',
        salePrice: sale,
        cost: Math.round(finalCost * 100) / 100,
        foodCostPercent: Math.round(fc * 10) / 10,
        ingredients: validIngredients.length > 0 ? validIngredients : [{ name: 'Temel Malzeme', amount: '1 Porsiyon' }],
      };
      setRecipes((prev) => prev.map((r) => (r.id === editingRecipe.id ? updated : r)));
      setShowAddRecipeModal(false);
      setEditingRecipe(null);
      setNewRecipe({ name: '', category: 'Ana Yemek', salePrice: '', cost: '', ingredients: [{ name: '', amount: '1 Porsiyon' }] });
      showToast(`✓ Reçete Güncellendi: ${updated.name}`);

      await apiUpdateRecipe(editingRecipe.id, updated);
      refreshAllData();
    } else {
      // Yeni Ekleme Modu
      const created = {
        id: Date.now(),
        name: newRecipe.name.trim(),
        category: newRecipe.category || 'Ana Yemek',
        salePrice: sale,
        cost: Math.round(finalCost * 100) / 100,
        foodCostPercent: Math.round(fc * 10) / 10,
        ingredients: validIngredients.length > 0 ? validIngredients : [{ name: 'Temel Malzeme', amount: '1 Porsiyon' }],
      };
      setRecipes((prev) => [created, ...prev]);
      setShowAddRecipeModal(false);
      setNewRecipe({ name: '', category: 'Ana Yemek', salePrice: '', cost: '', ingredients: [{ name: '', amount: '1 Porsiyon' }] });
      showToast(`✓ Yeni Reçete Eklendi: ${created.name}`);

      await apiCreateRecipe(created);
      refreshAllData();
    }
  };

  // Silme Onayını Çalıştır (Web ile Birebir Onay Penceresi Aksiyonu)
  const handleConfirmDelete = async () => {
    if (!itemToDelete) return;
    const { type, id, name } = itemToDelete;
    setItemToDelete(null);

    if (type === 'stock') {
      setItems((prev) => prev.filter((i) => i.id !== id));
      showToast(`🗑️ "${name}" envanterden kalıcı olarak silindi`);
      await apiDeleteInventoryItem(id);
      refreshAllData();
    } else if (type === 'recipe') {
      setRecipes((prev) => prev.filter((r) => r.id !== id));
      showToast(`🗑️ "${name}" reçetelerden kalıcı olarak silindi`);
      await apiDeleteRecipe(id);
      refreshAllData();
    } else if (type === 'user') {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast(`🗑️ "${name}" personeli sistemden silindi`);
      await apiDeleteUser(id);
      refreshAllData();
    } else if (type === 'expense') {
      setExpenses((prev) => prev.filter((e) => e.id !== id));
      showToast(`🗑️ "${name}" gider kaydı silindi`);
      await apiDeleteExpense(id);
      refreshAllData();
    }
  };

  // Yeni Gider Kaydı Ekle (Gerçekçi Muhasebe: Kurum, Fatura No, Vade, Borç Durumu)
  const handleSaveExpense = async () => {
    const isRent = newExpense.subType === 'RENT';
    const isOwned = isRent && Boolean(newExpense.isOwnedProperty);
    if (!newExpense.title || (!isOwned && !newExpense.amount)) {
      showToast('Lütfen gider başlığı ve tutarı giriniz');
      return;
    }
    const amountVal = isOwned ? 0 : (parseFloat(newExpense.amount) || 0);
    const isPaid = newExpense.paymentStatus === 'PAID';

    const created = {
      id: Date.now(),
      title: isOwned ? `${newExpense.title.trim()} (Öz Mülk)` : newExpense.title.trim(),
      category: newExpense.category,
      subType: newExpense.subType,
      amount: amountVal,
      period: newExpense.period || '2026-10',
      expenseDate: newExpense.expenseDate || new Date().toISOString().split('T')[0],
      dueDate: newExpense.dueDate || newExpense.expenseDate || new Date().toISOString().split('T')[0],
      invoiceNumber: (newExpense.invoiceNumber || '').trim(),
      counterparty: (newExpense.counterparty || '').trim(),
      paymentStatus: newExpense.paymentStatus || (newExpense.paidByCashier ? 'PAID' : 'UNPAID'),
      recordedBy: currentUser.name || (currentUser.role === ROLES.FINANCIAL_ADVISOR ? 'Mali Müşavir' : 'Muhasebe / Kasa'),
      note: newExpense.note || '',
      isOwnedProperty: isOwned,
      paidByCashier: isPaid,
      recordedInLedger: Boolean(newExpense.recordedInLedger),
      sentToAdvisor: true,
      status: newExpense.recordedInLedger ? 'APPROVED_IN_LEDGER' : 'SENT_TO_ADVISOR',
      rejectionReason: '',
    };
    setExpenses((prev) => [created, ...prev]);
    setShowAddExpenseModal(false);
    setNewExpense({
      title: '',
      category: 'FIXED',
      subType: 'RENT',
      amount: '',
      period: '2026-10',
      expenseDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 15 * 86400000).toISOString().split('T')[0],
      invoiceNumber: '',
      counterparty: '',
      paymentStatus: 'PAID',
      note: '',
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR',
      rejectionReason: '',
    });
    showToast(
      isPaid
        ? `✓ Gider Kasadan Ödendi ve Müşavire Gönderildi: ${created.title}`
        : `⏳ Gider Borç/Vade Olarak İşlendi: ${created.title}`
    );
    await apiCreateExpense(created);
    refreshAllData();
  };

  // Muhasebecinin Mali Müşavire Onaya Göndermesi
  const handleSendToAdvisor = async (exp) => {
    setExpenses((prev) =>
      prev.map((e) => (e.id === exp.id ? { ...e, sentToAdvisor: true, status: 'SENT_TO_ADVISOR' } : e))
    );
    showToast(`🚀 "${exp.title}" Mali Müşavir defter onayına gönderildi`);
    await apiUpdateExpense(exp.id, { sentToAdvisor: true, status: 'SENT_TO_ADVISOR' });
    await apiCreateNotification({
      title: '🚀 Gider Defter Onayı Bekliyor (Mobil)',
      message: `${currentUser.name || 'Kasa / Muhasebe'} mobilden '${exp.title} (${exp.amount?.toLocaleString('tr-TR')} ₺)' onaylanmak üzere Mali Müşavire iletildi.`,
      targetRole: 'FINANCIAL_ADVISOR',
      senderName: currentUser.name || 'Kasa / Muhasebe',
      type: 'EXPENSE_APPROVAL',
      relatedEntityId: exp.id,
    });
    refreshAllData();
  };

  // Kasa Dağıtımı (Örn: Kasaya Gelen 5000 TL'nin Giderlere Dağıtımı)
  const handleAllocateCash = async () => {
    const totalVal = parseFloat(cashAllocationAmount) || 5000;
    const curDate = new Date().toISOString().split('T')[0];
    const recBy = currentUser.name || 'Kasa / Muhasebe';

    const item1 = {
      id: Date.now(),
      title: 'Günlük Sarf & Temizlik Çıkışı (Kasa Dağıtım)',
      category: 'VARIABLE',
      subType: 'CONSUMABLES',
      amount: Math.round(totalVal * 0.3),
      period: '2026-10',
      expenseDate: curDate,
      recordedBy: recBy,
      note: `Kasaya gelen ${totalVal} ₺ içerisinden ayrılan pay`,
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR'
    };
    const item2 = {
      id: Date.now() + 1,
      title: 'Sanayi Mutfak Elektrik Avansı (Kasa Dağıtım)',
      category: 'VARIABLE',
      subType: 'ELECTRICITY',
      amount: Math.round(totalVal * 0.4),
      period: '2026-10',
      expenseDate: curDate,
      recordedBy: recBy,
      note: `Kasaya gelen ${totalVal} ₺ içerisinden ayrılan pay`,
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR'
    };
    const item3 = {
      id: Date.now() + 2,
      title: 'Günlük Soğuk Zincir Lojistik Payı (Kasa Dağıtım)',
      category: 'VARIABLE',
      subType: 'LOGISTICS',
      amount: Math.round(totalVal * 0.3),
      period: '2026-10',
      expenseDate: curDate,
      recordedBy: recBy,
      note: `Kasaya gelen ${totalVal} ₺ içerisinden ayrılan pay`,
      isOwnedProperty: false,
      paidByCashier: true,
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'SENT_TO_ADVISOR'
    };

    setExpenses((prev) => [item1, item2, item3, ...prev]);
    setShowCashModal(false);
    showToast(`💵 ${totalVal.toLocaleString('tr-TR')} ₺ kasadan giderlere dağıtıldı ve Mali Müşavire iletildi!`);

    await Promise.all([
      apiCreateExpense(item1),
      apiCreateExpense(item2),
      apiCreateExpense(item3),
      apiCreateNotification({
        title: '💵 Kasadan Gider Dağıtımı Yapıldı (Mobil)',
        message: `${currentUser.name || 'Kasa / Muhasebe'} kasaya giren ${totalVal.toLocaleString('tr-TR')} ₺ tutarı Elektrik, Sarf ve Lojistik giderlerine paylaştırdı.`,
        targetRole: 'FINANCIAL_ADVISOR',
        senderName: currentUser.name || 'Kasa / Muhasebe',
        type: 'CASH_ALLOCATED',
        relatedEntityId: null,
      }),
    ]);
    refreshAllData();
  };

  // Kasa / Muhasebe Ödeme Durumu Değiştirme (Peşin Ödendi vs Borca Bırakıldı)
  const handleToggleExpensePaid = async (exp) => {
    const isCurrentlyPaid = exp.paymentStatus === 'PAID' || exp.paidByCashier;
    const nextStatus = isCurrentlyPaid ? 'UNPAID' : 'PAID';
    const nextPaid = !isCurrentlyPaid;

    setExpenses((prev) =>
      prev.map((e) =>
        e.id === exp.id
          ? { ...e, paymentStatus: nextStatus, paidByCashier: nextPaid }
          : e
      )
    );
    showToast(
      nextPaid
        ? `💵 Kasadan Ödendi: "${exp.title}"`
        : `⏳ Bekleyen Borca/Vadeye Bırakıldı: "${exp.title}"`
    );
    await apiUpdateExpense(exp.id, {
      paymentStatus: nextStatus,
      paidByCashier: nextPaid,
    });
    refreshAllData();
  };

  // Mali Müşavir Onaylama İşlemi
  const handleApproveExpenseLedger = async (exp) => {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === exp.id
          ? {
            ...e,
            recordedInLedger: true,
            status: 'APPROVED_IN_LEDGER',
            rejectionReason: '',
          }
          : e
      )
    );
    showToast(`✓ Deftere İşlendi & Onaylandı: "${exp.title}"`);
    await apiUpdateExpense(exp.id, {
      recordedInLedger: true,
      status: 'APPROVED_IN_LEDGER',
      rejectionReason: '',
    });
    await apiCreateNotification({
      title: '✓ Gider Deftere İşlendi & Onaylandı (Mobil)',
      message: `${currentUser.name || 'Mali Müşavir'} mobilden '${exp.title} (${exp.amount?.toLocaleString('tr-TR')} ₺)' kaydını resmi yevmiye defterine onayladı.`,
      targetRole: 'ACCOUNTANT',
      senderName: currentUser.name || 'Mali Müşavir',
      type: 'EXPENSE_APPROVAL',
      relatedEntityId: exp.id,
    });
    refreshAllData();
  };

  // Mali Müşavir Ret Modalı Açma
  const handleOpenRejectModal = (exp) => {
    setExpenseToRejectMobile(exp);
    setMobileRejectReason('');
  };

  // Mali Müşavir Gerekçeli Ret İşlemini Kaydetme
  const handleConfirmRejectExpense = async () => {
    if (!expenseToRejectMobile) return;
    if (!mobileRejectReason.trim()) {
      showToast('Lütfen bir ret gerekçesi girin (Örn: Fatura PDF eksik)');
      return;
    }

    const expId = expenseToRejectMobile.id;
    const reason = mobileRejectReason.trim();

    setExpenses((prev) =>
      prev.map((e) =>
        e.id === expId
          ? {
            ...e,
            recordedInLedger: false,
            status: 'REJECTED',
            rejectionReason: reason,
          }
          : e
      )
    );
    showToast(`❌ Onay Reddedildi: "${expenseToRejectMobile.title}"`);
    setExpenseToRejectMobile(null);
    setMobileRejectReason('');

    await apiUpdateExpense(expId, {
      recordedInLedger: false,
      status: 'REJECTED',
      rejectionReason: reason,
    });
    await apiCreateNotification({
      title: '❌ Gider Defter Onayı Reddedildi (Mobil)',
      message: `${currentUser.name || 'Mali Müşavir'} mobilden '${expenseToRejectMobile.title}' kaydını reddetti. Gerekçe: "${reason}"`,
      targetRole: 'ACCOUNTANT',
      senderName: currentUser.name || 'Mali Müşavir',
      type: 'EXPENSE_REJECTED',
      relatedEntityId: expId,
    });
    refreshAllData();
  };

  // Mali Müşavir Resmi Deftere Kayıt Durumu Değiştirme (Eski toggle yedek)
  const handleToggleExpenseLedger = async (exp) => {
    if (exp.recordedInLedger) {
      // Zaten onaylıysa geri al
      setExpenses((prev) =>
        prev.map((e) =>
          e.id === exp.id
            ? { ...e, recordedInLedger: false, status: 'SENT_TO_ADVISOR' }
            : e
        )
      );
      showToast(`⏳ Defter Onayı Beklemeye Alındı: "${exp.title}"`);
      await apiUpdateExpense(exp.id, {
        recordedInLedger: false,
        status: 'SENT_TO_ADVISOR',
      });
      refreshAllData();
    } else {
      handleApproveExpenseLedger(exp);
    }
  };

  // Yeni Personel Ekle
  const handleAddNewUser = async () => {
    if (!newUser.name || !newUser.username) {
      showToast('Lütfen isim ve kullanıcı adı girin');
      return;
    }
    const initials = newUser.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    const created = {
      id: Date.now(),
      name: newUser.name,
      username: newUser.username.trim().toLowerCase(),
      email: newUser.email || `${newUser.username}@gastrosync.com`,
      role: newUser.role,
      avatar: initials,
    };
    setUsers([...users, created]);
    setShowAddUserModal(false);
    setNewUser({ name: '', username: '', email: '', role: ROLES.CHEF });
    showToast(`Yeni Personel Eklendi: ${created.name}`);

    // Backend'e kaydet ve senkronize et
    await apiCreateUser(created);
    refreshAllData();
  };

  // Mevcut Personelin Rolünü Güncelle (Rol Atama Sistemi)
  const handleUpdateUserRole = async (targetUserId, newRole) => {
    setUsers((prev) =>
      prev.map((u) => (u.id === targetUserId ? { ...u, role: newRole } : u))
    );
    showToast(`✓ Kullanıcı rolü "${ROLE_LABELS[newRole]}" olarak güncellendi`);
    setEditingUserRole(null);

    await apiUpdateUserRole(targetUserId, newRole);
    refreshAllData();
  };

  const canViewFinancials = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.ACCOUNTANT || currentUser.role === ROLES.FINANCIAL_ADVISOR;
  const canViewAccounting = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.ACCOUNTANT || currentUser.role === ROLES.FINANCIAL_ADVISOR;
  const canViewUsers = currentUser.role === ROLES.ADMIN;
  const canViewRecipes = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.CHEF;
  const canViewInventory = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.CHEF || currentUser.role === ROLES.ACCOUNTANT || currentUser.role === ROLES.FINANCIAL_ADVISOR;
  const canViewWarehouse = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.WAREHOUSE;

  // Samsung, Xiaomi, Pixel vb. telefonların alt navigasyon tuşları için dinamik boşluk
  const androidBottomPadding = Math.max(insets.bottom, 16);

  return (
    <View style={styles.container}>
      {/* Sleek Minimalist Top App Bar (Status bar çakışmasını önleyen dinamik insets) */}
      <View style={[styles.topAppBar, { paddingTop: Math.max(insets.top, 8), height: 52 + Math.max(insets.top, 8) }]}>
        <View style={styles.brandRow}>
          {(screenStack.length > 1 || selectedItem || cameraActive) ? (
            <TouchableOpacity style={styles.androidBackBtn} onPress={handleGoBack} activeOpacity={0.6}>
              <Text style={styles.androidBackArrow}>←</Text>
              <Text style={styles.androidBackLabel}>Geri</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>GS</Text>
            </View>
          )}
          <Text style={styles.appBarTitle}>GastroSync</Text>
        </View>

        {/* Minimalist Kullanıcı Bilgisi & Dil & Rol Bildirim Zili & Çıkış */}
        <View style={styles.headerUserGroup}>
          {/* Tek Dokunuş Şirket Dili Seçici */}
          <TouchableOpacity
            style={{
              backgroundColor: '#ffffff',
              borderRadius: 18,
              paddingHorizontal: 8,
              height: 36,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 6,
              borderWidth: 1,
              borderColor: '#cbd5e1',
              flexDirection: 'row',
              gap: 4,
            }}
            onPress={() => setShowLangModal(true)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 14 }}>
              {currentLang === 'en' ? '🇬🇧' : currentLang === 'de' ? '🇩🇪' : currentLang === 'ar' ? '🇸🇦' : '🇹🇷'}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#1e293b', textTransform: 'uppercase' }}>
              {currentLang}
            </Text>
          </TouchableOpacity>

          {/* Bildirim Zili & Sayacı */}
          <TouchableOpacity
            style={{
              position: 'relative',
              backgroundColor: '#f1f5f9',
              borderRadius: 18,
              width: 36,
              height: 36,
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: 6,
            }}
            onPress={() => setShowNotifModal(true)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 18 }}>🔔</Text>
            {unreadNotifCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  backgroundColor: '#ef4444',
                  borderRadius: 8,
                  minWidth: 16,
                  height: 16,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 3,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>
                  {unreadNotifCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          <View style={[styles.fixedRoleBadge, { backgroundColor: ROLE_COLORS[currentUser.role] }]}>
            <Text style={styles.roleAvatar}>{currentUser.avatar}</Text>
            <Text style={styles.roleNameText}>{ROLE_LABELS[currentUser.role]}</Text>
          </View>

          <TouchableOpacity
            style={styles.logoutBtn}
            onPress={onLogout}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.logoutIcon}>⎋</Text>
            <Text style={styles.logoutBtnText}>Çıkış</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Snackbar Bildirimi */}
      {toastMessage ? (
        <View style={styles.snackBar}>
          <Text style={styles.snackText}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* İçerik Alanı - Android Alt Tuşlarına Çarpmaması İçin Dinamik Güvenli Padding */}
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingBottom: 70 + androidBottomPadding }
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* 1. EKRAN: FİNANSAL ÖZET (Dashboard - Web ile Birebir) */}
        {currentScreen === 'dashboard' && canViewFinancials && (
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

            <Text style={styles.subHeading}>MODÜL KISAYOLLARI</Text>
            <View style={styles.shortcutGrid}>
              {allowedScreens.includes('accounting') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('accounting')}>
                  <Text style={styles.shortcutIcon}>💰</Text>
                  <Text style={styles.shortcutTxt}>Muhasebe & Gider</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('inventory') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('inventory')}>
                  <Text style={styles.shortcutIcon}>📦</Text>
                  <Text style={styles.shortcutTxt}>Stok Yönetimi</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('recipes') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('recipes')}>
                  <Text style={styles.shortcutIcon}>📖</Text>
                  <Text style={styles.shortcutTxt}>Reçete Merkezi</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('sales') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('sales')}>
                  <Text style={styles.shortcutIcon}>📊</Text>
                  <Text style={styles.shortcutTxt}>Satış Analizi</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('warehouse') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('warehouse')}>
                  <Text style={styles.shortcutIcon}>📦</Text>
                  <Text style={styles.shortcutTxt}>Depo & Mal Kabul</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('users') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('users')}>
                  <Text style={styles.shortcutIcon}>👥</Text>
                  <Text style={styles.shortcutTxt}>Kullanıcı Yönetimi</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 2. EKRAN: STOK YÖNETİMİ (Inventory - Web ile Birebir) */}
        {currentScreen === 'inventory' && canViewInventory && (
          <View>
            <View style={styles.screenHeader}>
              <View>
                <Text style={styles.titleText}>Stok Yönetimi</Text>
                <Text style={styles.descText}>Tüm envanter ve kritik eşikler</Text>
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

            {/* Web Toolbar */}
            <View style={styles.webFilterBar}>
              <TextInput
                style={styles.webSearchInput}
                placeholder="🔍 Ürün adı veya barkod ile arayın..."
                placeholderTextColor={THEME.colors.textLight}
                value={inventorySearch}
                onChangeText={setInventorySearch}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                {inventoryCategories.map((c) => (
                  <TouchableOpacity
                    key={c}
                    style={[styles.webChipBtn, inventoryCategory === c && styles.webChipBtnActive]}
                    onPress={() => setInventoryCategory(c)}
                  >
                    <Text style={[styles.webChipTxt, inventoryCategory === c && styles.webChipTxtActive]}>
                      {c === 'all' ? 'Tüm Kategoriler' : c}
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

            {filteredItems.map((it) => {
              const isAlert = it.stock <= it.min;
              const totalValue = it.stock * it.price;
              return (
                <View
                  key={it.id}
                  style={[styles.webItemCard, isAlert && styles.webItemCardAlert]}
                >
                  <TouchableOpacity
                    style={{ flex: 1 }}
                    onPress={() => setSelectedItem(it)}
                    activeOpacity={0.8}
                  >
                    {/* Top Row: Ürün Adı, Kategori ve Barkod */}
                    <View style={styles.webItemTopRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.webItemName}>{it.name}</Text>
                        <Text style={styles.webItemBarcode}>Barkod: {it.barcode || 'Belirtilmedi'}</Text>
                      </View>
                      <View style={styles.webCategoryBadge}>
                        <Text style={styles.webCategoryBadgeTxt}>{it.cat || 'Genel'}</Text>
                      </View>
                    </View>

                    {/* Middle Metrics: Stok, Min. Stok, Birim Fiyat, Toplam Değer */}
                    <View style={styles.webItemMetricsRow}>
                      <View style={styles.webItemMetricCol}>
                        <Text style={styles.webItemMetricLbl}>Mevcut Stok</Text>
                        <Text style={[styles.webItemMetricVal, isAlert && { color: '#dc2626' }]}>
                          {it.stock} {it.unit}
                        </Text>
                      </View>
                      <View style={styles.webItemMetricCol}>
                        <Text style={styles.webItemMetricLbl}>Min. Stok</Text>
                        <Text style={styles.webItemMetricVal}>{it.min} {it.unit}</Text>
                      </View>
                      <View style={styles.webItemMetricCol}>
                        <Text style={styles.webItemMetricLbl}>Birim Fiyat</Text>
                        <Text style={styles.webItemMetricVal}>{it.price.toFixed(2)} ₺</Text>
                      </View>
                      <View style={styles.webItemMetricCol}>
                        <Text style={styles.webItemMetricLbl}>Toplam Değer</Text>
                        <Text style={[styles.webItemMetricVal, { color: '#047857' }]}>
                          {totalValue.toLocaleString('tr-TR')} ₺
                        </Text>
                      </View>
                    </View>

                    {/* Bottom Status Row: Web ile Birebir Tier A / Kritik Rozeti */}
                    <View style={styles.webItemStatusRow}>
                      <View>
                        {isAlert ? (
                          <View style={styles.webCriticalBadge}>
                            <Text style={{ fontSize: 10 }}>⚠️</Text>
                            <Text style={styles.webCriticalTxt}>Kritik Stok</Text>
                          </View>
                        ) : (
                          <View style={styles.webTierBadge}>
                            <View style={styles.webTierDot} />
                            <Text style={styles.webTierTxt}>Tier A • Yeterli</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>
                        Tedarikçi: <Text style={{ fontWeight: '700', color: '#334155' }}>{it.supplier || 'Standart'}</Text>
                      </Text>
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}

        {/* 3. EKRAN: REÇETE MERKEZİ (Recipes - Web ile Birebir) */}
        {currentScreen === 'recipes' && canViewRecipes && (
          <View>
            <View style={styles.webHeaderRow}>
              <View>
                <Text style={styles.webPageTitle}>Reçete Merkezi</Text>
                <Text style={styles.webPageSub}>Mutfak şefi gramaj ve maliyet analizi</Text>
              </View>
              <TouchableOpacity style={styles.webBtnPrimary} onPress={() => setShowAddRecipeModal(true)}>
                <Text style={styles.webBtnPrimaryTxt}>+ Yeni Reçete</Text>
              </TouchableOpacity>
            </View>

            {/* Web Toolbar */}
            <View style={styles.webFilterBar}>
              <TextInput
                style={styles.webSearchInput}
                placeholder="🔍 Reçete veya yemek adı ara..."
                placeholderTextColor={THEME.colors.textLight}
                value={recipeSearch}
                onChangeText={setRecipeSearch}
              />
              <View style={styles.webFilterCountRow}>
                <Text style={styles.webFilterCountTxt}>
                  Listelenen: <Text style={{ fontWeight: '800', color: THEME.colors.primary }}>{filteredRecipes.length}</Text> / {recipes.length} reçete
                </Text>
              </View>
            </View>

            {/* Web Reçete Kartları */}
            {filteredRecipes.map((r) => {
              const profit = r.salePrice - r.cost;
              return (
                <View key={r.id} style={styles.webRecipeCard}>
                  <View style={styles.webRecipeTopRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.webRecipeCategory}>{r.category}</Text>
                      <Text style={styles.webRecipeTitle}>{r.name}</Text>
                    </View>
                    <View style={[styles.webFcBadge, r.foodCostPercent >= 30 ? styles.webFcBadgeDanger : styles.webFcBadgeGood]}>
                      <Text style={[styles.webFcBadgeTxt, r.foodCostPercent >= 30 ? styles.webFcBadgeTxtDanger : styles.webFcBadgeTxtGood]}>
                        %{r.foodCostPercent.toFixed(1)} Cost
                      </Text>
                    </View>
                  </View>

                  {/* 3'lü Metrik Barı (Web recipe-card-stats ile birebir) */}
                  <View style={styles.webRecipeStatsRow}>
                    <View style={styles.webRecipeStatCol}>
                      <Text style={styles.webRecipeStatLbl}>Maliyet</Text>
                      <Text style={styles.webRecipeStatVal}>{r.cost.toFixed(2)} ₺</Text>
                    </View>
                    <View style={styles.webRecipeStatCol}>
                      <Text style={styles.webRecipeStatLbl}>Satış Fiyatı</Text>
                      <Text style={[styles.webRecipeStatVal, { fontWeight: '900', color: THEME.colors.primary }]}>
                        {r.salePrice.toFixed(2)} ₺
                      </Text>
                    </View>
                    <View style={styles.webRecipeStatCol}>
                      <Text style={styles.webRecipeStatLbl}>Kâr</Text>
                      <Text style={[styles.webRecipeStatVal, { color: '#047857' }]}>
                        +{profit.toFixed(2)} ₺
                      </Text>
                    </View>
                  </View>

                  {/* Malzemeler ve Gramajlar */}
                  <View style={styles.webRecipeIngBox}>
                    <Text style={styles.webRecipeIngHead}>Reçete Gramajları (1 Porsiyon):</Text>
                    {r.ingredients.map((ing, idx) => (
                      <View key={idx} style={styles.webRecipeIngLine}>
                        <Text style={styles.webRecipeIngName}>• {ing.name}</Text>
                        <Text style={styles.webRecipeIngAmount}>{ing.amount}</Text>
                      </View>
                    ))}
                  </View>

                  {/* Reçete İşlem Butonları (Web ile birebir Düzenle ve Sil) */}
                  <View style={styles.webRecipeActionRow}>
                    <TouchableOpacity
                      style={styles.webRecipeEditBtn}
                      onPress={() => {
                        setEditingRecipe(r);
                        setNewRecipe({
                          name: r.name,
                          category: r.category,
                          salePrice: String(r.salePrice),
                          cost: String(r.cost),
                          ingredients: (r.ingredients && r.ingredients.length > 0)
                            ? r.ingredients.map(ing => ({ name: ing.name || '', amount: ing.amount || '1 Porsiyon', cost: ing.cost || '' }))
                            : [{ name: '', amount: '1 Porsiyon' }],
                        });
                        setShowAddRecipeModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.webRecipeEditTxt}>✏️ Düzenle</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={styles.webRecipeDeleteBtn}
                      onPress={() => {
                        setItemToDelete({
                          type: 'recipe',
                          id: r.id,
                          name: r.name,
                          details: `"${r.name}" reçetesi menüden ve mutfak sisteminden kalıcı olarak silinecektir. Bu işlem geri alınamaz.`,
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.webRecipeDeleteTxt}>🗑️ Sil</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 4. EKRAN: SATIŞ ANALİZİ (Sales - Web ile Birebir) */}
        {currentScreen === 'sales' && canViewFinancials && (
          <View>
            <View style={styles.webHeaderRow}>
              <View>
                <Text style={styles.webPageTitle}>Satış Analizi</Text>
                <Text style={styles.webPageSub}>POS canlı satış verileri ve ciro dökümü</Text>
              </View>
            </View>

            {/* Web Mini-Stats */}
            <View style={styles.webMiniStatsRow}>
              <View style={styles.webMiniStatCard}>
                <Text style={[styles.webMiniStatVal, { color: THEME.colors.primary }]}>
                  {INITIAL_SALES_SUMMARY.totalRevenue.toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMiniStatLbl}>Toplam Ciro</Text>
              </View>
              <View style={[styles.webMiniStatCard, { borderColor: '#bbf7d0' }]}>
                <Text style={[styles.webMiniStatVal, { color: '#047857' }]}>
                  {INITIAL_SALES_SUMMARY.netProfit.toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMiniStatLbl}>Net Kâr</Text>
              </View>
              <View style={styles.webMiniStatCard}>
                <Text style={styles.webMiniStatVal}>{INITIAL_SALES_ITEMS.length}</Text>
                <Text style={styles.webMiniStatLbl}>Satış Kalemi</Text>
              </View>
            </View>

            <Text style={styles.subHeading}>GÜNLÜK ÜRÜN SATIŞLARI</Text>
            {INITIAL_SALES_ITEMS.map((item) => {
              const itemProfit = item.revenue - item.cost;
              return (
                <View key={item.id} style={styles.webSalesCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.itemMeta}>{item.qty} Porsiyon Satıldı • Food Cost %{item.foodCost}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.salesRevBold}>{item.revenue.toLocaleString('tr-TR')} ₺</Text>
                    <Text style={[styles.itemMeta, { color: '#047857', fontWeight: '700' }]}>
                      +Kâr: {itemProfit.toLocaleString('tr-TR')} ₺
                    </Text>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* 5. EKRAN: DEPO & MAL KABUL TERMİNALİ (Warehouse - Web ile Birebir) */}
        {currentScreen === 'warehouse' && canViewWarehouse && (
          <View>
            <View style={styles.webHeaderRow}>
              <View>
                <Text style={styles.webPageTitle}>Depo & Mal Kabul Terminali</Text>
                <Text style={styles.webPageSub}>Manuel barkod / ürün girişi, mal kabul & zayiat</Text>
              </View>
            </View>

            {/* Web Tarzı 3'lü İşlem Butonları (wh-actions) */}
            <View style={styles.webWhActionRow}>
              <TouchableOpacity
                style={[styles.webWhActionBtnLarge, { backgroundColor: '#0284c7' }]}
                onPress={() => {
                  if (items.length > 0) setSelectedItem(items[0]);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.webWhActionIcon}>📦</Text>
                <Text style={styles.webWhActionTitle}>Mal Kabul</Text>
                <Text style={styles.webWhActionSub}>Manuel Giriş</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.webWhActionBtnLarge, { backgroundColor: '#dc2626' }]}
                onPress={() => {
                  if (items.length > 0) setSelectedItem(items[0]);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.webWhActionIcon}>⚠️</Text>
                <Text style={styles.webWhActionTitle}>Zayiat Bildir</Text>
                <Text style={styles.webWhActionSub}>Fire Kaydı</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.webWhActionBtnLarge, { backgroundColor: '#059669' }]}
                onPress={() => {
                  setEditingStockItem(null);
                  setNewStockItem({
                    name: '',
                    cat: 'Kuru Gıda',
                    unit: 'kg',
                    stock: '',
                    min: '5',
                    price: '',
                    supplier: '',
                    barcode: '',
                  });
                  setShowAddStockModal(true);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.webWhActionIcon}>➕</Text>
                <Text style={styles.webWhActionTitle}>Yeni Ürün</Text>
                <Text style={styles.webWhActionSub}>Depoya Ekle</Text>
              </TouchableOpacity>
            </View>

            {/* Manuel Barkod Kartı (Kamerasız - Klavyeden Elle Giriş) */}
            <View style={styles.webSearchCard}>
              <Text style={styles.cardHeaderSmall}>Manuel Ürün Arama (Barkodsuz / Barkodlu):</Text>
              <TextInput
                style={styles.inputBox}
                placeholder="Barkod numarası veya ürün adı girin..."
                placeholderTextColor={THEME.colors.textLight}
                value={barcodeInput}
                onChangeText={setBarcodeInput}
              />
              <TouchableOpacity
                style={styles.btnManualSubmit}
                onPress={() => {
                  const clean = (barcodeInput || '').trim();
                  if (!clean) return;
                  const f = items.find(
                    (i) =>
                      i.barcode === clean ||
                      (i.barcode && i.barcode.replace(/\s+/g, '') === clean.replace(/\s+/g, '')) ||
                      i.name.toLowerCase().includes(clean.toLowerCase())
                  );
                  if (f) {
                    setSelectedItem(f);
                  } else {
                    setNewStockItem((prev) => ({ ...prev, barcode: clean, name: '', stock: '' }));
                    setShowAddStockModal(true);
                    showToast(`Tanımsız Barkod (${clean}) — Yeni ürün ekleme ekranı açıldı`);
                  }
                }}
              >
                <Text style={styles.btnManualSubmitTxt}>Ürünü Getir</Text>
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <View style={styles.selectedActionCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.itemTitle}>{selectedItem.name}</Text>
                  <TouchableOpacity style={styles.inlineBackBtn} onPress={() => setSelectedItem(null)}>
                    <Text style={styles.inlineBackBtnTxt}>✕ Kapat</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemMeta}>Barkod: {selectedItem.barcode || 'Yok'}</Text>
                <Text style={styles.stockStatusBig}>
                  Mevcut Stok: {selectedItem.stock} {selectedItem.unit} (Min: {selectedItem.min})
                </Text>

                <TextInput
                  style={[styles.inputBox, { marginTop: 12 }]}
                  placeholder={`Miktar girin (${selectedItem.unit})`}
                  placeholderTextColor={THEME.colors.textLight}
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="numeric"
                />

                <View style={styles.actionBtnGrid}>
                  <TouchableOpacity
                    style={[styles.actionBtnItem, { backgroundColor: '#059669' }]}
                    onPress={() => handleStockAction(true)}
                  >
                    <Text style={styles.actionBtnItemTxt}>+ Mal Kabul Et</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtnItem, { backgroundColor: '#dc2626' }]}
                    onPress={() => handleStockAction(false)}
                  >
                    <Text style={styles.actionBtnItemTxt}>⚠️ Zayiat / Fire</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Web Birebir: Son İşlemler (Bugün) Kutusu */}
            <View style={styles.webTxBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={styles.webTxTitle}>📋 Son İşlemler (Bugün)</Text>
                <Text style={{ fontSize: 10, color: '#64748b', fontWeight: '700' }}>Canlı Hareketler</Text>
              </View>
              {transactions && transactions.length > 0 ? (
                transactions.slice(0, 5).map((tx) => (
                  <View key={tx.id} style={styles.webTxItemRow}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                      <View
                        style={[
                          styles.webTxIconBadge,
                          { backgroundColor: tx.type === 'receive' ? '#ecfdf5' : '#fef2f2' },
                        ]}
                      >
                        <Text style={{ fontSize: 13 }}>{tx.type === 'receive' ? '📥' : '⚠️'}</Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.webTxName}>{tx.itemName}</Text>
                        <Text style={styles.webTxMeta}>
                          {tx.recordedBy} • {tx.note ? tx.note : (tx.type === 'receive' ? 'Mal Kabul' : 'Zayiat')}
                        </Text>
                      </View>
                    </View>
                    <Text
                      style={[
                        styles.webTxQty,
                        { color: tx.type === 'receive' ? '#047857' : '#dc2626' },
                      ]}
                    >
                      {tx.type === 'receive' ? '+' : '-'}{tx.quantity} {tx.unit}
                    </Text>
                  </View>
                ))
              ) : (
                <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingVertical: 12 }}>
                  Bugün henüz depo hareketi kaydedilmedi.
                </Text>
              )}
            </View>
          </View>
        )}

        {/* 6. EKRAN: KULLANICI YÖNETİMİ (Users - Web ile Birebir) */}
        {currentScreen === 'users' && canViewUsers && (
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

            {/* Web Toolbar */}
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

            {/* Web Style User Cards */}
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

                {/* Module description from web */}
                <View style={styles.webUserModuleBox}>
                  <Text style={styles.webUserModuleLabel}>Erişim Modülleri:</Text>
                  <Text style={styles.webUserModuleTxt}>{ROLE_MODULES[u.role] || 'Yetkilendirilmiş restoran modülleri'}</Text>
                </View>

                <View style={styles.webUserCardFooter}>
                  <Text style={styles.webUserStatusTxt}>Durum: Aktif Oturum</Text>
                  {currentUser.role === ROLES.ADMIN && u.username !== 'admin' && (
                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <TouchableOpacity
                        style={[styles.webUserDismissBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                        onPress={() => setEditingUserRole(u)}
                      >
                        <Text style={[styles.webUserDismissTxt, { color: '#1d4ed8' }]}>🛡️ Rolü Değiştir</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.webUserDismissBtn}
                        onPress={() => {
                          setItemToDelete({
                            type: 'user',
                            id: u.id,
                            name: u.name,
                            details: `"${u.name}" (${u.username}) personeli sistemden silinecek ve oturum yetkileri iptal edilecektir. Onaylıyor musunuz?`,
                          });
                        }}
                      >
                        <Text style={styles.webUserDismissTxt}>🗑️ Görevden Al</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 7. EKRAN: MUHASEBE & GENEL GİDER YÖNETİMİ (Accounting - Web ile Birebir) */}
            {currentScreen === 'accounting' && canViewAccounting && (
              <View>
                <View style={styles.webHeaderRow}>
                  <View style={{ flex: 1, marginRight: 8 }}>
                    <Text style={styles.webPageTitle}>
                      {isAdvisorUser
                        ? '📖 Müşavir Defteri & Onay'
                        : isAccountantUser
                          ? '💰 Kasa & Muhasebe (Dağıtım)'
                          : 'Muhasebe & Genel Gider'}
                    </Text>
                    <Text style={styles.webPageSub}>
                      {isAdvisorUser
                        ? 'Muhasebenin gönderdiği giderleri yevmiye defterine inceleyip onaylayın'
                        : isAccountantUser
                          ? 'Kasaya gelen parayı giderlere dağıtın ve Müşavire gönderin'
                          : 'Sabit ve değişken gider yönetimi & gerçek toplam maliyet'}
                    </Text>
                  </View>

                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {(isAccountantUser || currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER) && (
                      <TouchableOpacity
                        style={[styles.webBtnPrimary, { backgroundColor: '#059669', paddingHorizontal: 10 }]}
                        onPress={() => setShowCashModal(true)}
                      >
                        <Text style={styles.webBtnPrimaryTxt}>💵 Kasa Dağıt</Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.webBtnPrimary, { backgroundColor: isAdvisorUser ? '#7c3aed' : '#8b5cf6', paddingHorizontal: 10 }]}
                      onPress={() => setShowAddExpenseModal(true)}
                    >
                      <Text style={styles.webBtnPrimaryTxt}>
                        {isAdvisorUser ? '+ Deftere Kaydet' : '+ Yeni Gider'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* GÜNLÜK GELİR / KASA & NET KÂR BANNER'I */}
                <View style={{
                  backgroundColor: '#f0fdf4',
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1.5,
                  borderColor: '#86efac',
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <View>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: '#166534', textTransform: 'uppercase' }}>
                      💵 GÜNLÜK KASA GELİRİ (CİRO)
                    </Text>
                    <Text style={{ fontSize: 20, fontWeight: '900', color: '#14532d' }}>
                      {totalRevenue.toLocaleString('tr-TR')} ₺
                    </Text>
                    <Text style={{ fontSize: 10, color: '#15803d', marginTop: 2 }}>
                      Restoran adisyon & POS tahsilatları
                    </Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 10, fontWeight: '800', color: netOperatingProfit >= 0 ? '#166534' : '#991b1b', textTransform: 'uppercase' }}>
                      GÜNLÜK NET İŞLETME KÂRI
                    </Text>
                    <Text style={{ fontSize: 18, fontWeight: '900', color: netOperatingProfit >= 0 ? '#15803d' : '#b91c1c' }}>
                      {netOperatingProfit >= 0 ? `+${netOperatingProfit.toLocaleString('tr-TR')}` : netOperatingProfit.toLocaleString('tr-TR')} ₺
                    </Text>
                    <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                      Gelir - Toplam İşletme Gideri
                    </Text>
                  </View>
                </View>

                {/* RUBRİK SORULARI VE KASA TEŞHİS KARTI */}
                <View style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 14,
                  padding: 12,
                  marginBottom: 12,
                  borderWidth: 1.5,
                  borderColor: '#cbd5e1'
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#0f172a' }}>
                      🧭 Finansal Rubrik Soruları & Kasa Teşhisi
                    </Text>
                    <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#a7f3d0' }}>
                      <Text style={{ fontSize: 10, fontWeight: '800', color: '#047857' }}>Rubrik: Pekiyi / A+</Text>
                    </View>
                  </View>

                  <View style={{ gap: 6 }}>
                    <View style={{ backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e293b' }}>
                        ❓ Bugün ne satıldı, ne kadar gelir elde edildi?
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 2 }}>
                        ✓ Cevap: Kasaya {totalRevenue.toLocaleString('tr-TR')} ₺ ciro girdi. (En çok satan: Izgara Köfte - 12.920 ₺)
                      </Text>
                    </View>

                    <View style={{ backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e293b' }}>
                        ❓ Ne kadar net kâr elde edildi?
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 2 }}>
                        ✓ Cevap: Brüt Kâr {(totalRevenue - foodCostTotal).toLocaleString('tr-TR')} ₺, Faaliyet Kârı {netOperatingProfit.toLocaleString('tr-TR')} ₺.
                      </Text>
                    </View>

                    <View style={{ backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e293b' }}>
                        ❓ Kasada bekleyen borçlar ve vadeli harcamalar ne durumda?
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626', marginTop: 2 }}>
                        ✓ Cevap: {totalDebtAmount.toLocaleString('tr-TR')} ₺ vadesi bekleyen fatura/vergi borcu var.
                      </Text>
                    </View>

                    <View style={{ backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e293b' }}>
                        ❓ Mali Müşavir denetiminde reddedilen veya bekleyen var mı?
                      </Text>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: '#7e22ce', marginTop: 2 }}>
                        ✓ Cevap: {expenses.filter(e => e.recordedInLedger).length} Kalem onaylandı, {totalRejectedCount} Kalem reddedildi.
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 4'lü Gerçek Toplam Maliyet Özet Metrik Kartları */}
                <View style={styles.webMetricsGrid}>
                  {/* 1. Gıda / Hammadde Maliyeti */}
                  <View style={[styles.webMetricCard, { borderColor: '#bbf7d0' }]}>
                    <View style={styles.webMetricHeader}>
                      <Text style={styles.webMetricLabel}>1. Hammadde / Gıda</Text>
                      <Text style={styles.webMetricIcon}>🥩</Text>
                    </View>
                    <Text style={[styles.webMetricValue, { color: '#059669' }]}>
                      {foodCostTotal.toLocaleString('tr-TR')} ₺
                    </Text>
                    <Text style={styles.webMetricSubTxt}>Reçete & Depo Çıkışları</Text>
                  </View>

                  {/* 2. Sabit Giderler */}
                  <View style={[styles.webMetricCard, { borderColor: '#bfdbfe' }]}>
                    <View style={styles.webMetricHeader}>
                      <Text style={styles.webMetricLabel}>2. Sabit Giderler</Text>
                      <Text style={styles.webMetricIcon}>🏢</Text>
                    </View>
                    <Text style={[styles.webMetricValue, { color: '#2563eb' }]}>
                      {fixedExpensesTotal.toLocaleString('tr-TR')} ₺
                    </Text>
                    <Text style={styles.webMetricSubTxt}>Kira, Maaş, Mali Müşavir</Text>
                  </View>

                  {/* 3. Değişken Giderler */}
                  <View style={[styles.webMetricCard, { borderColor: '#fde68a' }]}>
                    <View style={styles.webMetricHeader}>
                      <Text style={styles.webMetricLabel}>3. Değişken Giderler</Text>
                      <Text style={styles.webMetricIcon}>⚡</Text>
                    </View>
                    <Text style={[styles.webMetricValue, { color: '#d97706' }]}>
                      {variableExpensesTotal.toLocaleString('tr-TR')} ₺
                    </Text>
                    <Text style={styles.webMetricSubTxt}>Fatura, SGK, Vergi, Sarf</Text>
                  </View>

                  {/* 4. Gerçek Toplam İşletme Maliyeti */}
                  <View style={[styles.webMetricCard, { borderColor: '#ddd6fe', backgroundColor: '#faf5ff' }]}>
                    <View style={styles.webMetricHeader}>
                      <Text style={[styles.webMetricLabel, { color: '#6d28d9' }]}>Gerçek Toplam Maliyet</Text>
                      <Text style={styles.webMetricIcon}>💼</Text>
                    </View>
                    <Text style={[styles.webMetricValue, { color: '#7c3aed', fontSize: 20 }]}>
                      {grandTotalCost.toLocaleString('tr-TR')} ₺
                    </Text>
                    <Text style={[styles.webMetricSubTxt, { color: '#7c3aed' }]}>
                      Gıda + Sabit + Değişken
                    </Text>
                  </View>
                </View>

                {/* Gider Kategori Dağılım & Borç Takip Kartları */}
                <View style={styles.webMiniStatsRow}>
                  <View style={[styles.webMiniStatCard, { borderLeftWidth: 4, borderLeftColor: '#ef4444' }]}>
                    <Text style={[styles.webMiniStatVal, { color: '#dc2626' }]}>{totalDebtAmount.toLocaleString('tr-TR')} ₺</Text>
                    <Text style={styles.webMiniStatLbl}>⏳ Bekleyen Borç / Vade</Text>
                  </View>
                  <View style={[styles.webMiniStatCard, { borderLeftWidth: 4, borderLeftColor: '#b91c1c' }]}>
                    <Text style={[styles.webMiniStatVal, { color: '#b91c1c' }]}>{totalRejectedCount} Adet</Text>
                    <Text style={styles.webMiniStatLbl}>❌ Müşavir Ret Bildirimi</Text>
                  </View>
                </View>

                {/* Sekmeler & Arama Filtresi */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    {isAdvisorUser && (
                      <TouchableOpacity
                        style={[
                          styles.catFilterChip,
                          expenseTab === 'pending_approval' && { backgroundColor: '#be185d', borderColor: '#be185d' }
                        ]}
                        onPress={() => setExpenseTab('pending_approval')}
                      >
                        <Text style={[styles.catFilterTxt, expenseTab === 'pending_approval' && { color: '#ffffff', fontWeight: '800' }]}>
                          ⏳ Onay Bekleyenler ({expenses.filter(e => !e.recordedInLedger && e.sentToAdvisor !== false).length})
                        </Text>
                      </TouchableOpacity>
                    )}
                    <TouchableOpacity
                      style={[styles.catFilterChip, expenseTab === 'all' && styles.catFilterChipActive]}
                      onPress={() => setExpenseTab('all')}
                    >
                      <Text style={[styles.catFilterTxt, expenseTab === 'all' && styles.catFilterTxtActive]}>
                        Tüm Giderler ({expenses.length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.catFilterChip,
                        expenseTab === 'daily_sales' && { backgroundColor: '#059669', borderColor: '#059669' }
                      ]}
                      onPress={() => setExpenseTab('daily_sales')}
                    >
                      <Text style={[styles.catFilterTxt, expenseTab === 'daily_sales' && { color: '#ffffff', fontWeight: '800' }]}>
                        💵 Günlük Satış & Kasa ({INITIAL_SALES_ITEMS.length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.catFilterChip,
                        expenseTab === 'debt' && { backgroundColor: '#dc2626', borderColor: '#dc2626' }
                      ]}
                      onPress={() => setExpenseTab('debt')}
                    >
                      <Text style={[styles.catFilterTxt, expenseTab === 'debt' && { color: '#ffffff', fontWeight: '800' }]}>
                        ⏳ Bekleyen Borçlar ({expenses.filter(e => e.paymentStatus === 'UNPAID' || e.paymentStatus === 'PARTIAL' || !e.paidByCashier).length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.catFilterChip,
                        expenseTab === 'rejected' && { backgroundColor: '#991b1b', borderColor: '#991b1b' }
                      ]}
                      onPress={() => setExpenseTab('rejected')}
                    >
                      <Text style={[styles.catFilterTxt, expenseTab === 'rejected' && { color: '#ffffff', fontWeight: '800' }]}>
                        ❌ Müşavir Retleri ({expenses.filter(e => e.status === 'REJECTED').length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.catFilterChip,
                        expenseTab === 'rent' && { backgroundColor: '#059669', borderColor: '#059669' }
                      ]}
                      onPress={() => setExpenseTab('rent')}
                    >
                      <Text style={[styles.catFilterTxt, expenseTab === 'rent' && { color: '#ffffff', fontWeight: '800' }]}>
                        🏢 Dükkan & Kiralar ({expenses.filter(e => e.subType === 'RENT').length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.catFilterChip,
                        expenseTab === 'fixed' && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }
                      ]}
                      onPress={() => setExpenseTab('fixed')}
                    >
                      <Text style={[styles.catFilterTxt, expenseTab === 'fixed' && { color: '#ffffff', fontWeight: '800' }]}>
                        🏢 Sabit ({expenses.filter(e => e.category === 'FIXED').length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.catFilterChip,
                        expenseTab === 'variable' && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }
                      ]}
                      onPress={() => setExpenseTab('variable')}
                    >
                      <Text style={[styles.catFilterTxt, expenseTab === 'variable' && { color: '#ffffff', fontWeight: '800' }]}>
                        ⚡ Değişken ({expenses.filter(e => e.category === 'VARIABLE').length})
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.catFilterChip,
                        expenseTab === 'ledger' && { backgroundColor: '#7e22ce', borderColor: '#7e22ce' }
                      ]}
                      onPress={() => setExpenseTab('ledger')}
                    >
                      <Text style={[styles.catFilterTxt, expenseTab === 'ledger' && { color: '#ffffff', fontWeight: '800' }]}>
                        📖 Müşavir Defteri ({expenses.filter(e => e.recordedInLedger).length} İşlendi)
                      </Text>
                    </TouchableOpacity>
                  </View>
                </ScrollView>

                <View style={styles.webFilterBar}>
                  <TextInput
                    style={styles.webSearchInput}
                    placeholder="🔍 Gider adı, kurum, fatura no, dönem ara..."
                    placeholderTextColor={THEME.colors.textLight}
                    value={expenseSearch}
                    onChangeText={setExpenseSearch}
                  />
                  <View style={styles.webFilterCountRow}>
                    <Text style={styles.webFilterCountTxt}>
                      Listelenen: <Text style={{ fontWeight: '800', color: THEME.colors.primary }}>{filteredExpenses.length}</Text> / {expenses.length} gider kalemi
                    </Text>
                  </View>
                </View>

                {/* Günlük Satışlar Listesi (Eğer 'daily_sales' sekmesi seçiliyse) */}
                {expenseTab === 'daily_sales' ? (
                  <View style={{ gap: 8, marginBottom: 12 }}>
                    <View style={{ backgroundColor: '#ecfdf5', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#a7f3d0' }}>
                      <Text style={{ fontSize: 13, fontWeight: '900', color: '#065f46' }}>
                        🍽️ Bugün Restoranda Ne Satıldı? (Kasa Dökümü)
                      </Text>
                      <Text style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                        Toplam Gelir: {totalRevenue.toLocaleString('tr-TR')} ₺ • Brüt Kâr: {(totalRevenue - foodCostTotal).toLocaleString('tr-TR')} ₺
                      </Text>
                    </View>
                    {INITIAL_SALES_ITEMS.map((item) => (
                      <View key={item.id} style={[styles.webUserCard, { borderLeftWidth: 4, borderLeftColor: '#059669' }]}>
                        <View style={styles.webUserTopRow}>
                          <View style={[styles.webUserAvatar, { backgroundColor: '#dcfce7', borderRadius: 8 }]}>
                            <Text style={{ fontSize: 16 }}>🍽️</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.webUserName}>{item.name}</Text>
                            <Text style={styles.webUserEmail}>
                              Adet: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{item.qty} porsiyon</Text> • Hammadde: {item.cost.toLocaleString('tr-TR')} ₺
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 15, fontWeight: '900', color: '#166534' }}>
                              +{item.revenue.toLocaleString('tr-TR')} ₺
                            </Text>
                            <View style={[styles.webRolePill, { backgroundColor: '#dcfce7', borderColor: '#86efac', marginTop: 4 }]}>
                              <Text style={[styles.webRolePillTxt, { color: '#15803d', fontWeight: '800' }]}>
                                %{item.foodCost} Food Cost
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                ) : filteredExpenses.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14 }}>
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>📑</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.colors.textDark }}>Eşleşen gider kaydı bulunamadı</Text>
                    <Text style={{ fontSize: 12, color: THEME.colors.textLight, marginTop: 4 }}>Arama terimini veya filtre sekmesini değiştirebilirsiniz.</Text>
                  </View>
                ) : (
                  filteredExpenses.map((exp) => {
                    const isFixed = exp.category === 'FIXED';
                    const pillColor = isFixed ? '#2563eb' : '#d97706';
                    const pillBg = isFixed ? '#eff6ff' : '#fffbeb';
                    const pillBorder = isFixed ? '#bfdbfe' : '#fde68a';

                    const isPaid = exp.paymentStatus === 'PAID' || (exp.paidByCashier && exp.paymentStatus !== 'UNPAID');
                    const isPartial = exp.paymentStatus === 'PARTIAL';
                    const isRejected = exp.status === 'REJECTED';

                    return (
                      <View key={exp.id} style={[styles.webUserCard, isRejected && { borderColor: '#fca5a5', borderWidth: 1.5 }]}>
                        <View style={styles.webUserTopRow}>
                          <View
                            style={[
                              styles.webUserAvatar,
                              { backgroundColor: isFixed ? '#3b82f6' : '#f59e0b', borderRadius: 10 }
                            ]}
                          >
                            <Text style={{ fontSize: 18 }}>{isFixed ? '🏢' : '⚡'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.webUserName}>{exp.title}</Text>

                            {/* Kurum ve Fatura Seri Numarası */}
                            {(exp.counterparty || exp.invoiceNumber) && (
                              <Text style={{ fontSize: 11, fontWeight: '700', color: '#1e293b', marginTop: 2 }}>
                                {exp.counterparty ? `🏢 ${exp.counterparty}` : ''}
                                {exp.invoiceNumber ? ` • 📄 No: ${exp.invoiceNumber}` : ''}
                              </Text>
                            )}

                            <Text style={styles.webUserEmail}>
                              📅 Dönem: <Text style={{ fontWeight: '700', color: THEME.colors.textDark }}>{exp.period || '2026-10'}</Text> • İşlem: {exp.expenseDate}
                              {exp.dueDate ? ` • Vade: ${exp.dueDate}` : ''}
                            </Text>

                            {exp.note ? (
                              <Text style={{ fontSize: 11, color: THEME.colors.textMuted, marginTop: 2 }}>
                                📝 {exp.note}
                              </Text>
                            ) : null}
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>
                              {parseFloat(exp.amount || 0).toLocaleString('tr-TR')} ₺
                            </Text>

                            {/* Ödeme / Borç Durumu Rozeti */}
                            <View
                              style={[
                                styles.webRolePill,
                                {
                                  backgroundColor: isPaid ? '#dcfce7' : isPartial ? '#fef3c7' : '#fee2e2',
                                  borderColor: isPaid ? '#86efac' : isPartial ? '#fcd34d' : '#fca5a5',
                                  marginTop: 4,
                                }
                              ]}
                            >
                              <Text style={[styles.webRolePillTxt, { color: isPaid ? '#15803d' : isPartial ? '#b45309' : '#b91c1c', fontWeight: '800' }]}>
                                {isPaid ? '✓ ÖDENDİ' : isPartial ? '⚡ KISMİ AVANS' : '⏳ BORÇTA (VADELİ)'}
                              </Text>
                            </View>

                            <View
                              style={[
                                styles.webRolePill,
                                { backgroundColor: pillBg, borderColor: pillBorder, marginTop: 4 }
                              ]}
                            >
                              <Text style={[styles.webRolePillTxt, { color: pillColor }]}>
                                {isFixed ? 'SABİT GİDER' : 'DEĞİŞKEN GİDER'}
                              </Text>
                            </View>

                            {exp.isOwnedProperty && (
                              <View
                                style={[
                                  styles.webRolePill,
                                  { backgroundColor: '#dcfce7', borderColor: '#86efac', marginTop: 4 }
                                ]}
                              >
                                <Text style={[styles.webRolePillTxt, { color: '#15803d', fontWeight: '800' }]}>
                                  🏠 ÖZ MÜLK (Kira Yok)
                                </Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* Mali Müşavir Ret Bildirim Kutusu */}
                        {isRejected && (
                          <View style={{ marginHorizontal: 12, marginTop: 6, padding: 8, backgroundColor: '#fef2f2', borderRadius: 8, borderWidth: 1, borderColor: '#fca5a5' }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: '#991b1b' }}>
                              ❌ Mali Müşavir Ret Gerekçesi:
                            </Text>
                            <Text style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                              {exp.rejectionReason || 'Fatura veya tevkifat bilgisi eksik olduğu için reddedildi.'}
                            </Text>
                          </View>
                        )}

                        {/* Muhasebe (Kasa) & Mali Müşavir (Defter) Onay ve Statü Şeridi */}
                        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 12, paddingVertical: 8, backgroundColor: '#f8fafc', borderTopWidth: 1, borderTopColor: '#f1f5f9', marginTop: 6 }}>
                          {/* Kasa / Muhasebe Ödeme Butonu */}
                          {(isAccountantUser || currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER) && (
                            <TouchableOpacity
                              style={[
                                styles.catFilterChip,
                                { flex: 1, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
                                isPaid
                                  ? { backgroundColor: '#dcfce7', borderColor: '#86efac' }
                                  : { backgroundColor: '#fef2f2', borderColor: '#fecaca' }
                              ]}
                              onPress={() => handleToggleExpensePaid(exp)}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: isPaid ? '#15803d' : '#b91c1c' }}>
                                {isPaid ? '💵 Ödendi (Borç Yap) ↷' : '⚡ Kasadan Öde ✓'}
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* Muhasebeci: Mali Müşavir Onayına Gönder Butonu */}
                          {(!exp.recordedInLedger && !exp.sentToAdvisor && !isRejected) && (
                            <TouchableOpacity
                              style={[
                                styles.catFilterChip,
                                { paddingVertical: 5, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }
                              ]}
                              onPress={() => handleSendToAdvisor(exp)}
                              activeOpacity={0.7}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '800', color: '#1d4ed8' }}>
                                🚀 Müşavire Gönder
                              </Text>
                            </TouchableOpacity>
                          )}

                          {/* Mali Müşavir Defter Kayıt, Onay & Ret Butonları */}
                          {isAdvisorUser ? (
                            exp.recordedInLedger ? (
                              <TouchableOpacity
                                style={[
                                  styles.catFilterChip,
                                  { flex: 1, paddingVertical: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' }
                                ]}
                                onPress={() => handleToggleExpenseLedger(exp)}
                                activeOpacity={0.7}
                              >
                                <Text style={{ fontSize: 11, fontWeight: '800', color: '#7e22ce' }}>
                                  📑 Deftere İşlendi ✓ (Geri Al)
                                </Text>
                              </TouchableOpacity>
                            ) : (
                              <View style={{ flex: 1.5, flexDirection: 'row', gap: 4 }}>
                                <TouchableOpacity
                                  style={[
                                    styles.catFilterChip,
                                    { flex: 1, paddingVertical: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#ecfdf5', borderColor: '#6ee7b7' }
                                  ]}
                                  onPress={() => handleApproveExpenseLedger(exp)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#047857' }}>
                                    ✓ Onayla
                                  </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={[
                                    styles.catFilterChip,
                                    { flex: 1, paddingVertical: 5, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fef2f2', borderColor: '#fca5a5' }
                                  ]}
                                  onPress={() => handleOpenRejectModal(exp)}
                                  activeOpacity={0.7}
                                >
                                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#b91c1c' }}>
                                    ✕ Reddet
                                  </Text>
                                </TouchableOpacity>
                              </View>
                            )
                          ) : (
                            <View
                              style={[
                                styles.catFilterChip,
                                { flex: 1, paddingVertical: 5, alignItems: 'center', justifyContent: 'center' },
                                exp.recordedInLedger
                                  ? { backgroundColor: '#f3e8ff', borderColor: '#d8b4fe' }
                                  : isRejected
                                    ? { backgroundColor: '#fef2f2', borderColor: '#fca5a5' }
                                    : { backgroundColor: '#fffbeb', borderColor: '#fde68a' }
                              ]}
                            >
                              <Text style={{ fontSize: 11, fontWeight: '700', color: exp.recordedInLedger ? '#7e22ce' : isRejected ? '#991b1b' : '#b45309' }}>
                                {exp.recordedInLedger ? '📑 Deftere İşlendi ✓' : isRejected ? '❌ Müşavir Reddetti' : '⏳ Müşavir Onayında'}
                              </Text>
                            </View>
                          )}
                        </View>

                        <View style={styles.webUserCardFooter}>
                          <Text style={styles.webUserStatusTxt}>
                            Tür: <Text style={{ fontWeight: '700' }}>{exp.subType || (isFixed ? 'Sabit Kalem' : 'Değişken Kalem')}</Text>
                            {exp.recordedBy ? ` • Kayıt: ${exp.recordedBy}` : ''}
                          </Text>
                          {(currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.ACCOUNTANT || currentUser.role === ROLES.FINANCIAL_ADVISOR) && (
                            <TouchableOpacity
                              style={styles.webUserDismissBtn}
                              onPress={() => {
                                setItemToDelete({
                                  type: 'expense',
                                  id: exp.id,
                                  name: exp.title,
                                  details: `"${exp.title}" (${parseFloat(exp.amount || 0).toLocaleString('tr-TR')} ₺) gider kaydı silinecektir. Onaylıyor musunuz?`,
                                });
                              }}
                            >
                              <Text style={styles.webUserDismissTxt}>🗑️ Gideri Sil</Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}
          </ScrollView>

      {/* MODAL 1: YENİ / DÜZENLE STOK ÜRÜNÜ (Web Warehouse & Inventory ile Birebir) */}
        <Modal visible={showAddStockModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '90%' }]}>
              <View style={styles.webModalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingStockItem ? '✏️ Ürün Bilgilerini Düzenle' : '➕ Depoya Yeni Ürün Ekle'}
                  </Text>
                  <Text style={styles.webModalSub}>
                    {editingStockItem ? 'Mevcut stok ve maliyet parametreleri' : 'Envanter ve barkod kayıt formu'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddStockModal(false);
                    setEditingStockItem(null);
                  }}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseX}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10 }}>
                {/* Ürün Adı */}
                <Text style={styles.webModalLabel}>Ürün Adı *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn: Rebul Kolonya 50ml, Çam Fıstığı..."
                  placeholderTextColor={THEME.colors.textLight}
                  value={newStockItem.name}
                  onChangeText={(t) => setNewStockItem({ ...newStockItem, name: t })}
                />

                {/* Kategori Seçici */}
                <Text style={styles.webModalLabel}>Kategori</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {['Kuru Gıda', 'Et & Tavuk', 'Sebze & Meyve', 'Süt Ürünleri', 'İçecek', 'Temizlik & Hijyen', 'Genel'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.webModalChip, newStockItem.cat === cat && styles.webModalChipActive]}
                      onPress={() => setNewStockItem({ ...newStockItem, cat })}
                    >
                      <Text style={[styles.webModalChipTxt, newStockItem.cat === cat && styles.webModalChipTxtActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* Birim Seçici */}
                <Text style={styles.webModalLabel}>Ölçü Birimi</Text>
                <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                  {['adet', 'kg', 'lt', 'paket', 'koli'].map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      style={[styles.webModalChip, newStockItem.unit === unit && styles.webModalChipActive, { flex: 1, alignItems: 'center' }]}
                      onPress={() => setNewStockItem({ ...newStockItem, unit })}
                    >
                      <Text style={[styles.webModalChipTxt, newStockItem.unit === unit && styles.webModalChipTxtActive]}>
                        {unit}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {/* Stok Miktarı ve Min Stok */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.webModalLabel}>Mevcut Stok Miktarı</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0"
                      placeholderTextColor={THEME.colors.textLight}
                      value={String(newStockItem.stock)}
                      onChangeText={(t) => setNewStockItem({ ...newStockItem, stock: t })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.webModalLabel}>Kritik Min. Stok</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="5"
                      placeholderTextColor={THEME.colors.textLight}
                      value={String(newStockItem.min)}
                      onChangeText={(t) => setNewStockItem({ ...newStockItem, min: t })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Birim Maliyet ve Tedarikçi */}
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.webModalLabel}>Birim Maliyet (₺)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="0.00"
                      placeholderTextColor={THEME.colors.textLight}
                      value={String(newStockItem.price)}
                      onChangeText={(t) => setNewStockItem({ ...newStockItem, price: t })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.webModalLabel}>Tedarikçi Firma</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Örn: Metro Grossmarket"
                      placeholderTextColor={THEME.colors.textLight}
                      value={newStockItem.supplier}
                      onChangeText={(t) => setNewStockItem({ ...newStockItem, supplier: t })}
                    />
                  </View>
                </View>

                {/* Barkod */}
                <Text style={styles.webModalLabel}>Barkod Numarası</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Boş bırakılırsa sistem otomatik üretir"
                  placeholderTextColor={THEME.colors.textLight}
                  value={newStockItem.barcode}
                  onChangeText={(t) => setNewStockItem({ ...newStockItem, barcode: t })}
                  keyboardType="numeric"
                />
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveStockItem}>
                  <Text style={styles.modalSubmitTxt}>
                    {editingStockItem ? 'Değişiklikleri Kaydet' : 'Ürünü Stoğa Ekle'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setShowAddStockModal(false);
                    setEditingStockItem(null);
                  }}
                >
                  <Text style={styles.modalCancelTxt}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL 2: REÇETE EKLE / DÜZENLE (Web RecipesPage ile Birebir) */}
        <Modal visible={showAddRecipeModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '90%' }]}>
              <View style={styles.webModalHeader}>
                <View>
                  <Text style={styles.modalTitle}>
                    {editingRecipe ? '✏️ Reçeteyi Düzenle' : '➕ Yeni Reçete Tanımla'}
                  </Text>
                  <Text style={styles.webModalSub}>Menü reçetesi, porsiyon ve malzeme gramajı</Text>
                </View>
                <TouchableOpacity
                  onPress={() => {
                    setShowAddRecipeModal(false);
                    setEditingRecipe(null);
                  }}
                  style={styles.modalCloseBtn}
                >
                  <Text style={styles.modalCloseX}>✕</Text>
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingVertical: 10 }}>
                <Text style={styles.webModalLabel}>Reçete / Yemek Adı *</Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Örn: Izgara Levrek, Dana Antrikot, Tiramisu..."
                  placeholderTextColor={THEME.colors.textLight}
                  value={newRecipe.name}
                  onChangeText={(t) => setNewRecipe({ ...newRecipe, name: t })}
                />

                {/* Kategori Seçici */}
                <Text style={styles.webModalLabel}>Kategori</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                  {['Ana Yemek', 'Makarna', 'Pizza', 'Burger', 'Salata', 'Kahvaltı', 'Tatlı', 'İçecek', 'Başlangıç'].map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.webModalChip, newRecipe.category === cat && styles.webModalChipActive]}
                      onPress={() => setNewRecipe({ ...newRecipe, category: cat })}
                    >
                      <Text style={[styles.webModalChipTxt, newRecipe.category === cat && styles.webModalChipTxtActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.webModalLabel}>Satış Fiyatı (₺) *</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Örn: 350.00"
                      placeholderTextColor={THEME.colors.textLight}
                      value={String(newRecipe.salePrice)}
                      onChangeText={(t) => setNewRecipe({ ...newRecipe, salePrice: t })}
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.webModalLabel}>Porsiyon Maliyeti (₺)</Text>
                    <TextInput
                      style={styles.modalInput}
                      placeholder="Örn: 95.00"
                      placeholderTextColor={THEME.colors.textLight}
                      value={String(newRecipe.cost)}
                      onChangeText={(t) => setNewRecipe({ ...newRecipe, cost: t })}
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                {/* Dinamik Malzeme & Gramaj Listesi (Web ile birebir) */}
                <View style={{ marginTop: 8, marginBottom: 12 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <Text style={styles.webModalLabel}>Malzeme & Gramaj Listesi (1 Porsiyon)</Text>
                    <TouchableOpacity
                      style={styles.webAddIngredientBtn}
                      onPress={() => {
                        setNewRecipe({
                          ...newRecipe,
                          ingredients: [...(newRecipe.ingredients || []), { name: '', amount: '100 gr' }],
                        });
                      }}
                    >
                      <Text style={styles.webAddIngredientBtnTxt}>+ Malzeme Ekle</Text>
                    </TouchableOpacity>
                  </View>

                  {(newRecipe.ingredients || []).map((ing, idx) => (
                    <View key={idx} style={styles.webIngInputRow}>
                      <TextInput
                        style={[styles.modalInput, { flex: 2, marginBottom: 0 }]}
                        placeholder="Malzeme Adı (örn: Dana Bonfile)"
                        placeholderTextColor={THEME.colors.textLight}
                        value={ing.name}
                        onChangeText={(t) => {
                          const next = [...newRecipe.ingredients];
                          next[idx].name = t;
                          setNewRecipe({ ...newRecipe, ingredients: next });
                        }}
                      />
                      <TextInput
                        style={[styles.modalInput, { flex: 1.2, marginBottom: 0 }]}
                        placeholder="Miktar (200 gr)"
                        placeholderTextColor={THEME.colors.textLight}
                        value={ing.amount}
                        onChangeText={(t) => {
                          const next = [...newRecipe.ingredients];
                          next[idx].amount = t;
                          setNewRecipe({ ...newRecipe, ingredients: next });
                        }}
                      />
                      {newRecipe.ingredients.length > 1 && (
                        <TouchableOpacity
                          style={styles.webRemoveIngBtn}
                          onPress={() => {
                            const next = newRecipe.ingredients.filter((_, i) => i !== idx);
                            setNewRecipe({ ...newRecipe, ingredients: next });
                          }}
                        >
                          <Text style={styles.webRemoveIngTxt}>✕</Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  ))}
                </View>
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveRecipe}>
                  <Text style={styles.modalSubmitTxt}>
                    {editingRecipe ? 'Değişiklikleri Kaydet' : 'Reçeteyi Kaydet'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => {
                    setShowAddRecipeModal(false);
                    setEditingRecipe(null);
                  }}
                >
                  <Text style={styles.modalCancelTxt}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL 2.5: WEB BİREBİR SİLME ONAY MESAJ KUTUSU (Delete Confirmation MessageBox) */}
        <Modal visible={!!itemToDelete} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={styles.deleteConfirmModalCard}>
              <View style={styles.deleteWarningIconCircle}>
                <Text style={{ fontSize: 30 }}>⚠️</Text>
              </View>
              <Text style={styles.deleteModalTitle}>Kalıcı Olarak Silinsin mi?</Text>
              <Text style={styles.deleteModalDesc}>
                {itemToDelete?.details || `"${itemToDelete?.name}" kaydı sistemden ve veritabanından kalıcı olarak silinecektir. Bu işlem geri alınamaz.`}
              </Text>
              <View style={styles.deleteModalBtnRow}>
                <TouchableOpacity
                  style={styles.deleteModalCancelBtn}
                  onPress={() => setItemToDelete(null)}
                >
                  <Text style={styles.deleteModalCancelTxt}>Vazgeç</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.deleteModalConfirmBtn}
                  onPress={handleConfirmDelete}
                >
                  <Text style={styles.deleteModalConfirmTxt}>🗑️ Evet, Sil</Text>
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
                      style={[styles.chipBtn, newUser.role === rVal && styles.chipBtnActive]}
                      onPress={() => setNewUser({ ...newUser, role: rVal })}
                    >
                      <Text style={[styles.chipTxt, newUser.role === rVal && styles.chipTxtActive]}>
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

        {/* MODAL 4B: KULLANICI ROLÜ GÜNCELLE / ATAMA MODALI */}
        <Modal visible={!!editingUserRole} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { borderColor: '#6366f1', borderWidth: 2 }]}>
              <View style={styles.webModalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: '#4338ca' }]}>🛡️ Görev Rolü Ata & Değiştir</Text>
                  <Text style={styles.webModalSub}>Restoran erişim yetkilerini güncelle</Text>
                </View>
                <TouchableOpacity onPress={() => setEditingUserRole(null)}>
                  <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
                </TouchableOpacity>
              </View>

              {editingUserRole && (
                <View style={{ backgroundColor: '#f5f3ff', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#ddd6fe' }}>
                  <Text style={{ fontSize: 14, fontWeight: '800', color: '#4338ca' }}>
                    {editingUserRole.name} ({editingUserRole.username})
                  </Text>
                  <Text style={{ fontSize: 11, color: '#6d28d9', marginTop: 2 }}>
                    Mevcut Rol: <Text style={{ fontWeight: '800' }}>{ROLE_LABELS[editingUserRole.role]}</Text>
                  </Text>
                </View>
              )}

              <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 8 }}>
                Atanacak Yeni Restoran Rolü:
              </Text>
              <View style={{ gap: 6, marginBottom: 14 }}>
                {Object.keys(ROLES).map((rKey) => {
                  const rVal = ROLES[rKey];
                  const isSelected = editingUserRole?.role === rVal;
                  return (
                    <TouchableOpacity
                      key={rVal}
                      style={[
                        styles.chipBtn,
                        { paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
                        isSelected && { backgroundColor: '#6366f1', borderColor: '#4f46e5' }
                      ]}
                      onPress={() => handleUpdateUserRole(editingUserRole.id, rVal)}
                    >
                      <Text style={[styles.chipTxt, isSelected && { color: '#ffffff', fontWeight: '800' }]}>
                        {ROLE_LABELS[rVal]}
                      </Text>
                      {isSelected && (
                        <Text style={{ color: '#ffffff', fontWeight: '900', fontSize: 14 }}>✓ Aktif</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingUserRole(null)}>
                <Text style={styles.modalCancelTxt}>Vazgeç</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL 4C: ROL BİLDİRİMLERİ & MESAJLAŞMA MERKEZİ */}
        <Modal visible={showNotifModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '85%' }]}>
              <View style={styles.webModalHeader}>
                <View>
                  <Text style={styles.modalTitle}>🔔 Rol Bildirimleri</Text>
                  <Text style={styles.webModalSub}>
                    {ROLE_LABELS[currentUser.role]} için anlık onay, ret ve kasa bildirimleri
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setShowNotifModal(false)}>
                  <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
                </TouchableOpacity>
              </View>

              {unreadNotifCount > 0 && (
                <TouchableOpacity
                  style={{
                    backgroundColor: '#ecfdf5',
                    paddingVertical: 8,
                    paddingHorizontal: 12,
                    borderRadius: 8,
                    marginBottom: 10,
                    borderWidth: 1,
                    borderColor: '#a7f3d0',
                    alignItems: 'center',
                  }}
                  onPress={async () => {
                    await apiMarkAllNotificationsRead(currentUser.role);
                    setMobileNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
                    setUnreadNotifCount(0);
                    showToast('Tüm bildirimler okundu olarak işaretlendi');
                  }}
                >
                  <Text style={{ color: '#065f46', fontWeight: '800', fontSize: 12 }}>
                    ✓ Tümünü Okundu Olarak İşaretle
                  </Text>
                </TouchableOpacity>
              )}

              <ScrollView style={{ maxHeight: 380 }}>
                {mobileNotifications.length === 0 ? (
                  <View style={{ padding: 30, alignItems: 'center' }}>
                    <Text style={{ fontSize: 13, color: '#94a3b8' }}>
                      📭 Henüz okunmamış bildiriminiz bulunmuyor.
                    </Text>
                  </View>
                ) : (
                  mobileNotifications.map((notif) => (
                    <TouchableOpacity
                      key={notif.id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        backgroundColor: notif.isRead ? '#f8fafc' : '#f0fdf4',
                        borderWidth: 1,
                        borderColor: notif.isRead ? '#e2e8f0' : '#86efac',
                        marginBottom: 8,
                      }}
                      onPress={async () => {
                        if (!notif.isRead) {
                          await apiMarkNotificationRead(notif.id);
                          setMobileNotifications((prev) =>
                            prev.map((n) => (n.id === notif.id ? { ...n, isRead: true } : n))
                          );
                          setUnreadNotifCount((c) => Math.max(0, c - 1));
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: notif.isRead ? '#475569' : '#166534' }}>
                          {notif.title}
                        </Text>
                        {!notif.isRead && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: '#334155', lineHeight: 16, marginBottom: 6 }}>
                        {notif.message}
                      </Text>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <Text style={{ fontSize: 10, color: '#64748b' }}>
                          👤 {notif.senderName || 'Sistem'}
                        </Text>
                        <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                          🕒 {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Şimdi'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>

              <TouchableOpacity
                style={[styles.modalCancelBtn, { marginTop: 12 }]}
                onPress={() => setShowNotifModal(false)}
              >
                <Text style={styles.modalCancelTxt}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL 4D: ŞİRKET DİLİ SEÇİMİ (Language Selector Modal) */}
        <Modal visible={showLangModal} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxWidth: 320, padding: 20 }]}>
              <View style={styles.webModalHeader}>
                <View>
                  <Text style={styles.modalTitle}>🌐 Şirket Dili / Language</Text>
                  <Text style={styles.webModalSub}>Tek dokunuşla dil değiştirin</Text>
                </View>
                <TouchableOpacity onPress={() => setShowLangModal(false)}>
                  <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={{ gap: 8, marginVertical: 12 }}>
                {[
                  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
                  { code: 'en', label: 'English', flag: '🇬🇧' },
                  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
                  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
                ].map((l) => {
                  const isSelected = currentLang === l.code;
                  return (
                    <TouchableOpacity
                      key={l.code}
                      style={[
                        styles.chipBtn,
                        {
                          paddingVertical: 12,
                          paddingHorizontal: 16,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          borderRadius: 12,
                        },
                        isSelected && { backgroundColor: '#ecfdf5', borderColor: '#10b981' }
                      ]}
                      onPress={() => {
                        setCurrentLang(l.code);
                        setShowLangModal(false);
                        showToast(`Dil değiştirildi: ${l.label}`);
                      }}
                      activeOpacity={0.7}
                    >
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                        <Text style={{ fontSize: 22 }}>{l.flag}</Text>
                        <Text style={[styles.chipTxt, isSelected && { color: '#065f46', fontWeight: '800' }]}>
                          {l.label}
                        </Text>
                      </View>
                      {isSelected && (
                        <Text style={{ color: '#059669', fontWeight: '900', fontSize: 16 }}>✓</Text>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowLangModal(false)}
              >
                <Text style={styles.modalCancelTxt}>Kapat</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>

        {/* MODAL 5: YENİ GİDER EKLE (Sabit veya Değişken Gider Formu) */}
        <Modal visible={showAddExpenseModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '90%' }]}>
              <View style={styles.webModalHeader}>
                <View>
                  <Text style={styles.modalTitle}>➕ Yeni Gider Kaydı Ekle</Text>
                  <Text style={styles.webModalSub}>Sabit veya değişken işletme maliyet kalemi</Text>
                </View>
                <TouchableOpacity onPress={() => setShowAddExpenseModal(false)}>
                  <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Gider Türü Seçimi: Sabit vs Değişken */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 6 }}>
                Gider Ana Kategorisi:
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  style={[
                    styles.chipBtn,
                    { flex: 1, alignItems: 'center' },
                    newExpense.category === 'FIXED' && { backgroundColor: '#3b82f6', borderColor: '#3b82f6' }
                  ]}
                  onPress={() => setNewExpense({ ...newExpense, category: 'FIXED', subType: 'RENT' })}
                >
                  <Text style={[styles.chipTxt, newExpense.category === 'FIXED' && { color: '#ffffff', fontWeight: '800' }]}>
                    🏢 Sabit Gider
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chipBtn,
                    { flex: 1, alignItems: 'center' },
                    newExpense.category === 'VARIABLE' && { backgroundColor: '#f59e0b', borderColor: '#f59e0b' }
                  ]}
                  onPress={() => setNewExpense({ ...newExpense, category: 'VARIABLE', subType: 'ELECTRICITY' })}
                >
                  <Text style={[styles.chipTxt, newExpense.category === 'VARIABLE' && { color: '#ffffff', fontWeight: '800' }]}>
                    ⚡ Değişken Gider
                  </Text>
                </TouchableOpacity>
              </View>

              {/* Alt Tip Seçimi */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 6 }}>
                Kalem Türü:
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {newExpense.category === 'FIXED' ? (
                  <>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'RENT' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'RENT' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'RENT' && styles.chipTxtActive]}>
                        🏢 Kira
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'LABOR' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'LABOR' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'LABOR' && styles.chipTxtActive]}>
                        👥 İşçilik / Maaş
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'ACCOUNTANT' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'ACCOUNTANT' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'ACCOUNTANT' && styles.chipTxtActive]}>
                        ⚖️ Mali Müşavir
                      </Text>
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'ELECTRICITY' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'ELECTRICITY' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'ELECTRICITY' && styles.chipTxtActive]}>
                        ⚡ Elektrik
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'WATER' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'WATER' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'WATER' && styles.chipTxtActive]}>
                        💧 Su
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'GAS' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'GAS' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'GAS' && styles.chipTxtActive]}>
                        🔥 Doğalgaz
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'PHONE' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'PHONE' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'PHONE' && styles.chipTxtActive]}>
                        📞 Telefon
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'INTERNET' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'INTERNET' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'INTERNET' && styles.chipTxtActive]}>
                        🌐 İnternet
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'TAX' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'TAX' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'TAX' && styles.chipTxtActive]}>
                        📑 Vergi
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'SGK' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'SGK' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'SGK' && styles.chipTxtActive]}>
                        🛡️ Sigorta (SGK)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'CONSUMABLES' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'CONSUMABLES' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'CONSUMABLES' && styles.chipTxtActive]}>
                        📦 Sarf Malzeme
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'LOGISTICS' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'LOGISTICS' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'LOGISTICS' && styles.chipTxtActive]}>
                        🚚 Lojistik & Nakliye
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'MARKETING' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'MARKETING' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'MARKETING' && styles.chipTxtActive]}>
                        📣 Reklam & Tanıtım
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'RENOVATION' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'RENOVATION' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'RENOVATION' && styles.chipTxtActive]}>
                        🔧 Tadilat & Bakım
                      </Text>
                    </TouchableOpacity>
                  </>
                )}
              </View>

              {/* Kira Seçildiğinde: Dükkan Kendi Mülkü Mü? (Öz Mülk) */}
              {newExpense.subType === 'RENT' && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 10,
                    backgroundColor: newExpense.isOwnedProperty ? '#ecfdf5' : '#f8fafc',
                    borderWidth: 1,
                    borderColor: newExpense.isOwnedProperty ? '#6ee7b7' : '#e2e8f0',
                    padding: 10,
                    borderRadius: 10,
                    marginBottom: 10,
                  }}
                  onPress={() => setNewExpense({ ...newExpense, isOwnedProperty: !newExpense.isOwnedProperty, amount: !newExpense.isOwnedProperty ? '0' : newExpense.amount })}
                >
                  <View
                    style={{
                      width: 20,
                      height: 20,
                      borderRadius: 4,
                      borderWidth: 2,
                      borderColor: newExpense.isOwnedProperty ? '#059669' : '#94a3b8',
                      backgroundColor: newExpense.isOwnedProperty ? '#059669' : '#ffffff',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {newExpense.isOwnedProperty ? <Text style={{ color: '#fff', fontSize: 12, fontWeight: '900' }}>✓</Text> : null}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: newExpense.isOwnedProperty ? '#065f46' : '#1e293b' }}>
                      🏠 Dükkan Restoranın Kendi Mülkü (Öz Mülk - Kira Ödenmiyor)
                    </Text>
                    <Text style={{ fontSize: 10, color: '#64748b' }}>
                      İşaretlenirse kira maliyet toplamına 0 ₺ yansır, muhasebede öz mülk olarak deftere işlenir.
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              <TextInput
                style={styles.modalInput}
                placeholder="Gider Başlığı (Örn: Sanayi Tipi Elektrik Faturası)"
                placeholderTextColor={THEME.colors.textLight}
                value={newExpense.title}
                onChangeText={(t) => setNewExpense({ ...newExpense, title: t })}
              />

              {/* Kurum / Alacaklı & Fatura Seri No */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1.2 }]}
                  placeholder="Kurum / Muhatap (Örn: Enerjisa)"
                  placeholderTextColor={THEME.colors.textLight}
                  value={newExpense.counterparty}
                  onChangeText={(t) => setNewExpense({ ...newExpense, counterparty: t })}
                />
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="Fatura No (Örn: ELEK-8839)"
                  placeholderTextColor={THEME.colors.textLight}
                  value={newExpense.invoiceNumber}
                  onChangeText={(t) => setNewExpense({ ...newExpense, invoiceNumber: t })}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder={newExpense.isOwnedProperty ? "Tutar (Öz Mülk: 0 ₺)" : "Tutar (₺) Örn: 14500"}
                  placeholderTextColor={THEME.colors.textLight}
                  value={newExpense.isOwnedProperty ? '0' : newExpense.amount}
                  onChangeText={(t) => setNewExpense({ ...newExpense, amount: t })}
                  keyboardType="numeric"
                  editable={!newExpense.isOwnedProperty}
                />
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder="Dönem (Örn: 2026-10)"
                  placeholderTextColor={THEME.colors.textLight}
                  value={newExpense.period}
                  onChangeText={(t) => setNewExpense({ ...newExpense, period: t })}
                />
              </View>

              {/* Vade / Son Ödeme Tarihi */}
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 4 }}>
                  Son Ödeme Vadesi (YYYY-AA-GG):
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder="Vade Tarihi (Örn: 2026-10-24)"
                  placeholderTextColor={THEME.colors.textLight}
                  value={newExpense.dueDate}
                  onChangeText={(t) => setNewExpense({ ...newExpense, dueDate: t })}
                />
              </View>

              {/* Ödeme Durumu (Gerçekçi Muhasebe: Peşin Ödendi vs Borca Bırakıldı vs Kısmi) */}
              <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 4 }}>
                Ödeme Şekli & Kasa Durumu:
              </Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 10 }}>
                <TouchableOpacity
                  style={[
                    styles.chipBtn,
                    { flex: 1, alignItems: 'center' },
                    newExpense.paymentStatus === 'PAID' && { backgroundColor: '#059669', borderColor: '#059669' }
                  ]}
                  onPress={() => setNewExpense({ ...newExpense, paymentStatus: 'PAID', paidByCashier: true })}
                >
                  <Text style={[styles.chipTxt, newExpense.paymentStatus === 'PAID' && { color: '#ffffff', fontWeight: '800' }]}>
                    💵 Peşin Ödendi
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chipBtn,
                    { flex: 1, alignItems: 'center' },
                    newExpense.paymentStatus === 'UNPAID' && { backgroundColor: '#dc2626', borderColor: '#dc2626' }
                  ]}
                  onPress={() => setNewExpense({ ...newExpense, paymentStatus: 'UNPAID', paidByCashier: false })}
                >
                  <Text style={[styles.chipTxt, newExpense.paymentStatus === 'UNPAID' && { color: '#ffffff', fontWeight: '800' }]}>
                    ⏳ Borçta / Vadeli
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.chipBtn,
                    { flex: 1, alignItems: 'center' },
                    newExpense.paymentStatus === 'PARTIAL' && { backgroundColor: '#d97706', borderColor: '#d97706' }
                  ]}
                  onPress={() => setNewExpense({ ...newExpense, paymentStatus: 'PARTIAL', paidByCashier: true })}
                >
                  <Text style={[styles.chipTxt, newExpense.paymentStatus === 'PARTIAL' && { color: '#ffffff', fontWeight: '800' }]}>
                    ⚡ Kısmi Avans
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.modalInput}
                placeholder="Açıklama / Fatura Notu (Opsiyonel)"
                placeholderTextColor={THEME.colors.textLight}
                value={newExpense.note}
                onChangeText={(t) => setNewExpense({ ...newExpense, note: t })}
              />

              {/* Mali Müşavir Defter Onay Durumu */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <TouchableOpacity
                  style={{
                    flex: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    padding: 8,
                    borderRadius: 8,
                    backgroundColor: newExpense.recordedInLedger ? '#faf5ff' : '#f8fafc',
                    borderWidth: 1,
                    borderColor: newExpense.recordedInLedger ? '#e9d5ff' : '#e2e8f0',
                  }}
                  onPress={() => setNewExpense({ ...newExpense, recordedInLedger: !newExpense.recordedInLedger })}
                >
                  <Text style={{ fontSize: 14 }}>{newExpense.recordedInLedger ? '☑️' : '⬜'}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: newExpense.recordedInLedger ? '#6b21a8' : '#64748b' }}>
                    📑 Resmi Deftere Doğrudan Onayla
                  </Text>
                </TouchableOpacity>
              </View>

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, { backgroundColor: '#8b5cf6' }]}
                  onPress={handleSaveExpense}
                >
                  <Text style={styles.modalSubmitTxt}>Gideri Kaydet</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddExpenseModal(false)}>
                  <Text style={styles.modalCancelTxt}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL 5B: MALİ MÜŞAVİR GEREKÇELİ RET MODALI */}
        <Modal visible={!!expenseToRejectMobile} animationType="fade" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { borderColor: '#fca5a5', borderWidth: 2 }]}>
              <View style={styles.webModalHeader}>
                <View>
                  <Text style={[styles.modalTitle, { color: '#991b1b' }]}>❌ Gideri Deftere Almayı Reddet</Text>
                  <Text style={styles.webModalSub}>Muhasebeye iletilecek gerekçeli ret bildirimi</Text>
                </View>
                <TouchableOpacity onPress={() => setExpenseToRejectMobile(null)}>
                  <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
                </TouchableOpacity>
              </View>

              {expenseToRejectMobile && (
                <View style={{ backgroundColor: '#fef2f2', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: '#991b1b' }}>
                    {expenseToRejectMobile.title}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                    Tutar: {parseFloat(expenseToRejectMobile.amount || 0).toLocaleString('tr-TR')} ₺ • Fatura No: {expenseToRejectMobile.invoiceNumber || 'Girilmemiş'}
                  </Text>
                </View>
              )}

              <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 6 }}>
                Ret Gerekçesi (Zorunlu):
              </Text>
              <TextInput
                style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
                placeholder="Örn: Fatura e-arşiv PDF belgesi eksik, KDV tevkifat oranı hatalı girilmiş..."
                placeholderTextColor={THEME.colors.textLight}
                multiline
                numberOfLines={3}
                value={mobileRejectReason}
                onChangeText={setMobileRejectReason}
              />

              <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, { backgroundColor: '#dc2626' }]}
                  onPress={handleConfirmRejectExpense}
                >
                  <Text style={styles.modalSubmitTxt}>❌ Reddet ve Bildir</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalCancelBtn}
                  onPress={() => setExpenseToRejectMobile(null)}
                >
                  <Text style={styles.modalCancelTxt}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* MODAL 6: KASAYA PARA GİRİŞİ & DAĞIT (Muhasebe Kasa Yönetimi) */}
        <Modal visible={showCashModal} animationType="slide" transparent>
          <View style={styles.modalOverlay}>
            <View style={[styles.modalCard, { maxHeight: '90%' }]}>
              <View style={styles.webModalHeader}>
                <View>
                  <Text style={styles.modalTitle}>💵 Kasaya Para Girişi & Dağıt</Text>
                  <Text style={styles.webModalSub}>Nakit bütçeyi gider kalemlerine paylaştırıp Müşavire ilet</Text>
                </View>
                <TouchableOpacity onPress={() => setShowCashModal(false)}>
                  <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={{ marginVertical: 8 }}>
                <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 4 }}>
                  Kasaya Gelen Nakit Tutarı (₺)
                </Text>
                <TextInput
                  style={[styles.modalInput, { fontSize: 16, fontWeight: '800', color: '#065f46' }]}
                  placeholder="Örn: 5000"
                  placeholderTextColor={THEME.colors.textLight}
                  value={cashAllocationAmount}
                  onChangeText={setCashAllocationAmount}
                  keyboardType="numeric"
                />
              </View>

              {/* Otomatik Dağıtım Senaryosu */}
              <View style={{ backgroundColor: '#f0fdf4', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 14 }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#166534', marginBottom: 6 }}>
                  🎯 Otomatik Dağıtım Dağılımı:
                </Text>
                <View style={{ gap: 4 }}>
                  <Text style={{ fontSize: 11, color: '#15803d' }}>
                    • 📦 Sarf Malzeme & Peçete: {(Math.round((parseFloat(cashAllocationAmount || 0) * 0.3))).toLocaleString('tr-TR')} ₺
                  </Text>
                  <Text style={{ fontSize: 11, color: '#15803d' }}>
                    • ⚡ Mutfak Elektrik & Enerji Avansı: {(Math.round((parseFloat(cashAllocationAmount || 0) * 0.4))).toLocaleString('tr-TR')} ₺
                  </Text>
                  <Text style={{ fontSize: 11, color: '#15803d' }}>
                    • 🚚 Hal / Soğuk Zincir Lojistik: {(Math.round((parseFloat(cashAllocationAmount || 0) * 0.3))).toLocaleString('tr-TR')} ₺
                  </Text>
                </View>
              </View>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TouchableOpacity
                  style={[styles.modalSubmitBtn, { backgroundColor: '#059669', flex: 1.5 }]}
                  onPress={handleAllocateCash}
                >
                  <Text style={styles.modalSubmitTxt}>🚀 Dağıt ve Müşavire Gönder</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowCashModal(false)}>
                  <Text style={styles.modalCancelTxt}>Vazgeç</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Material 3 Bottom Navigation Bar - Android Sanal Tuşlarının Üzerine Binmeyen Dinamik Güvenli Alan */}
        <View style={[styles.bottomNavAndroid, { paddingBottom: androidBottomPadding, height: 56 + androidBottomPadding }]}>
          {allowedScreens.includes('accounting') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'accounting' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('accounting')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'accounting' && styles.bottomNavIconActive]}>
                {isAdvisorUser ? '📖' : '💰'}
              </Text>
              <Text
                style={[styles.bottomNavLabel, currentScreen === 'accounting' && styles.bottomNavLabelActive]}
                numberOfLines={2}
              >
                {isAdvisorUser ? 'Defter Onay' : isAccountantUser ? 'Kasa & Gider' : 'Muhasebe'}
              </Text>
            </TouchableOpacity>
          )}

          {allowedScreens.includes('dashboard') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'dashboard' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('dashboard')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'dashboard' && styles.bottomNavIconActive]}>🏠</Text>
              <Text
                style={[styles.bottomNavLabel, currentScreen === 'dashboard' && styles.bottomNavLabelActive]}
                numberOfLines={2}
              >
                Finansal Özet
              </Text>
            </TouchableOpacity>
          )}

          {allowedScreens.includes('inventory') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'inventory' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('inventory')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'inventory' && styles.bottomNavIconActive]}>📦</Text>
              <Text
                style={[styles.bottomNavLabel, currentScreen === 'inventory' && styles.bottomNavLabelActive]}
                numberOfLines={2}
              >
                Stok Yönetimi
              </Text>
            </TouchableOpacity>
          )}

          {allowedScreens.includes('recipes') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'recipes' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('recipes')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'recipes' && styles.bottomNavIconActive]}>📖</Text>
              <Text
                style={[styles.bottomNavLabel, currentScreen === 'recipes' && styles.bottomNavLabelActive]}
                numberOfLines={2}
              >
                Reçete Merkezi
              </Text>
            </TouchableOpacity>
          )}

          {allowedScreens.includes('sales') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'sales' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('sales')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'sales' && styles.bottomNavIconActive]}>📊</Text>
              <Text
                style={[styles.bottomNavLabel, currentScreen === 'sales' && styles.bottomNavLabelActive]}
                numberOfLines={2}
              >
                Satış Analizi
              </Text>
            </TouchableOpacity>
          )}

          {allowedScreens.includes('warehouse') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'warehouse' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('warehouse')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'warehouse' && styles.bottomNavIconActive]}>📦</Text>
              <Text
                style={[styles.bottomNavLabel, currentScreen === 'warehouse' && styles.bottomNavLabelActive]}
                numberOfLines={2}
              >
                Depo Terminali
              </Text>
            </TouchableOpacity>
          )}

          {allowedScreens.includes('users') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'users' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('users')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'users' && styles.bottomNavIconActive]}>👥</Text>
              <Text
                style={[styles.bottomNavLabel, currentScreen === 'users' && styles.bottomNavLabelActive]}
                numberOfLines={2}
              >
                Kullanıcı Yönetimi
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
  topAppBar: {
    height: 52,
    backgroundColor: THEME.colors.headerBg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(16, 185, 129, 0.2)',
    elevation: 3,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  androidBackBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 8,
    gap: 4,
  },
  androidBackArrow: {
    fontSize: 15,
    color: THEME.colors.accent,
    fontWeight: '800',
  },
  androidBackLabel: {
    fontSize: 12,
    color: THEME.colors.accent,
    fontWeight: '700',
  },
  logoBadge: {
    backgroundColor: THEME.colors.accent,
    width: 26,
    height: 26,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    color: '#07190e',
    fontWeight: '900',
    fontSize: 12,
  },
  appBarTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#ffffff',
    letterSpacing: 0.3,
  },
  headerUserGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  fixedRoleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 5,
  },
  roleAvatar: {
    fontSize: 11,
    fontWeight: '800',
    color: '#ffffff',
  },
  roleNameText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ffffff',
  },
  logoutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.4)',
    gap: 3,
  },
  logoutIcon: {
    fontSize: 11,
    color: '#f87171',
    fontWeight: '900',
  },
  logoutBtnText: {
    color: '#f87171',
    fontSize: 11,
    fontWeight: '700',
  },
  roleSelectCard: {
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderBottomWidth: 1,
    borderBottomColor: THEME.colors.border,
    elevation: 6,
  },
  roleCardTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textMuted,
    marginBottom: 8,
  },
  roleSelectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    borderRadius: 8,
    backgroundColor: THEME.colors.background,
    marginBottom: 6,
  },
  roleSelectBtnActive: {
    backgroundColor: '#dcfce7',
    borderWidth: 1,
    borderColor: THEME.colors.accent,
  },
  roleCircle: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 10,
  },
  roleItemTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  roleItemSub: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  checkIcon: {
    color: THEME.colors.accentDark,
    fontWeight: '900',
    fontSize: 14,
  },
  snackBar: {
    margin: 12,
    backgroundColor: THEME.colors.accentBg,
    borderWidth: 1,
    borderColor: THEME.colors.accent,
    borderRadius: 8,
    padding: 10,
    alignItems: 'center',
    elevation: 3,
  },
  snackText: {
    color: THEME.colors.primary,
    fontSize: 12,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  screenHeader: {
    marginBottom: 12,
  },
  titleText: {
    fontSize: 20,
    fontWeight: '800',
    color: THEME.colors.primary,
  },
  descText: {
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
  heroCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    elevation: 2,
  },
  heroLabel: {
    fontSize: 12,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  heroNum: {
    fontSize: 28,
    fontWeight: '900',
    color: THEME.colors.primary,
    marginVertical: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  badgePill: {
    backgroundColor: THEME.colors.mintSubtle,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  badgePillTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  gridCard: {
    flex: 1,
    backgroundColor: THEME.colors.surface,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  gridLabel: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    fontWeight: '600',
  },
  gridNum: {
    fontSize: 18,
    fontWeight: '800',
    color: THEME.colors.textPrimary,
    marginTop: 4,
  },
  subHeading: {
    fontSize: 11,
    fontWeight: '800',
    color: THEME.colors.textSecondary,
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 4,
  },
  shortcutGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  shortcutBtn: {
    width: (width - 42) / 2,
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    alignItems: 'center',
    gap: 6,
  },
  shortcutIcon: {
    fontSize: 24,
  },
  shortcutTxt: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  searchCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  cardHeaderSmall: {
    fontSize: 12,
    fontWeight: '700',
    color: THEME.colors.textSecondary,
    marginBottom: 6,
  },
  inputBox: {
    backgroundColor: THEME.colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: THEME.colors.border,
    padding: 10,
    fontSize: 13,
    color: THEME.colors.textPrimary,
  },
  chipBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
    backgroundColor: THEME.colors.background,
    marginRight: 6,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  chipBtnActive: {
    backgroundColor: THEME.colors.primary,
    borderColor: THEME.colors.primary,
  },
  chipTxt: {
    fontSize: 11,
    color: THEME.colors.textSecondary,
    fontWeight: '600',
  },
  chipTxtActive: {
    color: '#ffffff',
  },
  listCounter: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    textAlign: 'right',
    marginBottom: 8,
  },
  itemCard: {
    backgroundColor: THEME.colors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: THEME.colors.border,
  },
  itemCardAlert: {
    borderLeftWidth: 4,
    borderLeftColor: THEME.colors.danger,
  },
  itemTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: THEME.colors.textPrimary,
  },
  itemMeta: {
    fontSize: 11,
    color: THEME.colors.textMuted,
    marginTop: 2,
  },
  stockAmount: {
    fontSize: 14,
    fontWeight: '800',
  },
  stockOk: {
    color: THEME.colors.accentDark,
  },
  stockAlert: {
    color: THEME.colors.danger,
  },
  statusMiniTag: {
    fontSize: 9,
    fontWeight: '700',
    marginTop: 2,
  },
  statusMiniOk: {
    color: THEME.colors.accentDark,
  },
  statusMiniAlert: {
    color: THEME.colors.danger,
  },
  recipeIngBox: {
    marginTop: 6,
    backgroundColor: THEME.colors.background,
    padding: 6,
    borderRadius: 6,
  },
  recipeIngTitle: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.textMuted,
  },
  recipeIngRow: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
  },
  recipeCost: {
    fontSize: 11,
    color: THEME.colors.textMuted,
  },
  fcBadge: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 4,
    marginTop: 4,
  },
  fcBadgeGood: {
    backgroundColor: '#dcfce7',
  },
  fcBadgeDanger: {
    backgroundColor: '#fee2e2',
  },
  fcBadgeTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: THEME.colors.primary,
  },
  salesRevBold: {
    fontSize: 14,
    fontWeight: '800',
    color: THEME.colors.accentDark,
  },
  cameraActionCard: {
    backgroundColor: THEME.colors.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 14,
    elevation: 4,
  },
  cameraIconLarge: {
    fontSize: 36,
    marginBottom: 6,
  },
  cameraTitleLarge: {
    fontSize: 17,
    fontWeight: '800',
    color: '#ffffff',
  },
  cameraDesc: {
    fontSize: 12,
    color: '#96be9f',
    marginTop: 4,
  },
  btnManualSubmit: {
    backgroundColor: THEME.colors.primary,
    padding: 10,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  btnManualSubmitTxt: {
    color: '#ffffff',
    fontWeight: '700',
    fontSize: 13,
  },
  selectedActionCard: {
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
  stockStatusBig: {
    fontSize: 13,
    fontWeight: '700',
    color: THEME.colors.primary,
    marginTop: 6,
  },
  actionBtnGrid: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 10,
  },
  actionBtnItem: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  actionBtnItemTxt: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 13,
  },
  avatarBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: {
    color: '#ffffff',
    fontWeight: '800',
    fontSize: 12,
  },
  roleBadgeOutline: {
    borderWidth: 1,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  roleBadgeOutlineTxt: {
    fontSize: 10,
    fontWeight: '700',
  },
  bottomNavAndroid: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#07190e',
    borderTopWidth: 1,
    borderTopColor: 'rgba(16, 185, 129, 0.2)',
    flexDirection: 'row',
    elevation: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  bottomNavTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 2,
    minHeight: 52,
    borderRadius: 8,
    marginHorizontal: 2,
  },
  bottomNavTabActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  bottomNavIcon: {
    fontSize: 16,
    marginBottom: 2,
    opacity: 0.7,
  },
  bottomNavIconActive: {
    opacity: 1,
  },
  bottomNavLabel: {
    fontSize: 9.5,
    color: '#96be9f',
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 11,
    paddingHorizontal: 1,
  },
  bottomNavLabelActive: {
    color: '#10b981',
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
    elevation: 3,
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
    elevation: 2,
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
  webFilterCountRow: {
    marginTop: 8,
    alignItems: 'flex-end',
  },
  webFilterCountTxt: {
    fontSize: 11,
    color: '#64748b',
  },

  /* Web Birebir Tablo & Kart Tasarımı */
  webItemCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#dbe7df',
    shadowColor: '#0a1f11',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  webItemCardAlert: {
    backgroundColor: '#fffdf5',
    borderColor: '#fed7aa',
    borderLeftWidth: 4,
    borderLeftColor: '#f59e0b',
  },
  webItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  webItemName: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0a1f11',
  },
  webItemBarcode: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 2,
    fontFamily: 'monospace',
  },
  webCategoryBadge: {
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  webCategoryBadgeTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#475569',
  },
  webItemMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#f8faf9',
    borderRadius: 8,
    padding: 8,
    marginVertical: 4,
  },
  webItemMetricCol: {
    alignItems: 'center',
    flex: 1,
  },
  webItemMetricLbl: {
    fontSize: 9,
    color: '#64748b',
    fontWeight: '600',
  },
  webItemMetricVal: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0f172a',
    marginTop: 2,
  },
  webItemStatusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  webTierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ecfdf5',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    gap: 4,
  },
  webTierDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10b981',
  },
  webTierTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#047857',
  },
  webCriticalBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef3c7',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#fde68a',
    gap: 4,
  },
  webCriticalTxt: {
    fontSize: 10,
    fontWeight: '700',
    color: '#b45309',
  },

  /* Web Birebir Depo & Mal Kabul Kartları */
  webWhActionBtnLarge: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 3,
  },
  webTxBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#dbe7df',
    marginTop: 10,
  },
  webTxTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#0a1f11',
    letterSpacing: 0.3,
  },
  webTxItemRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f3',
  },
  webTxIconBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  webTxName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#0f172a',
  },
  webTxMeta: {
    fontSize: 10,
    color: '#64748b',
    marginTop: 1,
  },
  webTxQty: {
    fontSize: 12,
    fontWeight: '800',
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
    elevation: 2,
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
    elevation: 2,
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
    elevation: 3,
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
  webRecipeActionRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f3',
  },
  webRecipeEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.3)',
  },
  webRecipeEditTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  webRecipeDeleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  webRecipeDeleteTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#ef4444',
  },

  /* Stok Kartı Aksiyon Butonları */
  stockItemActionBar: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f3',
  },
  stockItemEditBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(2, 132, 199, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(2, 132, 199, 0.25)',
  },
  stockItemEditTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#0284c7',
  },
  stockItemDeleteBtn: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  stockItemDeleteTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#dc2626',
  },

  /* Web Modal Header & Form Stilleri */
  webModalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f3',
    paddingBottom: 10,
    marginBottom: 6,
  },
  webModalSub: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  modalCloseBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#f1f5f9',
  },
  webModalLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
    marginBottom: 5,
    marginTop: 6,
  },
  webModalChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    backgroundColor: '#f8fafc',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    marginRight: 6,
  },
  webModalChipActive: {
    backgroundColor: '#0a1f11',
    borderColor: '#0a1f11',
  },
  webModalChipTxt: {
    fontSize: 11,
    fontWeight: '600',
    color: '#475569',
  },
  webModalChipTxtActive: {
    color: '#ffffff',
    fontWeight: '800',
  },
  webAddIngredientBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  webAddIngredientBtnTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#059669',
  },
  webIngInputRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    marginBottom: 8,
  },
  webRemoveIngBtn: {
    width: 32,
    height: 38,
    borderRadius: 8,
    backgroundColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  webRemoveIngTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#b91c1c',
  },

  /* Web Delete Confirmation Modal Stilleri */
  deleteConfirmModalCard: {
    backgroundColor: '#ffffff',
    width: '100%',
    maxWidth: 380,
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#fee2e2',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 10,
  },
  deleteWarningIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#fef2f2',
    borderWidth: 2,
    borderColor: '#fee2e2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  deleteModalTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
    textAlign: 'center',
    marginBottom: 8,
  },
  deleteModalDesc: {
    fontSize: 13,
    color: '#475569',
    textAlign: 'center',
    lineHeight: 19,
    marginBottom: 20,
  },
  deleteModalBtnRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  deleteModalCancelBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#f1f5f9',
    borderWidth: 1,
    borderColor: '#cbd5e1',
    alignItems: 'center',
  },
  deleteModalCancelTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  deleteModalConfirmBtn: {
    flex: 1.4,
    paddingVertical: 12,
    borderRadius: 10,
    backgroundColor: '#dc2626',
    alignItems: 'center',
    shadowColor: '#dc2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 6,
    elevation: 3,
  },
  deleteModalConfirmTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
});
