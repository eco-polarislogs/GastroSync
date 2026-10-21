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
  INITIAL_EXPENSES,
  ROLE_MODULES,
} from '../data/inventoryData';
import { TRANSLATIONS, getCategoryLabel, getRoleLabel, getExpenseTypeLabel, getLocalizedNotification } from '../data/translations';
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
  [ROLES.ADMIN]: ['dashboard', 'cashier', 'advisor', 'inventory', 'recipes', 'sales', 'warehouse', 'users'],
  [ROLES.MANAGER]: ['dashboard', 'cashier', 'advisor', 'inventory', 'recipes', 'sales', 'warehouse'],
  [ROLES.ACCOUNTANT]: ['cashier', 'dashboard', 'inventory', 'sales'],
  [ROLES.FINANCIAL_ADVISOR]: ['advisor', 'dashboard', 'inventory', 'sales'],
  [ROLES.CHEF]: ['recipes', 'inventory'],
  [ROLES.WAREHOUSE]: ['warehouse'],
};

export default function IOSApp({ initialUser, onLogout }) {
  const insets = useSafeAreaInsets();
  const currentUser = initialUser || DEMO_USERS[0];

  // Bu rolün izinli olduğu ekranlar listesi (Roller birbirinin ekranlarına geçemez)
  const allowedScreens = ROLE_ALLOWED_SCREENS[currentUser.role] || ['warehouse'];

  const getDefaultScreen = (role) => {
    if (role === ROLES.ACCOUNTANT) return 'cashier';
    if (role === ROLES.FINANCIAL_ADVISOR) return 'advisor';
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
  const [expenses, setExpenses] = useState(INITIAL_EXPENSES);
  const [currentLang, setCurrentLang] = useState('tr');
  const [showLangModal, setShowLangModal] = useState(false);
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.tr;

  const isAccountantUser = currentUser.role === ROLES.ACCOUNTANT;
  const isAdvisorUser = currentUser.role === ROLES.FINANCIAL_ADVISOR;

  const [expenseTab, setExpenseTab] = useState('all');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [advisorTab, setAdvisorTab] = useState('pending_approval'); // 'pending_approval' | 'ledger' | 'tdhp' | 'z_report' | 'rejected'
  const [advisorSearch, setAdvisorSearch] = useState('');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
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
      // Offline fallback: Yerel demo verisi ile kesintisiz devam eder
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
  const [newUser, setNewUser] = useState({ name: '', username: '', email: '', role: ROLES.CHEF, password: '123456' });
  const [editingUserRole, setEditingUserRole] = useState(null); // { id, name, currentRole }

  // Web Birebir "Sipariş Talebi Aç" Modalı
  const [orderModalItem, setOrderModalItem] = useState(null);
  const [orderQuantity, setOrderQuantity] = useState('15');
  const [orderUrgent, setOrderUrgent] = useState(false);
  const [orderNote, setOrderNote] = useState('');

  // Web Birebir Restoran Ekip İçi Anlık Sohbet (RestaurantTeamChat)
  const [showTeamChatModal, setShowTeamChatModal] = useState(false);
  const [activeChatChannel, setActiveChatChannel] = useState('general');
  const [chatInputMsg, setChatInputMsg] = useState('');
  const [chatIsUrgent, setChatIsUrgent] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [chatMessages, setChatMessages] = useState([
    { id: 1, channelId: 'kitchen', sender: 'Mehmet Şef', role: 'chef', text: 'Depoda pancar son 2 kg kaldı! Akşamki kış menüsü ve pancarlı meze servisi için acil 15 kg takviye gerekiyor.', time: '10:15', avatar: 'MŞ', priority: 'urgent' },
    { id: 2, channelId: 'cashier', sender: 'Canan Kasa', role: 'accountant', text: 'Şefin pancar talebi üzerine toptancıya 1.500 TL nakit kasa çıkışı yapıldı ve fiilen ödendi. Onay masasına iletildi.', time: '10:45', avatar: 'CK', priority: 'normal' },
    { id: 3, channelId: 'kitchen', sender: 'Ali Depocu', role: 'warehouse', text: 'Halden 15 kg taze pancar geldi, tartıp mal kabul terminalinden barkodla stoğa işledim şefim.', time: '11:30', avatar: 'AD', priority: 'normal' },
    { id: 4, channelId: 'cashier', sender: 'SMMM Selim', role: 'financial_advisor', text: 'Pancar alım faturası ile elektrik faturası dekontunu inceledim ve resmi yevmiye defterine onayladım.', time: '12:00', avatar: 'SS', priority: 'normal' },
    { id: 5, channelId: 'shift', sender: 'Zeynep Müdür', role: 'manager', text: 'Akşam 20:00 için 8 kişilik VIP rezervasyon var (Masa 4-5 birleştirilecek). Tatlı porsiyonları kontrol edilsin.', time: '09:00', avatar: 'ZM', priority: 'urgent' },
  ]);

  const handleSendChatMessage = () => {
    if (!chatInputMsg.trim()) return;
    const newMsg = {
      id: Date.now(),
      channelId: activeChatChannel,
      sender: currentUser.name || 'Yetkili',
      role: currentUser.role || 'admin',
      text: chatInputMsg.trim(),
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      avatar: currentUser.avatar || 'GS',
      priority: chatIsUrgent ? 'urgent' : 'normal',
    };
    setChatMessages((prev) => [...prev, newMsg]);
    setChatInputMsg('');
    setChatIsUrgent(false);
    showToast('Mesaj ilgili kanala gönderildi');
  };

  const handleCreateOrderRequest = async () => {
    if (!orderModalItem) return;
    const qty = parseFloat(orderQuantity) || 0;
    if (qty <= 0) {
      showToast('Lütfen geçerli bir sipariş miktarı giriniz.');
      return;
    }

    const estimatedCost = Math.round(qty * orderModalItem.price);
    const orderTitle = `${orderModalItem.name} Malzeme Alımı (${qty} ${orderModalItem.unit})`;

    // 1. Kasa / Muhasebe ekranına bekleyen ödeme/harcama talebi olarak otomatik işle
    const newExpenseObj = {
      id: Date.now(),
      title: orderTitle,
      category: 'VARIABLE',
      subType: 'CONSUMABLES',
      amount: estimatedCost,
      period: new Date().toISOString().substring(0, 7),
      expenseDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 3 * 86400000).toISOString().split('T')[0],
      counterparty: 'Toptancı Hal / Gıda Tedarik',
      invoiceNumber: `SIP-${Date.now().toString().slice(-6)}`,
      paymentStatus: 'UNPAID',
      paidByCashier: false,
      recordedInLedger: false,
      sentToAdvisor: false,
      status: 'SENT_TO_ADVISOR',
      note: `${orderUrgent ? '⚡ [ACİL TALEP] ' : ''}${currentUser?.name || 'Mutfak'} tarafından sipariş talebi açıldı. Mevcut stok: ${orderModalItem.stock} ${orderModalItem.unit}. ${orderNote ? 'Not: ' + orderNote : ''}`,
    };

    setExpenses((prev) => [newExpenseObj, ...prev]);

    // 2. Canlı Ekip Sohbetine otomatik bildirim mesajı ilet (Mutfak, Depo, Kasa ortak takibi)
    const newChatMsg = {
      id: Date.now(),
      channelId: 'kitchen',
      sender: currentUser?.name || 'Mehmet Şef',
      role: currentUser?.role || 'chef',
      text: `Depoda ${orderModalItem.name} stoğu ${orderModalItem.stock} ${orderModalItem.unit} kaldı! ${qty} ${orderModalItem.unit} sipariş talebi açtım, kasadan ${estimatedCost.toLocaleString('tr-TR')} ₺ onay bekleniyor.`,
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      avatar: currentUser?.avatar || 'MŞ',
      priority: orderUrgent ? 'urgent' : 'normal',
    };
    setChatMessages((prev) => [...prev, newChatMsg]);

    // 3. Kasa, Muhasebe ve Depo için otomatik sistem bildirimleri
    await apiCreateNotification({
      title: orderUrgent ? `⚡ Acil Sipariş Talebi: ${orderModalItem.name}` : `📦 Yeni Sipariş Talebi: ${orderModalItem.name}`,
      message: `${currentUser?.name || 'Mutfak'} personeli ${qty} ${orderModalItem.unit} ${orderModalItem.name} için sipariş talebi oluşturdu (${estimatedCost.toLocaleString('tr-TR')} ₺). Kasa onayı bekliyor.`,
      targetRole: 'ACCOUNTANT',
      type: 'WARNING',
    });

    await apiCreateNotification({
      title: `📦 Depo: Yeni Tedarik Talebi Açıldı`,
      message: `${orderModalItem.name} için ${qty} ${orderModalItem.unit} tedarik talebi açıldı. Kasa ödemesi ardından sevkiyat masanızda listelenecektir.`,
      targetRole: 'WAREHOUSE',
      type: 'INFO',
    });

    showToast(`✓ "${orderModalItem.name}" talebi açıldı ve Kasa/Muhasebe/Depo ekranına iletildi.`);
    setOrderModalItem(null);
    setOrderQuantity('15');
    setOrderNote('');
    setOrderUrgent(false);
  };

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

  // Toplam Borç, Onay Bekleyen ve Müşavir Ret Tutarları (Gerçekçi Muhasebe & Denetim Takibi)
  const totalDebtAmount = expenses
    .filter((e) => e.paymentStatus === 'UNPAID' || e.paymentStatus === 'PARTIAL' || !e.paidByCashier)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalRejectedCount = expenses.filter((e) => e.status === 'NEEDS_CORRECTION' || e.status === 'REJECTED').length;
  const totalPendingAdvisorCount = expenses.filter(
    (e) => (e.status === 'PENDING_APPROVAL' || !e.recordedInLedger) && e.status !== 'NEEDS_CORRECTION' && e.status !== 'REJECTED' && e.status !== 'FINALIZED'
  ).length;
  const totalApprovedLedgerCount = expenses.filter((e) => e.status === 'FINALIZED' || Boolean(e.recordedInLedger)).length;

  const filteredExpenses = expenses.filter((e) => {
    let matchTab = true;
    if (expenseTab === 'fixed') matchTab = e.category === 'FIXED';
    else if (expenseTab === 'variable') matchTab = e.category === 'VARIABLE';
    else if (expenseTab === 'rent') matchTab = e.subType === 'RENT';
    else if (expenseTab === 'debt') matchTab = e.paymentStatus === 'UNPAID' || e.paymentStatus === 'PARTIAL' || !e.paidByCashier;
    else if (expenseTab === 'rejected') matchTab = e.status === 'NEEDS_CORRECTION' || e.status === 'REJECTED';
    else if (expenseTab === 'awaiting_advisor' || expenseTab === 'pending_approval') {
      matchTab = (e.status === 'PENDING_APPROVAL' || !e.recordedInLedger) && e.status !== 'NEEDS_CORRECTION' && e.status !== 'REJECTED' && e.status !== 'FINALIZED';
    } else if (expenseTab === 'ledger') matchTab = Boolean(e.recordedInLedger) || e.status === 'FINALIZED';

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

  // Mali Müşavir Defteri İçin Özel Filtrelenmiş Giderler
  const filteredAdvisorExpenses = expenses.filter((e) => {
    let matchTab = true;
    const isFinalized = e.status === 'FINALIZED' || Boolean(e.recordedInLedger);
    const isNeedsCorrection = e.status === 'NEEDS_CORRECTION' || e.status === 'REJECTED';
    const isPending = !isFinalized && !isNeedsCorrection && (e.status === 'PENDING_APPROVAL' || e.sentToAdvisor !== false);

    if (advisorTab === 'pending_approval') {
      matchTab = isPending;
    } else if (advisorTab === 'ledger') {
      matchTab = isFinalized;
    } else if (advisorTab === 'rejected') {
      matchTab = isNeedsCorrection;
    } else if (advisorTab === 'all') {
      matchTab = true;
    }

    const matchSearch =
      !advisorSearch ||
      e.title.toLowerCase().includes(advisorSearch.toLowerCase()) ||
      (e.counterparty && e.counterparty.toLowerCase().includes(advisorSearch.toLowerCase())) ||
      (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(advisorSearch.toLowerCase())) ||
      (e.note && e.note.toLowerCase().includes(advisorSearch.toLowerCase())) ||
      (e.period && e.period.includes(advisorSearch)) ||
      (e.expenseDate && e.expenseDate.includes(advisorSearch));
    return matchTab && matchSearch;
  });

  const navigateTo = (screen) => {
    if (!allowedScreens.includes(screen)) return;
    if (screen === currentScreen) return;
    setScreenStack((prev) => {
      const filtered = prev.filter((s) => s !== screen);
      return [...filtered.slice(-4), screen];
    });
    setCurrentScreen(screen);
  };

  // Android Dahili Geri Butonu (Sonsuz döngüyü önleyen, ana ekranda duran temiz navigasyon)
  const handleGoBack = () => {
    if (selectedItem) {
      setSelectedItem(null);
      return;
    }
    if (cameraActive) {
      setCameraActive(false);
      return;
    }
    const defaultScreen = getDefaultScreen(currentUser.role);
    if (screenStack.length > 1) {
      const nextStack = [...screenStack];
      nextStack.pop();
      const prev = nextStack[nextStack.length - 1];
      setScreenStack(nextStack);
      setCurrentScreen(prev);
    } else {
      setCurrentScreen(defaultScreen);
      setScreenStack([defaultScreen]);
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
      recordedInLedger: false,
      sentToAdvisor: true,
      status: 'PENDING_APPROVAL',
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
      status: 'PENDING_APPROVAL',
      rejectionReason: '',
    });
    showToast(
      isPaid
        ? `✓ Gider Kasadan Ödendi ve Onay Masasına İletildi: ${created.title}`
        : `⏳ Gider Borç/Vade Olarak İşlendi: ${created.title}`
    );
    await apiCreateExpense(created);
    await apiCreateNotification({
      title: '📋 Yeni Gider İnceleme Bekliyor (Taslak)',
      message: `${currentUser.name || 'Kasa / Muhasebe'} mobilden '${created.title} (${parseFloat(created.amount || 0).toLocaleString('tr-TR')} ₺)' kaydı girdi. Mali Müşavir onayı bekleniyor.`,
      targetRole: 'FINANCIAL_ADVISOR',
      senderName: currentUser.name || 'Kasa / Muhasebe',
      type: 'EXPENSE_APPROVAL',
      relatedEntityId: created.id,
    });
    refreshAllData();
  };

  // Kasa / Muhasebe Borç Ödeme (Kasadan fiilen öde ve borcu kapat - Web ile birebir)
  const handlePayDebtNow = async (exp) => {
    if (exp.paymentStatus === 'PAID') {
      showToast('Bu gider kalemi kasadan zaten fiilen ödenmiştir.');
      return;
    }

    const updatedNote = `${exp.note ? exp.note + ' | ' : ''}Kasa tarafından ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} itibarıyla ödendi.`;

    setExpenses((prev) =>
      prev.map((e) =>
        e.id === exp.id
          ? { ...e, paymentStatus: 'PAID', paidByCashier: true, note: updatedNote }
          : e
      )
    );
    showToast(`✓ "${exp.title}" kasadan fiilen ödendi ve borç kapatıldı.`);

    // Eğer hammadde veya tedarik alımı ise Depo ve Ekip Telsizine otomatik bilgi
    const isMaterialOrProcurement =
      exp.subType === 'CONSUMABLES' ||
      exp.subType === 'FOOD_SUPPLY' ||
      exp.category === 'VARIABLE' ||
      (exp.counterparty && (exp.counterparty.includes('Hal') || exp.counterparty.includes('Tedarik')));

    if (isMaterialOrProcurement) {
      await apiCreateNotification({
        title: '🚚 Tedarik Bedeli Ödendi — Mal Kabul Bekleniyor',
        message: `Kasa tarafından "${exp.title}" (${exp.amount ? exp.amount.toLocaleString('tr-TR') : 0} ₺) toptancıya ödendi. Depo terminalinden mal kabul edebilirsiniz.`,
        targetRole: 'WAREHOUSE',
        type: 'INFO',
        relatedEntityId: exp.id,
      });

      const autoChatMsg = {
        id: Date.now(),
        channelId: 'kitchen',
        sender: currentUser?.name || 'Canan Kasa',
        role: 'accountant',
        text: `"${exp.title}" için toptancıya ${exp.amount ? exp.amount.toLocaleString('tr-TR') : 0} ₺ nakit kasa çıkışı yapıldı ve fiilen ödendi. Sevkiyat depoya ulaştığında kabul edilebilir.`,
        time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
        avatar: currentUser?.avatar || 'CK',
        priority: 'normal',
      };
      setChatMessages((prev) => [...prev, autoChatMsg]);
    }

    await apiUpdateExpense(exp.id, {
      paymentStatus: 'PAID',
      paidByCashier: true,
      note: updatedNote,
    });
  };

  // Mali Müşavir Onaylama İşlemi (Approve & Record -> FINALIZED - Web ile birebir)
  const handleApproveExpenseLedger = async (exp) => {
    setExpenses((prev) =>
      prev.map((e) =>
        e.id === exp.id
          ? {
            ...e,
            recordedInLedger: true,
            status: 'FINALIZED',
            rejectionReason: '',
          }
          : e
      )
    );
    showToast(`✓ "${exp.title}" resmi yevmiye defterine ONAYLANDI (#YEV-${exp.id}).`);
    await apiUpdateExpense(exp.id, {
      recordedInLedger: true,
      status: 'FINALIZED',
      rejectionReason: '',
    });
    await apiCreateNotification({
      title: '✓ Gider Deftere İşlendi & Kesinleşti (Mobil)',
      message: `${currentUser.name || 'Mali Müşavir'} tarafından '${exp.title} (${exp.amount?.toLocaleString('tr-TR')} ₺)' kaydı resmi yevmiye defterine onaylandı.`,
      targetRole: 'ACCOUNTANT',
      senderName: currentUser.name || 'Mali Müşavir',
      type: 'EXPENSE_APPROVAL',
      relatedEntityId: exp.id,
    });
  };

  // Mali Müşavir Ret Modalı Açma
  const handleOpenRejectModal = (exp) => {
    setExpenseToRejectMobile(exp);
    setMobileRejectReason(exp.rejectionReason || '');
  };

  // Mali Müşavir Gerekçeli Ret İşlemini Kaydetme (Reject -> NEEDS_CORRECTION - Web ile birebir)
  const handleConfirmRejectExpense = async () => {
    if (!expenseToRejectMobile) return;
    if (!mobileRejectReason.trim()) {
      showToast('Lütfen bir ret gerekçesi girin (Örn: Fatura/dekont eksik, vergi no hatalı)');
      return;
    }

    const expId = expenseToRejectMobile.id;
    const reason = mobileRejectReason.trim();
    const title = expenseToRejectMobile.title;

    setExpenses((prev) =>
      prev.map((e) =>
        e.id === expId
          ? {
            ...e,
            recordedInLedger: false,
            status: 'NEEDS_CORRECTION',
            rejectionReason: reason,
          }
          : e
      )
    );
    showToast(`⚠️ "${title}" için düzeltme talebi muhasebeye iletildi.`);
    setExpenseToRejectMobile(null);
    setMobileRejectReason('');

    await apiUpdateExpense(expId, {
      recordedInLedger: false,
      status: 'NEEDS_CORRECTION',
      rejectionReason: reason,
    });
    await apiCreateNotification({
      title: '⚠️ Gider Düzeltme Bekliyor (Mobil)',
      message: `${currentUser.name || 'Mali Müşavir'} mobilden '${title}' kaydını reddetti. Gerekçe: "${reason}"`,
      targetRole: 'ACCOUNTANT',
      senderName: currentUser.name || 'Mali Müşavir',
      type: 'EXPENSE_REJECTED',
      relatedEntityId: expId,
    });
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
      password: newUser.password || '123456',
    };
    setUsers([...users, created]);
    setShowAddUserModal(false);
    setNewUser({ name: '', username: '', email: '', role: ROLES.CHEF, password: '123456' });
    showToast(`✓ ${t.users || 'Yeni Personel Eklendi'}: ${created.name}`);

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
  const canViewCashier = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.ACCOUNTANT;
  const canViewAdvisor = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.FINANCIAL_ADVISOR;
  const canViewAccounting = canViewCashier;
  const canViewUsers = currentUser.role === ROLES.ADMIN;
  const canViewRecipes = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.CHEF;
  const canViewInventory = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.CHEF || currentUser.role === ROLES.ACCOUNTANT || currentUser.role === ROLES.FINANCIAL_ADVISOR;
  const canViewWarehouse = currentUser.role === ROLES.ADMIN || currentUser.role === ROLES.MANAGER || currentUser.role === ROLES.WAREHOUSE;

  // Samsung, Xiaomi, Pixel vb. telefonların alt navigasyon tuşları için dinamik boşluk
  const androidBottomPadding = Math.max(insets.bottom, 16);

  return (
    <View style={styles.container}>
      {/* Sleek Minimalist Top App Bar (Status bar çakışmasını önleyen dinamik insets) */}
      <View style={[styles.topAppBar, { paddingTop: Math.max(insets.top, 8), height: 54 + Math.max(insets.top, 8) }]}>
        <View style={styles.brandRow}>
          {(screenStack.length > 1 || selectedItem || cameraActive) ? (
            <TouchableOpacity style={styles.androidBackBtn} onPress={handleGoBack} activeOpacity={0.7}>
              <Text style={styles.androidBackArrow}>←</Text>
              <Text style={styles.androidBackLabel}>{t.goBack || 'Geri'}</Text>
            </TouchableOpacity>
          ) : (
            <View style={styles.logoBadge}>
              <Text style={styles.logoText}>GS</Text>
            </View>
          )}
          <Text style={styles.appBarTitle} numberOfLines={1}>
            {screenStack.length > 1 ? '' : (t.appName || 'GastroSync')}
          </Text>
        </View>

        {/* Minimalist Kullanıcı Bilgisi & İkon Grubu */}
        <View style={styles.headerUserGroup}>
          {/* Tek Dokunuş Şirket Dili Seçici */}
          <TouchableOpacity
            style={{
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 14,
              paddingHorizontal: 6,
              height: 30,
              justifyContent: 'center',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: 'rgba(255, 255, 255, 0.15)',
              flexDirection: 'row',
              gap: 3,
            }}
            onPress={() => setShowLangModal(true)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 13 }}>
              {currentLang === 'en' ? '🇬🇧' : currentLang === 'de' ? '🇩🇪' : currentLang === 'ar' ? '🇸🇦' : '🇹🇷'}
            </Text>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#ffffff', textTransform: 'uppercase' }}>
              {currentLang}
            </Text>
          </TouchableOpacity>

          {/* Ekip İçi Anlık Sohbet Butonu */}
          <TouchableOpacity
            style={{
              position: 'relative',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 16,
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setShowTeamChatModal(true)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15 }}>💬</Text>
            {chatMessages.filter((m) => m.priority === 'urgent').length > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  backgroundColor: '#f59e0b',
                  borderRadius: 6,
                  minWidth: 14,
                  height: 14,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 2,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>
                  {chatMessages.filter((m) => m.priority === 'urgent').length}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Bildirim Zili & Sayacı */}
          <TouchableOpacity
            style={{
              position: 'relative',
              backgroundColor: 'rgba(255, 255, 255, 0.1)',
              borderRadius: 16,
              width: 32,
              height: 32,
              justifyContent: 'center',
              alignItems: 'center',
            }}
            onPress={() => setShowNotifModal(true)}
            activeOpacity={0.7}
          >
            <Text style={{ fontSize: 15 }}>🔔</Text>
            {unreadNotifCount > 0 && (
              <View
                style={{
                  position: 'absolute',
                  top: -2,
                  right: -2,
                  backgroundColor: '#ef4444',
                  borderRadius: 6,
                  minWidth: 14,
                  height: 14,
                  justifyContent: 'center',
                  alignItems: 'center',
                  paddingHorizontal: 2,
                }}
              >
                <Text style={{ color: '#fff', fontSize: 8, fontWeight: '900' }}>
                  {unreadNotifCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Kompakt Rol Avatar Rozeti */}
          <View style={[styles.fixedRoleBadge, { backgroundColor: ROLE_COLORS[currentUser.role], paddingHorizontal: 7, paddingVertical: 4 }]}>
            <Text style={styles.roleAvatar}>{currentUser.avatar}</Text>
          </View>

          {/* Çıkış İkon Butonu */}
          <TouchableOpacity
            style={[styles.logoutBtn, { paddingHorizontal: 6, paddingVertical: 5 }]}
            onPress={onLogout}
            activeOpacity={0.7}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.logoutIcon}>⎋</Text>
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
                <Text style={styles.webHeroPillTxt}>{t.heroBadge || 'RESTORAN İŞLETİM & MALİYET ZEKASI'}</Text>
              </View>
              <Text style={styles.webHeroTitle}>{t.heroTitle || 'Akıllı Reçete & Karlılık Motoru'}</Text>
              <Text style={styles.webHeroDesc}>
                {t.heroDesc || 'Canlı POS satışları, anlık gramaj ve depocu mal kabul faturalarıyla tam senkronize.'}
              </Text>
              <View style={styles.webHeroBadgesRow}>
                <View style={styles.webHeroStatBadge}>
                  <Text style={styles.webHeroStatNum}>%68.4</Text>
                  <Text style={styles.webHeroStatLbl}>{t.heroAvgGrossMargin ? t.heroAvgGrossMargin.toUpperCase() : 'BRÜT KÂR'}</Text>
                </View>
                <View style={[styles.webHeroStatBadge, { backgroundColor: '#ecfdf5', borderColor: '#a7f3d0' }]}>
                  <Text style={[styles.webHeroStatNum, { color: '#065f46' }]}>Tier A</Text>
                  <Text style={styles.webHeroStatLbl}>{t.efficiency ? t.efficiency.toUpperCase() : 'VERİMLİLİK'}</Text>
                </View>
              </View>
            </View>

            {/* Web 4'lü KPI Metrik Kartları (dashboard-metrics) */}
            <View style={styles.webMetricsGrid}>
              <View style={styles.webMetricCard}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel}>{t.todaySalesRevenue || 'Bugünkü Ciro (POS)'}</Text>
                  <Text style={styles.webMetricIcon}>💰</Text>
                </View>
                <Text style={styles.webMetricValue}>{INITIAL_SALES_SUMMARY.totalRevenue.toLocaleString('tr-TR')} ₺</Text>
                <Text style={styles.webMetricChange}>▲ {t.moreThanYesterday || '%12.5 dünden fazla'}</Text>
              </View>

              <View style={styles.webMetricCard}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel}>{t.actualFoodCost || 'Gıda Maliyeti'}</Text>
                  <Text style={styles.webMetricIcon}>📦</Text>
                </View>
                <Text style={styles.webMetricValue}>{INITIAL_SALES_SUMMARY.totalCost.toLocaleString('tr-TR')} ₺</Text>
                <Text style={styles.webMetricSubTxt}>{t.autoDeductedStock || 'Otomatik düşülen stok'}</Text>
              </View>

              <View style={styles.webMetricCard}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel}>{t.averageFoodCost || 'Ortalama Food Cost'}</Text>
                  <Text style={styles.webMetricIcon}>🎯</Text>
                </View>
                <Text style={[styles.webMetricValue, { color: '#047857' }]}>%{INITIAL_SALES_SUMMARY.foodCostPercent}</Text>
                <Text style={styles.webMetricSubTxt}>{t.aboveTargetFoodCost ? t.aboveTargetFoodCost.replace('{target}', '28.0') : 'Hedef: %28.0 altında'}</Text>
              </View>

              <View style={styles.webMetricCard}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel}>{t.criticalStockStat || 'Kritik Stok Uyarısı'}</Text>
                  <Text style={styles.webMetricIcon}>⚠️</Text>
                </View>
                <Text style={[styles.webMetricValue, { color: '#f59e0b' }]}>
                  {items.filter((i) => i.stock <= i.min).length} {t.productNameCol ? t.productNameCol.split(' ')[0] : 'Ürün'}
                </Text>
                <Text style={styles.webMetricSubTxt}>{t.statusCritical || 'Kritik Seviye'}</Text>
              </View>
            </View>

            <Text style={styles.subHeading}>{t.filters ? t.filters.toUpperCase() : 'MODÜL KISAYOLLARI'}</Text>
            <View style={styles.shortcutGrid}>
              {(allowedScreens.includes('cashier') || allowedScreens.includes('accounting')) && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('cashier')}>
                  <Text style={styles.shortcutIcon}>💰</Text>
                  <Text style={styles.shortcutTxt}>{t.cashierAccounting || 'Kasa & Muhasebe'}</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('advisor') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('advisor')}>
                  <Text style={styles.shortcutIcon}>📖</Text>
                  <Text style={styles.shortcutTxt}>{t.advisorLedger || 'Mali Müşavir'}</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('inventory') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('inventory')}>
                  <Text style={styles.shortcutIcon}>📦</Text>
                  <Text style={styles.shortcutTxt}>{t.inventory || 'Stok Yönetimi'}</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('recipes') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('recipes')}>
                  <Text style={styles.shortcutIcon}>📖</Text>
                  <Text style={styles.shortcutTxt}>{t.recipes || 'Reçete Merkezi'}</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('sales') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('sales')}>
                  <Text style={styles.shortcutIcon}>📊</Text>
                  <Text style={styles.shortcutTxt}>{t.sales || 'Satış Analizi'}</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('warehouse') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('warehouse')}>
                  <Text style={styles.shortcutIcon}>📦</Text>
                  <Text style={styles.shortcutTxt}>{t.warehouse || 'Depo & Mal Kabul'}</Text>
                </TouchableOpacity>
              )}
              {allowedScreens.includes('users') && (
                <TouchableOpacity style={styles.shortcutBtn} onPress={() => navigateTo('users')}>
                  <Text style={styles.shortcutIcon}>👥</Text>
                  <Text style={styles.shortcutTxt}>{t.users || 'Kullanıcı Yönetimi'}</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}

        {/* 2. EKRAN: STOK YÖNETİMİ (Inventory - Web ile Birebir) */}
        {currentScreen === 'inventory' && canViewInventory && (
          <View>
            <View style={styles.screenHeader}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.titleText} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {t.inventory || 'Stok Yönetimi'}
                </Text>
                <Text style={styles.descText} numberOfLines={1} ellipsizeMode="tail">
                  {t.autoThresholdControl || 'Tüm envanter ve kritik eşikler'}
                </Text>
              </View>
            </View>

            {/* Web Mini-Stats Bar */}
            <View style={styles.webMiniStatsRow}>
              <View style={styles.webMiniStatCard}>
                <Text style={styles.webMiniStatVal}>{items.length}</Text>
                <Text style={styles.webMiniStatLbl}>{t.totalProductsStat || 'Toplam Ürün'}</Text>
              </View>
              <View style={[styles.webMiniStatCard, { borderColor: '#fed7aa' }]}>
                <Text style={[styles.webMiniStatVal, { color: '#f59e0b' }]}>
                  {items.filter((i) => i.stock <= i.min).length}
                </Text>
                <Text style={styles.webMiniStatLbl}>{t.criticalStockStat || 'Kritik Stok'}</Text>
              </View>
              <View style={styles.webMiniStatCard}>
                <Text style={[styles.webMiniStatVal, { color: '#047857' }]}>
                  {Math.round(items.reduce((s, i) => s + i.stock * i.price, 0) / 1000)}k ₺
                </Text>
                <Text style={styles.webMiniStatLbl}>{t.totalInventoryValueStat || 'Envanter Değeri'}</Text>
              </View>
            </View>

            {/* Web Toolbar */}
            <View style={styles.webFilterBar}>
              <TextInput
                style={styles.webSearchInput}
                placeholder={t.searchInventoryPlaceholder || '🔍 Ürün adı veya barkod ile arayın...'}
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
                      {c === 'all' ? (t.allCategories || 'Tüm Kategoriler') : getCategoryLabel(c, currentLang)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.webFilterCountRow}>
                <Text style={styles.webFilterCountTxt}>
                  {t.recordsListed || 'Listelenen'}: <Text style={{ fontWeight: '800', color: THEME.colors.primary }}>{filteredItems.length}</Text> / {items.length} {t.productNameCol ? t.productNameCol.split(' ')[0].toLowerCase() : 'ürün'}
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
                        <Text style={styles.webItemBarcode}>{t.barcodeCol || 'Barkod'}: {it.barcode || 'Belirtilmedi'}</Text>
                      </View>
                      <View style={styles.webCategoryBadge}>
                        <Text style={styles.webCategoryBadgeTxt}>{getCategoryLabel(it.cat, currentLang) || 'Genel'}</Text>
                      </View>
                    </View>

                    {/* Middle Metrics: Stok, Min. Stok, Birim Fiyat, Toplam Değer */}
                    <View style={styles.webItemMetricsRow}>
                      <View style={styles.webItemMetricCol}>
                        <Text style={styles.webItemMetricLbl}>{t.stockCol || 'Mevcut Stok'}</Text>
                        <Text style={[styles.webItemMetricVal, isAlert && { color: '#dc2626' }]}>
                          {it.stock} {it.unit}
                        </Text>
                      </View>
                      <View style={styles.webItemMetricCol}>
                        <Text style={styles.webItemMetricLbl}>{t.minStockCol || 'Min. Stok'}</Text>
                        <Text style={styles.webItemMetricVal}>{it.min} {it.unit}</Text>
                      </View>
                      <View style={styles.webItemMetricCol}>
                        <Text style={styles.webItemMetricLbl}>{t.unitPriceCol || 'Birim Fiyat'}</Text>
                        <Text style={styles.webItemMetricVal}>{it.price.toFixed(2)} ₺</Text>
                      </View>
                      <View style={styles.webItemMetricCol}>
                        <Text style={styles.webItemMetricLbl}>{t.totalValueCol || 'Toplam Değer'}</Text>
                        <Text style={[styles.webItemMetricVal, { color: '#047857' }]}>
                          {totalValue.toLocaleString('tr-TR')} ₺
                        </Text>
                      </View>
                    </View>

                    {/* Bottom Status Row: Web ile Birebir Tier A / Kritik Rozeti & Satınalma Talebi */}
                    <View style={styles.webItemStatusRow}>
                      <View>
                        {isAlert ? (
                          <View style={styles.webCriticalBadge}>
                            <Text style={{ fontSize: 10 }}>⚠️</Text>
                            <Text style={styles.webCriticalTxt}>{t.statusCritical || 'Kritik Stok'}</Text>
                          </View>
                        ) : (
                          <View style={styles.webTierBadge}>
                            <View style={styles.webTierDot} />
                            <Text style={styles.webTierTxt}>{t.statusSufficient || 'Tier A • Yeterli'}</Text>
                          </View>
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>
                        {t.supplier || 'Tedarikçi'}: <Text style={{ fontWeight: '700', color: '#334155' }}>{it.supplier || 'Standart'}</Text>
                      </Text>
                    </View>

                    {/* Web ile Birebir Hızlı Aksiyon Satırı: Sipariş Talebi Aç */}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 10, paddingTop: 8, borderTopWidth: 1, borderTopColor: '#f1f5f3' }}>
                      <TouchableOpacity
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          justifyContent: 'center',
                          gap: 6,
                          backgroundColor: '#ecfdf5',
                          borderRadius: 8,
                          paddingVertical: 9,
                          borderWidth: 1,
                          borderColor: '#a7f3d0',
                        }}
                        onPress={() => {
                          setOrderModalItem(it);
                          setOrderQuantity('15');
                          setOrderNote('');
                          setOrderUrgent(isAlert);
                        }}
                      >
                        <Text style={{ fontSize: 13 }}>🛒</Text>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#047857' }}>
                          {t.orderModalItem || 'Sipariş Talebi Aç'}
                        </Text>
                      </TouchableOpacity>
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
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.webPageTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {t.recipes || 'Reçete Merkezi'}
                </Text>
                <Text style={styles.webPageSub} numberOfLines={1} ellipsizeMode="tail">
                  {t.recipesAndKitchen || 'Mutfak şefi gramaj ve maliyet analizi'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.webBtnPrimary, { flexShrink: 0 }]}
                onPress={() => setShowAddRecipeModal(true)}
                activeOpacity={0.8}
              >
                <Text style={styles.webBtnPrimaryTxt} numberOfLines={1}>
                  {t.addNewRecipe || '+ Yeni Reçete'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Web Toolbar */}
            <View style={styles.webFilterBar}>
              <TextInput
                style={styles.webSearchInput}
                placeholder={t.searchRecipePlaceholder || '🔍 Reçete veya yemek adı ara...'}
                placeholderTextColor={THEME.colors.textLight}
                value={recipeSearch}
                onChangeText={setRecipeSearch}
              />
              <View style={styles.webFilterCountRow}>
                <Text style={styles.webFilterCountTxt}>
                  {t.recordsListed || 'Listelenen'}: <Text style={{ fontWeight: '800', color: THEME.colors.primary }}>{filteredRecipes.length}</Text> / {recipes.length} {t.recipes ? t.recipes.toLowerCase() : 'reçete'}
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
                      <Text style={styles.webRecipeCategory}>{getCategoryLabel(r.category, currentLang)}</Text>
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
                      <Text style={styles.webRecipeStatLbl}>{t.costLabel || 'Maliyet'}</Text>
                      <Text style={styles.webRecipeStatVal}>{r.cost.toFixed(2)} ₺</Text>
                    </View>
                    <View style={styles.webRecipeStatCol}>
                      <Text style={styles.webRecipeStatLbl}>{t.saleLabel || 'Satış Fiyatı'}</Text>
                      <Text style={[styles.webRecipeStatVal, { fontWeight: '900', color: THEME.colors.primary }]}>
                        {r.salePrice.toFixed(2)} ₺
                      </Text>
                    </View>
                    <View style={styles.webRecipeStatCol}>
                      <Text style={styles.webRecipeStatLbl}>{t.profitCol || 'Kâr'}</Text>
                      <Text style={[styles.webRecipeStatVal, { color: '#047857' }]}>
                        +{profit.toFixed(2)} ₺
                      </Text>
                    </View>
                  </View>

                  {/* Malzemeler ve Gramajlar */}
                  <View style={styles.webRecipeIngBox}>
                    <Text style={styles.webRecipeIngHead}>{t.ingredientsTitle || 'Reçete Gramajları'} (1 {t.portionCol || 'Porsiyon'}):</Text>
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
                      <Text style={styles.webRecipeEditTxt}>✏️ {t.edit || 'Düzenle'}</Text>
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
                      <Text style={styles.webRecipeDeleteTxt}>🗑️ {t.delete || 'Sil'}</Text>
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
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.webPageTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {t.sales || 'Satış Analizi'}
                </Text>
                <Text style={styles.webPageSub} numberOfLines={1} ellipsizeMode="tail">
                  {t.posSalesToday || 'POS canlı satış verileri ve ciro dökümü'}
                </Text>
              </View>
            </View>

            {/* Web Mini-Stats */}
            <View style={styles.webMiniStatsRow}>
              <View style={styles.webMiniStatCard}>
                <Text style={[styles.webMiniStatVal, { color: THEME.colors.primary }]}>
                  {INITIAL_SALES_SUMMARY.totalRevenue.toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMiniStatLbl}>{t.totalRevenueStat || 'Toplam Ciro'}</Text>
              </View>
              <View style={[styles.webMiniStatCard, { borderColor: '#bbf7d0' }]}>
                <Text style={[styles.webMiniStatVal, { color: '#047857' }]}>
                  {INITIAL_SALES_SUMMARY.netProfit.toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMiniStatLbl}>{t.netProfitStat || 'Net Kâr'}</Text>
              </View>
              <View style={styles.webMiniStatCard}>
                <Text style={styles.webMiniStatVal}>{INITIAL_SALES_ITEMS.length}</Text>
                <Text style={styles.webMiniStatLbl}>{t.salesItemsStat || 'Satış Kalemi'}</Text>
              </View>
            </View>

            <Text style={styles.subHeading}>{t.productProfitHeader ? t.productProfitHeader.toUpperCase() : 'GÜNLÜK ÜRÜN SATIŞLARI'}</Text>
            {INITIAL_SALES_ITEMS.map((item) => {
              const itemProfit = item.revenue - item.cost;
              return (
                <View key={item.id} style={styles.webSalesCard}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.itemTitle}>{item.name}</Text>
                    <Text style={styles.itemMeta}>{item.qty} {t.portionCol || 'Porsiyon'} • Food Cost %{item.foodCost}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={styles.salesRevBold}>{item.revenue.toLocaleString('tr-TR')} ₺</Text>
                    <Text style={[styles.itemMeta, { color: '#047857', fontWeight: '700' }]}>
                      +{t.profitCol || 'Kâr'}: {itemProfit.toLocaleString('tr-TR')} ₺
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
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.webPageTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {t.warehouse || 'Depo & Mal Kabul'}
                </Text>
                <Text style={styles.webPageSub} numberOfLines={1} ellipsizeMode="tail">
                  {t.manualEntry || 'Manuel barkod / ürün girişi, mal kabul & zayiat'}
                </Text>
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
                <Text style={styles.webWhActionTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {t.goodsReceipt || 'Mal Kabul'}
                </Text>
                <Text style={styles.webWhActionSub} numberOfLines={1} ellipsizeMode="tail">
                  {t.manualEntry || 'Manuel Giriş'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.webWhActionBtnLarge, { backgroundColor: '#dc2626' }]}
                onPress={() => {
                  if (items.length > 0) setSelectedItem(items[0]);
                }}
                activeOpacity={0.8}
              >
                <Text style={styles.webWhActionIcon}>⚠️</Text>
                <Text style={styles.webWhActionTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {t.reportWaste || 'Zayiat Bildir'}
                </Text>
                <Text style={styles.webWhActionSub} numberOfLines={1} ellipsizeMode="tail">
                  {t.wasteRecord || 'Fire Kaydı'}
                </Text>
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
                <Text style={styles.webWhActionTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                  {t.newItem || 'Yeni Ürün'}
                </Text>
                <Text style={styles.webWhActionSub} numberOfLines={1} ellipsizeMode="tail">
                  {t.warehouse || 'Depoya Ekle'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Manuel Barkod Kartı (Kamerasız - Klavyeden Elle Giriş) */}
            <View style={styles.webSearchCard}>
              <Text style={styles.cardHeaderSmall}>{t.manualEntry || 'Manuel Ürün Arama'} ({t.barcodeCol || 'Barkod'}):</Text>
              <TextInput
                style={styles.inputBox}
                placeholder={t.searchInventoryPlaceholder || 'Barkod numarası veya ürün adı girin...'}
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
                <Text style={styles.btnManualSubmitTxt}>{t.confirm || 'Ürünü Getir'}</Text>
              </TouchableOpacity>
            </View>

            {selectedItem && (
              <View style={styles.selectedActionCard}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={styles.itemTitle}>{selectedItem.name}</Text>
                  <TouchableOpacity style={styles.inlineBackBtn} onPress={() => setSelectedItem(null)}>
                    <Text style={styles.inlineBackBtnTxt}>✕ {t.cancel || 'Kapat'}</Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.itemMeta}>{t.barcodeCol || 'Barkod'}: {selectedItem.barcode || 'Yok'}</Text>
                <Text style={styles.stockStatusBig}>
                  {t.stockCol || 'Mevcut Stok'}: {selectedItem.stock} {selectedItem.unit} ({t.minStockCol || 'Min'}: {selectedItem.min})
                </Text>

                <TextInput
                  style={[styles.inputBox, { marginTop: 12 }]}
                  placeholder={`${t.quantity || 'Miktar'} (${selectedItem.unit})`}
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
                    <Text style={styles.actionBtnItemTxt}>+ {t.goodsReceipt || 'Mal Kabul Et'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtnItem, { backgroundColor: '#dc2626' }]}
                    onPress={() => handleStockAction(false)}
                  >
                    <Text style={styles.actionBtnItemTxt}>⚠️ {t.reportWaste || 'Zayiat / Fire'}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}

            {/* Web Birebir: Son İşlemler (Bugün) Kutusu */}
            <View style={styles.webTxBox}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.webTxTitle, { flex: 1, marginRight: 8 }]} numberOfLines={1} ellipsizeMode="tail">
                  📋 {t.timelineSalesHeader || 'Son İşlemler (Bugün)'}
                </Text>
                <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, flexShrink: 0 }}>
                  <Text style={{ fontSize: 9, color: '#475569', fontWeight: '800' }}>
                    {t.liveMonitoring || 'Canlı İzleme'}
                  </Text>
                </View>
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
                          {tx.recordedBy} • {tx.note ? tx.note : (tx.type === 'receive' ? (t.goodsReceipt || 'Mal Kabul') : (t.reportWaste || 'Zayiat'))}
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
                  {t.noNotifications || 'Bugün henüz depo hareketi kaydedilmedi.'}
                </Text>
              )}
            </View>
          </View>
        )}

        {/* 6. EKRAN: KULLANICI YÖNETİMİ (Users - Web ile Birebir) */}
        {currentScreen === 'users' && canViewUsers && (
          <View>
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <View style={{ flex: 1, minWidth: 150 }}>
                  <Text style={styles.webPageTitle} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
                    {t.users || 'Kullanıcı Yönetimi'}
                  </Text>
                  <Text style={styles.webPageSub} numberOfLines={1} ellipsizeMode="tail">
                    {t.roleAdmin || 'Personel hesapları ve yetki matrisi'}
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.webBtnPrimary, { paddingVertical: 8, paddingHorizontal: 12, minHeight: 38, justifyContent: 'center' }]}
                  onPress={() => setShowAddUserModal(true)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.webBtnPrimaryTxt}>+ {t.users || 'Yeni Personel'}</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Web Toolbar */}
            <View style={styles.webFilterBar}>
              <TextInput
                style={styles.webSearchInput}
                placeholder={t.search || '🔍 Personel adı, e-posta veya kullanıcı adı ara...'}
                placeholderTextColor={THEME.colors.textLight}
                value={usersSearch}
                onChangeText={setUsersSearch}
              />
              <View style={styles.webFilterCountRow}>
                <Text style={styles.webFilterCountTxt}>
                  {t.recordsListed || 'Listelenen'}: <Text style={{ fontWeight: '800', color: THEME.colors.primary }}>{filteredUsers.length}</Text> / {users.length} {t.users ? t.users.toLowerCase() : 'personel'}
                </Text>
              </View>
            </View>

            {/* Web Style User Cards (Kullanıcı Kartları - Taşmayı ve Sıkışmayı Önleyen Esnek Düzen) */}
            {filteredUsers.map((u) => (
              <View key={u.id} style={styles.webUserCard}>
                <View style={styles.webUserTopRow}>
                  <View style={[styles.webUserAvatar, { backgroundColor: ROLE_COLORS[u.role] }]}>
                    <Text style={styles.webUserAvatarTxt}>{u.avatar}</Text>
                  </View>
                  <View style={{ flex: 1, paddingHorizontal: 4 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 4 }}>
                      <Text style={styles.webUserName} numberOfLines={1}>{u.name}</Text>
                      <View style={[styles.webRolePill, { backgroundColor: ROLE_COLORS[u.role] + '18', borderColor: ROLE_COLORS[u.role] }]}>
                        <Text style={[styles.webRolePillTxt, { color: ROLE_COLORS[u.role] }]}>
                          {getRoleLabel(u.role, currentLang)}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.webUserEmail} numberOfLines={1}>✉️ {u.email}</Text>
                    <Text style={styles.webUserUname}>@{u.username}</Text>
                  </View>
                </View>

                {/* Module description from web */}
                <View style={styles.webUserModuleBox}>
                  <Text style={styles.webUserModuleLabel}>{t.status || 'Erişim Modülleri'}:</Text>
                  <Text style={styles.webUserModuleTxt}>{ROLE_MODULES[u.role] || 'Yetkilendirilmiş restoran modülleri'}</Text>
                </View>

                <View style={styles.webUserCardFooter}>
                  <Text style={styles.webUserStatusTxt}>{t.status || 'Durum'}: {t.statusProfitable || 'Aktif Oturum'}</Text>
                  {currentUser.role === ROLES.ADMIN && u.username !== 'admin' && (
                    <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                      <TouchableOpacity
                        style={[styles.webUserDismissBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                        onPress={() => setEditingUserRole(u)}
                      >
                        <Text style={[styles.webUserDismissTxt, { color: '#1d4ed8' }]}>🛡️ {t.edit || 'Rol Değiştir'}</Text>
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
                        <Text style={styles.webUserDismissTxt}>🗑️ {t.delete || 'Görevden Al'}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}

        {/* 7. EKRAN: KASA & MUHASEBE (Cashier - Web /cashier ile Birebir) */}
        {(currentScreen === 'cashier' || (currentScreen === 'accounting' && !isAdvisorUser)) && canViewCashier && (
          <View>
            <View style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <View style={{ flex: 1, minWidth: 140 }}>
                  <Text
                    style={[styles.webPageTitle, { fontSize: 18 }]}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.85}
                  >
                    💰 {t.cashierAccounting || 'Kasa & Muhasebe'}
                  </Text>
                  <Text style={[styles.webPageSub, { fontSize: 11, marginTop: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                    {t.accountingSubHeader || 'Restoran nakit akışı, sabit & değişken maliyetler ve gider ödemeleri'}
                  </Text>
                </View>

                <View style={{ flexDirection: 'row', gap: 6 }}>
                  <TouchableOpacity
                    style={[styles.webBtnPrimary, { backgroundColor: '#047857', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 }]}
                    onPress={() => setShowAddExpenseModal(true)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.webBtnPrimaryTxt, { fontSize: 11 }]}>+ {t.newExpense || 'Yeni Gider'}</Text>
                  </TouchableOpacity>
                </View>
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
              <View style={{ flex: 1, paddingRight: 6 }}>
                <Text
                  style={{ fontSize: 10, fontWeight: '800', color: '#166534', textTransform: 'uppercase' }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  💵 {t.dailyRevenue || 'GÜNLÜK KASA CİROSU (GELİR)'}
                </Text>
                <Text
                  style={{ fontSize: 18, fontWeight: '900', color: '#14532d', marginTop: 1 }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {totalRevenue.toLocaleString('tr-TR')} ₺
                </Text>
                <Text
                  style={{ fontSize: 10, color: '#15803d', marginTop: 2 }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {t.posSalesToday || 'Restoran adisyon & POS tahsilatları'}
                </Text>
              </View>
              <View style={{ flex: 1, alignItems: 'flex-end', paddingLeft: 6 }}>
                <Text
                  style={{ fontSize: 10, fontWeight: '800', color: netOperatingProfit >= 0 ? '#166534' : '#991b1b', textTransform: 'uppercase' }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.8}
                >
                  {t.operatingProfit || 'GÜNLÜK NET İŞLETME KÂRI'}
                </Text>
                <Text
                  style={{ fontSize: 18, fontWeight: '900', color: netOperatingProfit >= 0 ? '#15803d' : '#b91c1c', marginTop: 1 }}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                >
                  {netOperatingProfit >= 0 ? `+${netOperatingProfit.toLocaleString('tr-TR')}` : netOperatingProfit.toLocaleString('tr-TR')} ₺
                </Text>
                <Text
                  style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  {t.revenueMinusCosts || 'Gelir - Toplam İşletme Gideri'}
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
                <Text
                  style={{ flex: 1, marginRight: 8, fontSize: 12, fontWeight: '900', color: '#0f172a' }}
                  numberOfLines={1}
                  ellipsizeMode="tail"
                >
                  🧭 {t.rubrikTitleShort || t.rubrikTitle || 'Finansal Rubrik Soruları'}
                </Text>
                <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#a7f3d0', flexShrink: 0 }}>
                  <Text style={{ fontSize: 10, fontWeight: '800', color: '#047857' }}>{t.rubrikScore || 'Rubrik'}: A+</Text>
                </View>
              </View>

              <View style={{ gap: 6 }}>
                <View style={{ backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e293b' }}>
                    ❓ {t.rubrikQ1 || 'Bugün ne satıldı ve ne kadar gelir sağlandı?'}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 2 }}>
                    ✓ {t.rubrikA1 || 'Kasaya'} {totalRevenue.toLocaleString('tr-TR')} ₺ {t.rubrikA1Suffix || 'ciro girdi.'} ({INITIAL_SALES_ITEMS[0]?.name || 'Izgara Köfte'})
                  </Text>
                </View>

                <View style={{ backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e293b' }}>
                    ❓ {t.rubrikQ2 || 'Gerçek net kâr ve hammadde maliyeti nedir?'}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#059669', marginTop: 2 }}>
                    ✓ {t.rubrikA2 || 'Brüt kâr'} {(totalRevenue - foodCostTotal).toLocaleString('tr-TR')} ₺, {t.operatingProfit || 'Faaliyet Kârı'} {netOperatingProfit.toLocaleString('tr-TR')} ₺.
                  </Text>
                </View>

                <View style={{ backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e293b' }}>
                    ❓ {t.rubrikQ3 || 'Kasada bekleyen borçlar ve vadeli harcamalar ne durumda?'}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#dc2626', marginTop: 2 }}>
                    ✓ {t.rubrikA3 || 'Toplam'} {totalDebtAmount.toLocaleString('tr-TR')} ₺ {t.rubrikA3Suffix || 'vadesi bekleyen borç var.'}
                  </Text>
                </View>

                <View style={{ backgroundColor: '#f8fafc', padding: 8, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0' }}>
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e293b' }}>
                    ❓ {t.rubrikQ4 || 'Mali Müşavir denetiminde reddedilen veya bekleyen var mı?'}
                  </Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#047857', marginTop: 2 }}>
                    ✓ {expenses.filter(e => e.recordedInLedger).length} {t.rubrikA4Ledger || 'Kalem deftere işlendi,'} {totalRejectedCount} {t.rubrikA4Rejected || 'Kalem reddedildi.'}
                  </Text>
                </View>
              </View>
            </View>

            {/* 4'lü Gerçek Toplam Maliyet Özet Metrik Kartları */}
            <View style={styles.webMetricsGrid}>
              <View style={[styles.webMetricCard, { borderColor: '#bbf7d0' }]}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel} numberOfLines={2} ellipsizeMode="tail">1. {t.rawMaterialCost || 'Hammadde / Gıda'}</Text>
                  <Text style={styles.webMetricIcon}>🥩</Text>
                </View>
                <Text style={[styles.webMetricValue, { color: '#059669' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {foodCostTotal.toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMetricSubTxt} numberOfLines={1} ellipsizeMode="tail">{t.recipesAndKitchen || 'Reçete & Depo Çıkışları'}</Text>
              </View>

              <View style={[styles.webMetricCard, { borderColor: '#bfdbfe' }]}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel} numberOfLines={2} ellipsizeMode="tail">2. {t.fixedExpenses || 'Sabit Giderler'}</Text>
                  <Text style={styles.webMetricIcon}>🏢</Text>
                </View>
                <Text style={[styles.webMetricValue, { color: '#2563eb' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {fixedExpensesTotal.toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMetricSubTxt} numberOfLines={1} ellipsizeMode="tail">{t.fixedCommitments || 'Kira, Maaş, Mali Müşavir'}</Text>
              </View>

              <View style={[styles.webMetricCard, { borderColor: '#fde68a' }]}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel} numberOfLines={2} ellipsizeMode="tail">3. {t.variableExpenses || 'Değişken Giderler'}</Text>
                  <Text style={styles.webMetricIcon}>⚡</Text>
                </View>
                <Text style={[styles.webMetricValue, { color: '#d97706' }]} numberOfLines={1} adjustsFontSizeToFit>
                  {variableExpensesTotal.toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMetricSubTxt} numberOfLines={1} ellipsizeMode="tail">{t.usageAndOps || 'Fatura, SGK, Vergi, Sarf'}</Text>
              </View>

              <View style={[styles.webMetricCard, { borderColor: '#a7f3d0', backgroundColor: '#f0fdf4' }]}>
                <View style={styles.webMetricHeader}>
                  <Text style={[styles.webMetricLabel, { color: '#065f46' }]} numberOfLines={2} ellipsizeMode="tail">{t.grandOperatingCost || 'Toplam İşletme Maliyeti'}</Text>
                  <Text style={styles.webMetricIcon}>💼</Text>
                </View>
                <Text style={[styles.webMetricValue, { color: '#047857', fontSize: 17 }]} numberOfLines={1} adjustsFontSizeToFit>
                  {grandTotalCost.toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={[styles.webMetricSubTxt, { color: '#047857' }]} numberOfLines={1} ellipsizeMode="tail">
                  {t.rawPlusFplusV || 'Gıda + Sabit + Değişken'}
                </Text>
              </View>
            </View>

            {/* Gider Kategori Dağılım & Borç Takip Kartları */}
            {/* Gider Kategori Dağılım, Borç & Müşavir Onay Takip Kartları */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={[styles.webMiniStatCard, { flex: 1, borderLeftWidth: 4, borderLeftColor: '#ef4444', padding: 8 }]}>
                <Text style={[styles.webMiniStatVal, { color: '#dc2626', fontSize: 13 }]} numberOfLines={1} adjustsFontSizeToFit>{totalDebtAmount.toLocaleString('tr-TR')} ₺</Text>
                <Text style={[styles.webMiniStatLbl, { fontSize: 10 }]} numberOfLines={1} ellipsizeMode="tail">⏳ {t.unpaidDebt || 'Bekleyen Borç'}</Text>
              </View>
              <View style={[styles.webMiniStatCard, { flex: 1, borderLeftWidth: 4, borderLeftColor: '#d97706', padding: 8 }]}>
                <Text style={[styles.webMiniStatVal, { color: '#d97706', fontSize: 13 }]} numberOfLines={1} adjustsFontSizeToFit>{totalPendingAdvisorCount} {t.portionCol || 'Adet'}</Text>
                <Text style={[styles.webMiniStatLbl, { fontSize: 10 }]} numberOfLines={1} ellipsizeMode="tail">✍️ {t.awaitingApprovalBadge || 'Müşavir Onayında'}</Text>
              </View>
              <View style={[styles.webMiniStatCard, { flex: 1, borderLeftWidth: 4, borderLeftColor: '#b91c1c', padding: 8 }]}>
                <Text style={[styles.webMiniStatVal, { color: '#b91c1c', fontSize: 13 }]} numberOfLines={1} adjustsFontSizeToFit>{totalRejectedCount} {t.portionCol || 'Adet'}</Text>
                <Text style={[styles.webMiniStatLbl, { fontSize: 10 }]} numberOfLines={1} ellipsizeMode="tail">⚠️ {t.rejectedBadge || 'Düzeltme İstendi'}</Text>
              </View>
            </View>

            {/* Kasa & Muhasebe Sekmeleri */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.catFilterChip, expenseTab === 'all' && styles.catFilterChipActive]}
                  onPress={() => setExpenseTab('all')}
                >
                  <Text style={[styles.catFilterTxt, expenseTab === 'all' && styles.catFilterTxtActive]}>
                    {t.allExpenseTypes || 'Tüm Giderler'} ({expenses.length})
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
                    💵 {t.dailySalesTab || 'Günlük Satış'} ({INITIAL_SALES_ITEMS.length})
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
                    ⏳ {t.unpaidDebt || 'Bekleyen Borçlar'} ({expenses.filter(e => e.paymentStatus === 'UNPAID' || e.paymentStatus === 'PARTIAL' || !e.paidByCashier).length})
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.catFilterChip,
                    expenseTab === 'awaiting_advisor' && { backgroundColor: '#d97706', borderColor: '#d97706' }
                  ]}
                  onPress={() => setExpenseTab('awaiting_advisor')}
                >
                  <Text style={[styles.catFilterTxt, expenseTab === 'awaiting_advisor' && { color: '#ffffff', fontWeight: '800' }]}>
                    ✍️ {t.awaitingApprovalBadge || 'Müşavir Onayında'} ({totalPendingAdvisorCount})
                  </Text>
                </TouchableOpacity>
                {totalRejectedCount > 0 && (
                  <TouchableOpacity
                    style={[
                      styles.catFilterChip,
                      expenseTab === 'rejected' && { backgroundColor: '#991b1b', borderColor: '#991b1b' }
                    ]}
                    onPress={() => setExpenseTab('rejected')}
                  >
                    <Text style={[styles.catFilterTxt, expenseTab === 'rejected' && { color: '#ffffff', fontWeight: '800' }]}>
                      ⚠️ {t.rejectedBadge || 'Düzeltme İstenenler'} ({totalRejectedCount})
                    </Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[
                    styles.catFilterChip,
                    expenseTab === 'rent' && { backgroundColor: '#059669', borderColor: '#059669' }
                  ]}
                  onPress={() => setExpenseTab('rent')}
                >
                  <Text style={[styles.catFilterTxt, expenseTab === 'rent' && { color: '#ffffff', fontWeight: '800' }]}>
                    🏢 {t.rent || 'Kira'} ({expenses.filter(e => e.subType === 'RENT').length})
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
                    🏢 {t.fixedLabel || 'Sabit'} ({expenses.filter(e => e.category === 'FIXED').length})
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
                    ⚡ {t.variableLabel || 'Değişken'} ({expenses.filter(e => e.category === 'VARIABLE').length})
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            <View style={styles.webFilterBar}>
              <TextInput
                style={styles.webSearchInput}
                placeholder={t.searchExpensePlaceholder || '🔍 Gider adı, kurum, fatura no, dönem ara...'}
                placeholderTextColor={THEME.colors.textLight}
                value={expenseSearch}
                onChangeText={setExpenseSearch}
              />
              <View style={styles.webFilterCountRow}>
                <Text style={styles.webFilterCountTxt}>
                  {t.recordsListed || 'Listelenen'}: <Text style={{ fontWeight: '800', color: THEME.colors.primary }}>{filteredExpenses.length}</Text> / {expenses.length} {t.allExpenseTypes ? t.allExpenseTypes.toLowerCase() : 'gider'}
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
                const isUnpaid = !isPaid && !isPartial;
                const isNeedsCorrection = exp.status === 'NEEDS_CORRECTION' || exp.status === 'REJECTED';
                const isFinalized = exp.status === 'FINALIZED' || Boolean(exp.recordedInLedger);

                return (
                  <View
                    key={exp.id}
                    style={[
                      styles.webExpenseCard,
                      isNeedsCorrection && styles.webExpenseCardNeedsCorrection,
                      isFinalized && styles.webExpenseCardFinalized,
                    ]}
                  >
                    {/* Üst Satır: Başlık, Mülk Rozeti ve Tutar */}
                    <View style={styles.expCardHeaderRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                          <Text style={styles.expCardTitle}>{exp.title}</Text>
                          {exp.isOwnedProperty && (
                            <View style={styles.expOwnedPropertyBadge}>
                              <Text style={styles.expOwnedPropertyTxt}>🏠 {t.ownedPropertyBadge || 'Öz Mülk'}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={styles.expCardMetaTxt}>
                          🗓️ {exp.expenseDate} • {t.periodLabel || 'Dönem'}: {exp.period || '2026-10'} {exp.recordedBy ? `• ${exp.recordedBy}` : ''}
                        </Text>
                        {exp.note ? (
                          <Text style={styles.expCardNoteTxt}>📝 {exp.note}</Text>
                        ) : null}
                      </View>
                      <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                        <Text style={styles.expCardAmountTxt}>
                          {exp.isOwnedProperty ? (t.ownedPropertyFree || '0 ₺') : `${parseFloat(exp.amount || 0).toLocaleString('tr-TR')} ₺`}
                        </Text>
                      </View>
                    </View>

                    {/* Müşavir Ret / Düzeltme Gerekçesi Kırmızı Kutu */}
                    {isNeedsCorrection && (
                      <View style={styles.expRejectionAlertBox}>
                        <Text style={styles.expRejectionAlertTitle}>
                          ⚠️ {t.rejectionReasonPrefix || 'Müşavir Düzeltme Notu'}: {exp.rejectionReason || 'Resmi fatura PDF belgesi kontrol edilmeli'}
                        </Text>
                      </View>
                    )}

                    {/* Detay Bilgileri: Kurum/Fatura & Kategori (Sade ve Net) */}
                    <View style={styles.expDetailsGrid}>
                      <View style={styles.expDetailCol}>
                        <Text style={styles.expDetailHeaderLbl}>{t.colCounterparty || 'KURUM / FATURA'}</Text>
                        <Text style={styles.expDetailVendorTxt} numberOfLines={1}>
                          {exp.counterparty || t.notSpecified || 'Belirtilmedi'}
                        </Text>
                        <Text style={styles.expDetailInvoiceTxt} numberOfLines={1}>
                          {exp.invoiceNumber ? `Fatura: ${exp.invoiceNumber}` : (t.noInvoice || 'Faturasız')}
                        </Text>
                        {exp.dueDate && (
                          <Text style={[styles.expDetailDueTxt, { color: isUnpaid ? '#b91c1c' : '#047857' }]}>
                            ⏰ {t.dueDateLabel || 'Vade'}: {exp.dueDate}
                          </Text>
                        )}
                      </View>

                      <View style={styles.expDetailCol}>
                        <Text style={styles.expDetailHeaderLbl}>{t.colCategory || 'KATEGORİ'}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                          <View
                            style={[
                              styles.expCatPill,
                              { backgroundColor: isFixed ? '#e0e7ff' : '#e0f2fe', borderColor: isFixed ? '#c7d2fe' : '#bae6fd' }
                            ]}
                          >
                            <Text style={[styles.expCatPillTxt, { color: isFixed ? '#4338ca' : '#0369a1' }]}>
                              {isFixed ? `🏢 ${t.fixedLabel || 'Sabit'}` : `⚡ ${t.variableLabel || 'Değişken'}`}
                            </Text>
                          </View>
                        </View>
                        <Text style={styles.expSubtypeTxt} numberOfLines={1}>
                          {getExpenseTypeLabel(exp.subType, currentLang) || (isFixed ? (t.fixedLabel || 'Sabit Kalem') : (t.variableLabel || 'Değişken Kalem'))}
                        </Text>
                      </View>
                    </View>

                    {/* Durum Rozetleri: Kasa & Mali Müşavir (Tek ve Net Tanım) */}
                    <View style={styles.expStatusBadgesRow}>
                      {/* Kasa Durumu */}
                      <View style={{ flex: 1, paddingRight: 4 }}>
                        <Text style={styles.expBadgeHeaderLbl}>{t.cashierCol || 'KASA ÖDEME'}</Text>
                        {isUnpaid ? (
                          <View style={[styles.badgeUnpaidBox, { marginTop: 3 }]}>
                            <Text style={styles.badgeUnpaidTxt}>⏳ {t.debtUnpaid || 'Borçta (Ödenmedi)'}</Text>
                          </View>
                        ) : isPartial ? (
                          <View style={[styles.badgePartialBox, { marginTop: 3 }]}>
                            <Text style={styles.badgePartialTxt}>⚡ {t.partialPaid || 'Kısmi Avans'}</Text>
                          </View>
                        ) : (
                          <View style={[styles.badgePaidBox, { marginTop: 3 }]}>
                            <Text style={styles.badgePaidTxt}>✓ {t.paidFromCashier || 'Kasadan Ödendi'}</Text>
                          </View>
                        )}
                      </View>

                      {/* Mali Müşavir Onay Durumu (Yegane onay rozeti) */}
                      <View style={{ flex: 1, paddingLeft: 4 }}>
                        <Text style={styles.expBadgeHeaderLbl}>{t.advisorCol || 'MÜŞAVİR ONAYI'}</Text>
                        {isFinalized ? (
                          <View style={[styles.badgeFinalizedBox, { marginTop: 3 }]}>
                            <Text style={styles.badgeFinalizedTxt}>📖 {t.statusFinalized || 'Deftere Kesinleşti ✓'}</Text>
                          </View>
                        ) : isNeedsCorrection ? (
                          <View style={[styles.badgeNeedsCorrectionBox, { marginTop: 3 }]}>
                            <Text style={styles.badgeNeedsCorrectionTxt}>⚠️ {t.statusNeedsCorrection || 'Düzeltme Bekliyor'}</Text>
                          </View>
                        ) : (
                          <View style={[styles.badgePendingBox, { marginTop: 3 }]}>
                            <Text style={styles.badgePendingTxt}>⏳ {t.statusPendingApproval || 'Onay Bekliyor (Taslak)'}</Text>
                          </View>
                        )}
                      </View>
                    </View>

                    {/* Sadece Aksiyon Gereken Durumlarda Buton Satırı (Web Parity: Sadece Borç Ödeme ve Silme) */}
                    {(isUnpaid || isPartial || currentUser.role === ROLES.ADMIN || (!isFinalized && isAccountantUser)) && (
                      <View style={styles.expActionRow}>
                        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                          {/* Borç / Kalan Tutar Ödeme Butonu */}
                          {(isUnpaid || isPartial) && (
                            <TouchableOpacity
                              style={[styles.webBtnPayDebt, isPartial && { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}
                              onPress={() => handlePayDebtNow(exp)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.webBtnPayDebtTxt, isPartial && { color: '#b45309' }]}>
                                {isPartial ? '⚡ Kalanı Kasadan Öde' : '💳 Kasadan Öde'}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>

                        {/* Silme Butonu: Kesinleşmemişse veya Admin ise */}
                        {(currentUser.role === ROLES.ADMIN || (!isFinalized && isAccountantUser)) && (
                          <TouchableOpacity
                            style={styles.webBtnTrashSquare}
                            onPress={() => {
                              setItemToDelete({
                                type: 'expense',
                                id: exp.id,
                                name: exp.title,
                                details: `"${exp.title}" (${parseFloat(exp.amount || 0).toLocaleString('tr-TR')} ₺) gider kaydı silinecektir. Onaylıyor musunuz?`,
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.webBtnTrashSquareTxt}>🗑️</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}

        {/* 8. EKRAN: MALİ MÜŞAVİR DEFTERİ & SMMM KONTROL PANELİ (Advisor - Web /advisor-ledger ile Birebir) */}
        {(currentScreen === 'advisor' || (currentScreen === 'accounting' && isAdvisorUser)) && canViewAdvisor && (
          <View>
            {/* Top Page Header & Action Buttons */}
            <View style={{ marginBottom: 12 }}>
              <View style={{ marginBottom: 8 }}>
                <Text
                  style={[styles.webPageTitle, { fontSize: 18 }]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.85}
                >
                  {t.advisorLedgerHeader || ('📖 ' + (t.advisorLedger || 'Mali Müşavir Defteri'))}
                </Text>
                <Text style={[styles.webPageSub, { fontSize: 11, marginTop: 1 }]} numberOfLines={1} ellipsizeMode="tail">
                  {t.advisorSubHeader || 'Muhasebenin kasadan yaptığı harcamaları resmi yevmiye defterine onaylayın'}
                </Text>
              </View>

              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                <TouchableOpacity
                  style={[styles.webBtnPrimary, { flex: 1, minWidth: 140, backgroundColor: '#0d9488', paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }]}
                  onPress={() => showToast('📥 Luca & Zirve formatında Mahsup Fişi (.XML/.XLS) hazırlandı!')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.webBtnPrimaryTxt, { fontSize: 11 }]}>📥 Luca/Zirve Aktar</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.webBtnSecondary, { flex: 1, minWidth: 140, backgroundColor: '#f0fdf4', borderColor: '#86efac', paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }]}
                  onPress={() => setAdvisorTab('tax_reports')}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#166534' }}>📋 Vergi & Beyanname</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* SMMM Özet Rozet Kartları - 3 Kolonlu Dengeli Düzen */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              <View style={{
                flex: 1,
                backgroundColor: '#ffffff',
                borderRadius: 12,
                padding: 10,
                borderWidth: 1.5,
                borderColor: '#10b981',
                borderLeftWidth: 4,
                borderLeftColor: '#059669',
              }}>
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#065f46', textTransform: 'uppercase' }} numberOfLines={1}>
                  📑 {t.recordedLedgerBadge || 'ONAYLI DEFTER'}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#047857', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
                  {totalApprovedLedgerCount} {t.recordsListed || 'Kalem'}
                </Text>
                <Text style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">
                  Yevmiyeye kesinleşti
                </Text>
              </View>

              <View style={{
                flex: 1,
                backgroundColor: '#ffffff',
                borderRadius: 12,
                padding: 10,
                borderWidth: 1.5,
                borderColor: '#f59e0b',
                borderLeftWidth: 4,
                borderLeftColor: '#d97706',
              }}>
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#b45309', textTransform: 'uppercase' }} numberOfLines={1}>
                  ✍️ {t.awaitingApprovalBadge || 'ONAY MASASI'}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#92400e', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
                  {totalPendingAdvisorCount} {t.recordsListed || 'Kalem'}
                </Text>
                <Text style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">
                  Denetim bekliyor
                </Text>
              </View>

              <View style={{
                flex: 1,
                backgroundColor: '#ffffff',
                borderRadius: 12,
                padding: 10,
                borderWidth: 1.5,
                borderColor: '#fca5a5',
                borderLeftWidth: 4,
                borderLeftColor: '#dc2626',
              }}>
                <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#991b1b', textTransform: 'uppercase' }} numberOfLines={1}>
                  ⚠️ {t.rejectedBadge || 'DÜZELTME'}
                </Text>
                <Text style={{ fontSize: 16, fontWeight: '900', color: '#b91c1c', marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
                  {totalRejectedCount} {t.recordsListed || 'Kalem'}
                </Text>
                <Text style={{ fontSize: 9.5, color: '#64748b', marginTop: 2 }} numberOfLines={1} ellipsizeMode="tail">
                  Muhasebeye iletildi
                </Text>
              </View>
            </View>

            {/* SMMM Çoklu Sekme Sistemi (Web ile Birebir) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[
                    styles.catFilterChip,
                    advisorTab === 'pending_approval' && { backgroundColor: '#d97706', borderColor: '#d97706' }
                  ]}
                  onPress={() => setAdvisorTab('pending_approval')}
                >
                  <Text style={[styles.catFilterTxt, advisorTab === 'pending_approval' && { color: '#ffffff', fontWeight: '800' }]}>
                    ✍️ {t.awaitingApprovalBadge || 'Onay Masası'} ({totalPendingAdvisorCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.catFilterChip,
                    advisorTab === 'ledger' && styles.catFilterChipActive
                  ]}
                  onPress={() => setAdvisorTab('ledger')}
                >
                  <Text style={[styles.catFilterTxt, advisorTab === 'ledger' && styles.catFilterTxtActive]}>
                    📖 {t.advisorDefter || 'Resmi Defter'} ({totalApprovedLedgerCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.catFilterChip,
                    advisorTab === 'tdhp' && { backgroundColor: '#0f766e', borderColor: '#0f766e' }
                  ]}
                  onPress={() => setAdvisorTab('tdhp')}
                >
                  <Text style={[styles.catFilterTxt, advisorTab === 'tdhp' && { color: '#ffffff', fontWeight: '800' }]}>
                    🏛️ {t.tdhpTab || 'TDHP Hesap Planı'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.catFilterChip,
                    advisorTab === 'tax_reports' && { backgroundColor: '#059669', borderColor: '#059669' }
                  ]}
                  onPress={() => setAdvisorTab('tax_reports')}
                >
                  <Text style={[styles.catFilterTxt, advisorTab === 'tax_reports' && { color: '#ffffff', fontWeight: '800' }]}>
                    📋 {t.taxReportsTab || 'Vergi & Beyanname'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.catFilterChip,
                    advisorTab === 'z_report' && { backgroundColor: '#b45309', borderColor: '#b45309' }
                  ]}
                  onPress={() => setAdvisorTab('z_report')}
                >
                  <Text style={[styles.catFilterTxt, advisorTab === 'z_report' && { color: '#ffffff', fontWeight: '800' }]}>
                    🧾 {t.zReportTab || 'Z Raporu & Kasa'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.catFilterChip,
                    advisorTab === 'rejected' && { backgroundColor: '#be123c', borderColor: '#be123c' }
                  ]}
                  onPress={() => setAdvisorTab('rejected')}
                >
                  <Text style={[styles.catFilterTxt, advisorTab === 'rejected' && { color: '#ffffff', fontWeight: '800' }]}>
                    ❌ {t.rejectedBadge || 'Düzeltme İstenenler'} ({totalRejectedCount})
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.catFilterChip,
                    advisorTab === 'all' && styles.catFilterChipActive
                  ]}
                  onPress={() => setAdvisorTab('all')}
                >
                  <Text style={[styles.catFilterTxt, advisorTab === 'all' && styles.catFilterTxtActive]}>
                    {t.all || 'Tüm Kayıtlar'} ({expenses.length})
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>

            {/* TDHP HESAP PLANI GÖRÜNÜMÜ */}
            {advisorTab === 'tdhp' ? (
              <View style={{ backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#0d9488', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#115e59' }}>
                    🏛️ Tek Düzen Hesap Planı (TDHP)
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#0d9488', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                    onPress={() => showToast('Luca/Zirve XML fişi dışa aktarıldı')}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>XML İndir</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#f0fdfa', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f766e' }}>100.01 Merkez Kasa (Nakit)</Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#047857' }}>{Math.round(totalRevenue * 0.35).toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#f0fdfa', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f766e' }}>108.01 POS / Kredi Kartı Bloke</Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#047857' }}>{Math.round(totalRevenue * 0.65).toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155' }}>150.01 İlk Madde & Malzeme (Stok)</Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#b45309' }}>{foodCostTotal.toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155' }}>770.01 Genel Yönetim (Sabit)</Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#4338ca' }}>{fixedExpensesTotal.toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155' }}>770.02 Operasyonel Gider (Değişken)</Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#0284c7' }}>{variableExpensesTotal.toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#ecfdf5', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#065f46' }}>391.10 Hesaplanan KDV (%10)</Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#166534' }}>{Math.round(totalRevenue - (totalRevenue / 1.1)).toLocaleString('tr-TR')} ₺</Text>
                  </View>
                </View>
              </View>
            ) : advisorTab === 'z_report' ? (
              /* Z RAPORU & GÜN SONU KASA MUTABAKATI */
              <View style={{ backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#d97706', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#92400e' }}>
                    🧾 Gün Sonu Z-Raporu (Z-0284)
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#d97706', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                    onPress={() => showToast('🖨️ Z-Raporu PDF çıktısı oluşturuldu!')}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>🖨️ PDF Yazdır</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#fffbeb', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, color: '#713f12' }}>Nakit Tahsilat (Çekmece):</Text>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a' }}>{Math.round(totalRevenue * 0.35).toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#fffbeb', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, color: '#713f12' }}>Banka POS & Temassız:</Text>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a' }}>{Math.round(totalRevenue * 0.55).toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#fffbeb', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, color: '#713f12' }}>Yemek Kartları (Sodexo/Multi):</Text>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a' }}>{Math.round(totalRevenue * 0.10).toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#ecfdf5', borderRadius: 8, borderWidth: 1, borderColor: '#a7f3d0' }}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#065f46' }}>TOPLAM GÜNLÜK Z-HASILATI:</Text>
                    <Text style={{ fontSize: 14, fontWeight: '900', color: '#047857' }}>{totalRevenue.toLocaleString('tr-TR')} ₺</Text>
                  </View>
                </View>
              </View>
            ) : advisorTab === 'tax_reports' ? (
              /* VERGİ VE BEYANNAMELER MASASI (GENERATE_TAX_REPORTS) */
              <View style={{ backgroundColor: '#ffffff', borderRadius: 14, padding: 14, borderWidth: 1.5, borderColor: '#059669', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 6 }}>
                  <View style={{ flex: 1, minWidth: 150 }}>
                    <Text style={{ fontSize: 13, fontWeight: '900', color: '#065f46' }}>
                      📋 Resmi Vergi & Beyanname Masası
                    </Text>
                    <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                      KDV-1, Muhtasar Stopaj & Geçici Vergi Dökümü
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{ backgroundColor: '#059669', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6 }}
                    onPress={() => showToast('📄 GİB E-Beyanname paketi (.BDP/XML) dışa aktarıldı!')}
                    activeOpacity={0.8}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>XML Paketi</Text>
                  </TouchableOpacity>
                </View>

                {/* 1. KDV-1 Beyannamesi Kartı */}
                <View style={{ backgroundColor: '#f0fdf4', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#166534', marginBottom: 4 }}>
                    1. KDV-1 Beyannamesi (Aylık)
                  </Text>
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#15803d' }}>• Hesaplanan KDV (%10 Restoran Satış):</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#166534' }}>{Math.round(totalRevenue - (totalRevenue / 1.1)).toLocaleString('tr-TR')} ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#15803d' }}>• İndirilecek KDV (Gider Faturaları):</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#166534' }}>{Math.round(variableExpensesTotal * 0.15).toLocaleString('tr-TR')} ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#bbf7d0', paddingTop: 4, marginTop: 2 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '900', color: '#064e3b' }}>ÖDENECEK NET KDV:</Text>
                      <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#047857' }}>
                        {Math.max(0, Math.round((totalRevenue - (totalRevenue / 1.1)) - (variableExpensesTotal * 0.15))).toLocaleString('tr-TR')} ₺
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 2. Muhtasar ve Prim Hizmet Beyannamesi (MPHB) */}
                <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#1e293b', marginBottom: 4 }}>
                    2. Muhtasar & Prim Hizmet Beyannamesi (MPHB)
                  </Text>
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#475569' }}>• Personel SGK Prim Karşılığı (6 Kişi):</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>27.500 ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#475569' }}>• Personel Gelir Vergisi Stopajı:</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>4.800 ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#475569' }}>• Dükkan Kira Stopajı (%20 Tevkifat):</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>9.000 ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#475569' }}>• SMMM Serbest Meslek Stopajı (%20):</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>1.700 ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 4, marginTop: 2 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '900', color: '#0f172a' }}>TOPLAM STOPAJ & SGK TAHAKKUK:</Text>
                      <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#b45309' }}>43.000 ₺</Text>
                    </View>
                  </View>
                </View>

                {/* 3. Geçici Kurumlar Vergisi Özeti */}
                <View style={{ backgroundColor: '#fffbeb', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#fde68a' }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#92400e', marginBottom: 4 }}>
                    3. Üç Aylık Geçici Vergi / Faaliyet Kârı Karşılığı
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10.5, color: '#78350f' }}>Tahmini Net Kâr Karşılığı (%25):</Text>
                    <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#b45309' }}>
                      {netOperatingProfit > 0 ? Math.round(netOperatingProfit * 0.25).toLocaleString('tr-TR') : 0} ₺
                    </Text>
                  </View>
                </View>
              </View>
            ) : (
              /* GİDER LİSTESİ (Onay Masası, Resmi Defter, Reddedilenler veya Tümü) */
              <>
                <View style={styles.webFilterBar}>
                  <TextInput
                    style={styles.webSearchInput}
                    placeholder="🔍 Defterde gider, kurum veya fatura ara..."
                    placeholderTextColor={THEME.colors.textLight}
                    value={advisorSearch}
                    onChangeText={setAdvisorSearch}
                  />
                  <View style={styles.webFilterCountRow}>
                    <Text style={styles.webFilterCountTxt}>
                      Listelenen: <Text style={{ fontWeight: '800', color: '#7c3aed' }}>{filteredAdvisorExpenses.length}</Text> kayıt
                    </Text>
                  </View>
                </View>

                {filteredAdvisorExpenses.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14 }}>
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>📖</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.colors.textDark }}>
                      Bu sekmede incelenecek kayıt bulunamadı
                    </Text>
                    <Text style={{ fontSize: 12, color: THEME.colors.textLight, marginTop: 4 }}>
                      Onay bekleyen veya onaylanmış kayıtlar geldikçe burada listelenir.
                    </Text>
                  </View>
                ) : (
                  filteredAdvisorExpenses.map((exp) => {
                    const isFixed = exp.category === 'FIXED';
                    const isPaid = exp.paymentStatus === 'PAID' || (exp.paidByCashier && exp.paymentStatus !== 'UNPAID');
                    const isPartial = exp.paymentStatus === 'PARTIAL';
                    const isUnpaid = !isPaid && !isPartial;
                    const isNeedsCorrection = exp.status === 'NEEDS_CORRECTION' || exp.status === 'REJECTED';
                    const isFinalized = exp.status === 'FINALIZED' || Boolean(exp.recordedInLedger);

                    return (
                      <View
                        key={exp.id}
                        style={[
                          styles.webExpenseCard,
                          isNeedsCorrection && styles.webExpenseCardNeedsCorrection,
                          isFinalized && styles.webExpenseCardFinalized,
                        ]}
                      >
                        {/* Üst Satır: Başlık, Mülk/Kilit Rozeti ve Tutar */}
                        <View style={styles.expCardHeaderRow}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6 }}>
                              <Text style={styles.expCardTitle}>{exp.title}</Text>
                              {exp.isOwnedProperty && (
                                <View style={styles.expOwnedPropertyBadge}>
                                  <Text style={styles.expOwnedPropertyTxt}>🏠 {t.ownedPropertyBadge || 'Öz Mülk'}</Text>
                                </View>
                              )}
                            </View>
                            <Text style={styles.expCardMetaTxt}>
                              🗓️ {exp.expenseDate} • {t.periodLabel || 'Dönem'}: {exp.period || '2026-10'} {exp.recordedBy ? `• ${exp.recordedBy}` : ''}
                            </Text>
                            {exp.note ? (
                              <Text style={styles.expCardNoteTxt}>📝 {exp.note}</Text>
                            ) : null}
                          </View>
                          <View style={{ alignItems: 'flex-end', flexShrink: 0 }}>
                            <Text style={styles.expCardAmountTxt}>
                              {exp.isOwnedProperty ? (t.ownedPropertyFree || '0 ₺') : `${parseFloat(exp.amount || 0).toLocaleString('tr-TR')} ₺`}
                            </Text>
                          </View>
                        </View>

                        {/* Müşavir Ret / Düzeltme Gerekçesi Kırmızı Kutu */}
                        {isNeedsCorrection && (
                          <View style={styles.expRejectionAlertBox}>
                            <Text style={styles.expRejectionAlertTitle}>
                              ⚠️ {t.rejectionReasonPrefix || 'Müşavir Düzeltme Notu'}: {exp.rejectionReason || 'Resmi fatura PDF belgesi kontrol edilmeli'}
                            </Text>
                          </View>
                        )}

                        {/* Detay Bilgileri: Kurum/Fatura & Kategori (Sade ve Net) */}
                        <View style={styles.expDetailsGrid}>
                          <View style={styles.expDetailCol}>
                            <Text style={styles.expDetailHeaderLbl}>{t.colCounterparty || 'KURUM / FATURA'}</Text>
                            <Text style={styles.expDetailVendorTxt} numberOfLines={1}>
                              {exp.counterparty || t.notSpecified || 'Belirtilmedi'}
                            </Text>
                            <Text style={styles.expDetailInvoiceTxt} numberOfLines={1}>
                              {exp.invoiceNumber ? `Fatura: ${exp.invoiceNumber}` : (t.noInvoice || 'Faturasız')}
                            </Text>
                            {exp.dueDate && (
                              <Text style={[styles.expDetailDueTxt, { color: isUnpaid ? '#b91c1c' : '#047857' }]}>
                                ⏰ {t.dueDateLabel || 'Vade'}: {exp.dueDate}
                              </Text>
                            )}
                          </View>

                          <View style={styles.expDetailCol}>
                            <Text style={styles.expDetailHeaderLbl}>{t.colCategory || 'KATEGORİ'}</Text>
                            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                              <View
                                style={[
                                  styles.expCatPill,
                                  { backgroundColor: isFixed ? '#e0e7ff' : '#e0f2fe', borderColor: isFixed ? '#c7d2fe' : '#bae6fd' }
                                ]}
                              >
                                <Text style={[styles.expCatPillTxt, { color: isFixed ? '#4338ca' : '#0369a1' }]}>
                                  {isFixed ? `🏢 ${t.fixedLabel || 'Sabit'}` : `⚡ ${t.variableLabel || 'Değişken'}`}
                                </Text>
                              </View>
                            </View>
                            <Text style={styles.expSubtypeTxt} numberOfLines={1}>
                              {getExpenseTypeLabel(exp.subType, currentLang) || (isFixed ? (t.fixedLabel || 'Sabit Kalem') : (t.variableLabel || 'Değişken Kalem'))}
                            </Text>
                          </View>
                        </View>

                        {/* Durum Rozetleri: Kasa & Mali Müşavir Onayı (Tek ve Net Tanım) */}
                        <View style={styles.expStatusBadgesRow}>
                          {/* Kasa Durumu */}
                          <View style={{ flex: 1, paddingRight: 4 }}>
                            <Text style={styles.expBadgeHeaderLbl}>{t.cashierCol || 'KASA ÖDEME'}</Text>
                            {isUnpaid ? (
                              <View style={[styles.badgeUnpaidBox, { marginTop: 3 }]}>
                                <Text style={styles.badgeUnpaidTxt}>⏳ {t.debtUnpaid || 'Borçta (Ödenmedi)'}</Text>
                              </View>
                            ) : isPartial ? (
                              <View style={[styles.badgePartialBox, { marginTop: 3 }]}>
                                <Text style={styles.badgePartialTxt}>⚡ {t.partialPaid || 'Kısmi Avans'}</Text>
                              </View>
                            ) : (
                              <View style={[styles.badgePaidBox, { marginTop: 3 }]}>
                                <Text style={styles.badgePaidTxt}>✓ {t.paidFromCashier || 'Kasadan Ödendi'}</Text>
                              </View>
                            )}
                          </View>

                          {/* Mali Müşavir Onay Durumu (Yegane onay rozeti) */}
                          <View style={{ flex: 1, paddingLeft: 4 }}>
                            <Text style={styles.expBadgeHeaderLbl}>{t.advisorCol || 'MÜŞAVİR ONAYI'}</Text>
                            {isFinalized ? (
                              <View style={[styles.badgeFinalizedBox, { marginTop: 3 }]}>
                                <Text style={styles.badgeFinalizedTxt}>📖 {t.statusFinalized || 'Deftere Kesinleşti ✓'}</Text>
                              </View>
                            ) : isNeedsCorrection ? (
                              <View style={[styles.badgeNeedsCorrectionBox, { marginTop: 3 }]}>
                                <Text style={styles.badgeNeedsCorrectionTxt}>⚠️ {t.statusNeedsCorrection || 'Düzeltme Bekliyor'}</Text>
                              </View>
                            ) : (
                              <View style={[styles.badgePendingBox, { marginTop: 3 }]}>
                                <Text style={styles.badgePendingTxt}>⏳ {t.statusPendingApproval || 'Onay Bekliyor (Taslak)'}</Text>
                              </View>
                            )}
                          </View>
                        </View>

                        {/* MALİ MÜŞAVİR İŞLEM BUTONLARI (Tekrarsız ve Sade) */}
                        <View style={styles.expActionRow}>
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                            {isFinalized ? (
                              <TouchableOpacity
                                style={styles.webBtnReject}
                                onPress={() => handleOpenRejectModal(exp)}
                                activeOpacity={0.8}
                              >
                                <Text style={styles.webBtnRejectTxt}>↺ Düzeltme İste</Text>
                              </TouchableOpacity>
                            ) : (
                              <>
                                <TouchableOpacity
                                  style={styles.webBtnApprove}
                                  onPress={() => handleApproveExpenseLedger(exp)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.webBtnApproveTxt}>✓ {t.approveBtn || 'Onayla & Deftere İşle'}</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.webBtnReject}
                                  onPress={() => handleOpenRejectModal(exp)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.webBtnRejectTxt}>✕ {t.rejectBtn || 'Gerekçeli Ret'}</Text>
                                </TouchableOpacity>
                              </>
                            )}
                          </View>

                          {/* Silme Butonu (Müşavir veya Admin) */}
                          <TouchableOpacity
                            style={styles.webBtnTrashSquare}
                            onPress={() => {
                              setItemToDelete({
                                type: 'expense',
                                id: exp.id,
                                name: exp.title,
                                details: `"${exp.title}" (${parseFloat(exp.amount || 0).toLocaleString('tr-TR')} ₺) gider kaydı silinecektir. Onaylıyor musunuz?`,
                              });
                            }}
                            activeOpacity={0.7}
                          >
                            <Text style={styles.webBtnTrashSquareTxt}>🗑️</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    );
                  })
                )}
              </>
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
                  {editingStockItem ? `✏️ ${t.edit || 'Ürün Bilgilerini Düzenle'}` : `➕ ${t.newItem || 'Depoya Yeni Ürün Ekle'}`}
                </Text>
                <Text style={styles.webModalSub}>
                  {editingStockItem ? (t.autoThresholdControl || 'Mevcut stok ve maliyet parametreleri') : (t.warehouse || 'Envanter ve barkod kayıt formu')}
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
              <Text style={styles.webModalLabel}>{t.productName || 'Ürün Adı'} *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={t.productName || 'Örn: Dana Bonfile, Çam Fıstığı...'}
                placeholderTextColor={THEME.colors.textLight}
                value={newStockItem.name}
                onChangeText={(tVal) => setNewStockItem({ ...newStockItem, name: tVal })}
              />

              {/* Kategori Seçici */}
              <Text style={styles.webModalLabel}>{t.category || 'Kategori'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {['Kuru Gıda', 'Et & Tavuk', 'Sebze & Meyve', 'Süt Ürünleri', 'İçecek', 'Temizlik & Hijyen', 'Genel'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.webModalChip, newStockItem.cat === cat && styles.webModalChipActive]}
                    onPress={() => setNewStockItem({ ...newStockItem, cat })}
                  >
                    <Text style={[styles.webModalChipTxt, newStockItem.cat === cat && styles.webModalChipTxtActive]}>
                      {getCategoryLabel(cat, currentLang)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              {/* Birim Seçici */}
              <Text style={styles.webModalLabel}>{t.unit || 'Ölçü Birimi'}</Text>
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {['adet', 'kg', 'lt', 'paket', 'koli'].map((u) => (
                  <TouchableOpacity
                    key={u}
                    style={[styles.webModalChip, newStockItem.unit === u && styles.webModalChipActive, { flex: 1, alignItems: 'center' }]}
                    onPress={() => setNewStockItem({ ...newStockItem, unit: u })}
                  >
                    <Text style={[styles.webModalChipTxt, newStockItem.unit === u && styles.webModalChipTxtActive]}>
                      {u}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Stok Miktarı ve Min Stok */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.webModalLabel}>{t.stockCol || 'Mevcut Stok Miktarı'}</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="0"
                    placeholderTextColor={THEME.colors.textLight}
                    value={String(newStockItem.stock)}
                    onChangeText={(tVal) => setNewStockItem({ ...newStockItem, stock: tVal })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.webModalLabel}>{t.minStockCol || 'Kritik Min. Stok'}</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="5"
                    placeholderTextColor={THEME.colors.textLight}
                    value={String(newStockItem.min)}
                    onChangeText={(tVal) => setNewStockItem({ ...newStockItem, min: tVal })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Birim Maliyet ve Tedarikçi */}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.webModalLabel}>{t.unitPriceCol || 'Birim Maliyet'} (₺)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="0.00"
                    placeholderTextColor={THEME.colors.textLight}
                    value={String(newStockItem.price)}
                    onChangeText={(tVal) => setNewStockItem({ ...newStockItem, price: tVal })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.webModalLabel}>{t.supplier || 'Tedarikçi Firma'}</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder={`${t.supplier || 'Tedarikçi'}`}
                    placeholderTextColor={THEME.colors.textLight}
                    value={newStockItem.supplier}
                    onChangeText={(tVal) => setNewStockItem({ ...newStockItem, supplier: tVal })}
                  />
                </View>
              </View>

              {/* Barkod */}
              <Text style={styles.webModalLabel}>{t.barcodeCol || 'Barkod Numarası'}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={`${t.autoGenerateBarcode || 'Otomatik Barkod'}`}
                placeholderTextColor={THEME.colors.textLight}
                value={newStockItem.barcode}
                onChangeText={(tVal) => setNewStockItem({ ...newStockItem, barcode: tVal })}
                keyboardType="numeric"
              />
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 12 }}>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveStockItem}>
                <Text style={styles.modalSubmitTxt}>
                  {editingStockItem ? (t.save || 'Değişiklikleri Kaydet') : (t.confirm || 'Ürünü Stoğa Ekle')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowAddStockModal(false);
                  setEditingStockItem(null);
                }}
              >
                <Text style={styles.modalCancelTxt}>{t.cancel || 'Vazgeç'}</Text>
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
                  {editingRecipe ? `✏️ ${t.edit || 'Reçeteyi Düzenle'}` : `➕ ${t.addNewRecipe || 'Yeni Reçete Tanımla'}`}
                </Text>
                <Text style={styles.webModalSub}>{t.recipesAndKitchen || 'Menü reçetesi, porsiyon ve malzeme gramajı'}</Text>
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
              <Text style={styles.webModalLabel}>{t.dishNameTh || 'Reçete / Yemek Adı'} *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={`${t.dishNameTh || 'Reçete / Yemek Adı'}`}
                placeholderTextColor={THEME.colors.textLight}
                value={newRecipe.name}
                onChangeText={(tVal) => setNewRecipe({ ...newRecipe, name: tVal })}
              />

              {/* Kategori Seçici */}
              <Text style={styles.webModalLabel}>{t.category || 'Kategori'}</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {['Ana Yemek', 'Makarna', 'Pizza', 'Burger', 'Salata', 'Kahvaltı', 'Tatlı', 'İçecek', 'Başlangıç'].map((cat) => (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.webModalChip, newRecipe.category === cat && styles.webModalChipActive]}
                    onPress={() => setNewRecipe({ ...newRecipe, category: cat })}
                  >
                    <Text style={[styles.webModalChipTxt, newRecipe.category === cat && styles.webModalChipTxtActive]}>
                      {getCategoryLabel(cat, currentLang)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View style={{ flexDirection: 'row', gap: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.webModalLabel}>{t.targetSaleTh || 'Satış Fiyatı'} (₺) *</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="0.00"
                    placeholderTextColor={THEME.colors.textLight}
                    value={String(newRecipe.salePrice)}
                    onChangeText={(tVal) => setNewRecipe({ ...newRecipe, salePrice: tVal })}
                    keyboardType="numeric"
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.webModalLabel}>{t.portionCostTh || 'Porsiyon Maliyeti'} (₺)</Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="0.00"
                    placeholderTextColor={THEME.colors.textLight}
                    value={String(newRecipe.cost)}
                    onChangeText={(tVal) => setNewRecipe({ ...newRecipe, cost: tVal })}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              {/* Dinamik Malzeme & Gramaj Listesi (Web ile birebir) */}
              <View style={{ marginTop: 8, marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={styles.webModalLabel}>{t.ingredientsTitle || 'Malzeme & Gramaj Listesi'} (1 {t.portionCol || 'Porsiyon'})</Text>
                  <TouchableOpacity
                    style={styles.webAddIngredientBtn}
                    onPress={() => {
                      setNewRecipe({
                        ...newRecipe,
                        ingredients: [...(newRecipe.ingredients || []), { name: '', amount: '100 gr' }],
                      });
                    }}
                  >
                    <Text style={styles.webAddIngredientBtnTxt}>+ {t.rawMaterialCost || 'Malzeme Ekle'}</Text>
                  </TouchableOpacity>
                </View>

                {(newRecipe.ingredients || []).map((ing, idx) => (
                  <View key={idx} style={styles.webIngInputRow}>
                    <TextInput
                      style={[styles.modalInput, { flex: 2, marginBottom: 0 }]}
                      placeholder={t.productName || 'Malzeme Adı'}
                      placeholderTextColor={THEME.colors.textLight}
                      value={ing.name}
                      onChangeText={(tVal) => {
                        const next = [...newRecipe.ingredients];
                        next[idx].name = tVal;
                        setNewRecipe({ ...newRecipe, ingredients: next });
                      }}
                    />
                    <TextInput
                      style={[styles.modalInput, { flex: 1.2, marginBottom: 0 }]}
                      placeholder={t.quantity || 'Miktar (200 gr)'}
                      placeholderTextColor={THEME.colors.textLight}
                      value={ing.amount}
                      onChangeText={(tVal) => {
                        const next = [...newRecipe.ingredients];
                        next[idx].amount = tVal;
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
                  {editingRecipe ? (t.save || 'Değişiklikleri Kaydet') : (t.confirm || 'Reçeteyi Kaydet')}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => {
                  setShowAddRecipeModal(false);
                  setEditingRecipe(null);
                }}
              >
                <Text style={styles.modalCancelTxt}>{t.cancel || 'Vazgeç'}</Text>
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
            <Text style={styles.deleteModalTitle}>{t.delete || 'Kalıcı Olarak Silinsin mi?'}</Text>
            <Text style={styles.deleteModalDesc}>
              {itemToDelete?.details || `"${itemToDelete?.name}" kaydı sistemden ve veritabanından kalıcı olarak silinecektir. Bu işlem geri alınamaz.`}
            </Text>
            <View style={styles.deleteModalBtnRow}>
              <TouchableOpacity
                style={styles.deleteModalCancelBtn}
                onPress={() => setItemToDelete(null)}
              >
                <Text style={styles.deleteModalCancelTxt}>{t.cancel || 'Vazgeç'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.deleteModalConfirmBtn}
                onPress={handleConfirmDelete}
              >
                <Text style={styles.deleteModalConfirmTxt}>🗑️ {t.delete || 'Evet, Sil'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 3: YENİ PERSONEL EKLE (Web UsersPage ile Birebir) */}
      <Modal visible={showAddUserModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%', padding: 18, borderWidth: 1.5, borderColor: '#10b981' }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <View>
                <Text style={[styles.modalTitle, { color: '#065f46', fontSize: 17 }]}>➕ {t.users || 'Yeni Personel Ekle'}</Text>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{t.roleAdmin || 'Personel hesapları ve yetki matrisi'}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddUserModal(false)} style={styles.modalCloseBtn}>
                <Text style={styles.modalCloseX}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 8 }}>
              {/* Ad Soyad */}
              <Text style={styles.webModalLabel}>{t.fullNameLabel || 'Personel Adı Soyadı'} *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={`${t.fullNameLabel || 'Personel Adı Soyadı'}`}
                placeholderTextColor={THEME.colors.textLight}
                value={newUser.name}
                onChangeText={(tVal) => setNewUser({ ...newUser, name: tVal })}
              />

              {/* Kullanıcı Adı */}
              <Text style={styles.webModalLabel}>{t.usernameLabel || 'Kullanıcı Adı'} *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder={`${t.usernameLabel || 'Kullanıcı Adı'}`}
                placeholderTextColor={THEME.colors.textLight}
                value={newUser.username}
                onChangeText={(tVal) => setNewUser({ ...newUser, username: tVal })}
                autoCapitalize="none"
              />

              {/* E-posta */}
              <Text style={styles.webModalLabel}>{t.emailLabel || 'E-posta Adresi'}</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="ornek@gastrosync.com"
                placeholderTextColor={THEME.colors.textLight}
                value={newUser.email}
                onChangeText={(tVal) => setNewUser({ ...newUser, email: tVal })}
                autoCapitalize="none"
                keyboardType="email-address"
              />

              {/* Başlangıç Şifresi (Web Birebir Eklendi) */}
              <Text style={styles.webModalLabel}>{t.passwordLabel || 'Başlangıç Şifresi'} *</Text>
              <TextInput
                style={[styles.modalInput, { backgroundColor: '#f0fdf4', borderColor: '#86efac', color: '#065f46', fontWeight: '700' }]}
                placeholder="123456"
                placeholderTextColor="#059669"
                value={newUser.password}
                onChangeText={(tVal) => setNewUser({ ...newUser, password: tVal })}
                secureTextEntry
              />
              <Text style={{ fontSize: 10, color: '#64748b', marginTop: -6, marginBottom: 12 }}>
                ℹ️ {t.passwordHint || 'Personel sisteme bu şifre ile ilk girişini yapacaktır.'}
              </Text>

              {/* Görev Rolü Seçimi */}
              <Text style={styles.webModalLabel}>
                {t.colRole || 'Atanacak Görev Rolü'} *
              </Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
                {Object.keys(ROLES).map((rKey) => {
                  const rVal = ROLES[rKey];
                  const isSelected = newUser.role === rVal;
                  const roleCol = ROLE_COLORS[rVal] || '#059669';
                  return (
                    <TouchableOpacity
                      key={rVal}
                      style={[
                        styles.chipBtn,
                        {
                          paddingVertical: 7,
                          paddingHorizontal: 10,
                          borderRadius: 8,
                          backgroundColor: isSelected ? roleCol : '#f8fafc',
                          borderColor: isSelected ? roleCol : '#e2e8f0',
                          borderWidth: 1.5,
                        }
                      ]}
                      onPress={() => setNewUser({ ...newUser, role: rVal })}
                    >
                      <Text style={[styles.chipTxt, { color: isSelected ? '#ffffff' : '#334155', fontWeight: isSelected ? '800' : '600', fontSize: 11 }]}>
                        {getRoleLabel(rVal, currentLang)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#059669' }]} onPress={handleAddNewUser}>
                <Text style={styles.modalSubmitTxt}>✓ {t.save || 'Kullanıcıyı Kaydet'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddUserModal(false)}>
                <Text style={styles.modalCancelTxt}>{t.cancel || 'Vazgeç'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 4B: KULLANICI ROLÜ GÜNCELLE / ATAMA MODALI (Web Theme Parity) */}
      <Modal visible={!!editingUserRole} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: '#10b981', borderWidth: 2, padding: 18 }]}>
            <View style={styles.webModalHeader}>
              <View>
                <Text style={[styles.modalTitle, { color: '#065f46' }]}>🛡️ {t.edit || 'Görev Rolü Ata & Değiştir'}</Text>
                <Text style={styles.webModalSub}>{t.rbacMatrixTitle || 'Restoran erişim yetkilerini güncelle'}</Text>
              </View>
              <TouchableOpacity onPress={() => setEditingUserRole(null)}>
                <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
              </TouchableOpacity>
            </View>

            {editingUserRole && (
              <View style={{ backgroundColor: '#ecfdf5', padding: 12, borderRadius: 10, marginBottom: 12, borderWidth: 1, borderColor: '#a7f3d0' }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: '#065f46' }}>
                  {editingUserRole.name} (@{editingUserRole.username})
                </Text>
                <Text style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                  Mevcut Rol: <Text style={{ fontWeight: '800' }}>{getRoleLabel(editingUserRole.role, currentLang)}</Text>
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 8 }}>
              {t.colRole || 'Atanacak Yeni Restoran Rolü'}:
            </Text>
            <View style={{ gap: 6, marginBottom: 14 }}>
              {Object.keys(ROLES).map((rKey) => {
                const rVal = ROLES[rKey];
                const isSelected = editingUserRole?.role === rVal;
                const roleCol = ROLE_COLORS[rVal] || '#059669';
                return (
                  <TouchableOpacity
                    key={rVal}
                    style={[
                      styles.chipBtn,
                      {
                        paddingVertical: 9,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        borderRadius: 10,
                        backgroundColor: isSelected ? '#ecfdf5' : '#f8fafc',
                        borderColor: isSelected ? roleCol : '#e2e8f0',
                        borderWidth: 1.5,
                      }
                    ]}
                    onPress={() => handleUpdateUserRole(editingUserRole.id, rVal)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: roleCol }} />
                      <Text style={[styles.chipTxt, { color: isSelected ? '#065f46' : '#334155', fontWeight: isSelected ? '800' : '600', fontSize: 13 }]}>
                        {getRoleLabel(rVal, currentLang)}
                      </Text>
                    </View>
                    {isSelected && (
                      <Text style={{ color: '#059669', fontWeight: '900', fontSize: 13 }}>✓ {t.statusProfitable || 'Aktif'}</Text>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setEditingUserRole(null)}>
              <Text style={styles.modalCancelTxt}>{t.cancel || 'Vazgeç'}</Text>
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
                <Text style={styles.modalTitle}>🔔 {t.notifications || 'Rol Bildirimleri'}</Text>
                <Text style={styles.webModalSub}>
                  {getRoleLabel(currentUser.role, currentLang)} {t.accountingSubHeader || 'için anlık onay, ret ve kasa bildirimleri'}
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
                  showToast(t.markAllRead || 'Tüm bildirimler okundu olarak işaretlendi');
                }}
              >
                <Text style={{ color: '#065f46', fontWeight: '800', fontSize: 12 }}>
                  ✓ {t.markAllRead || 'Tümünü Okundu Olarak İşaretle'}
                </Text>
              </TouchableOpacity>
            )}

            <ScrollView style={{ maxHeight: 380 }}>
              {mobileNotifications.length === 0 ? (
                <View style={{ padding: 30, alignItems: 'center' }}>
                  <Text style={{ fontSize: 13, color: '#94a3b8' }}>
                    📭 {t.noNotifications || 'Henüz okunmamış bildiriminiz bulunmuyor.'}
                  </Text>
                </View>
              ) : (
                mobileNotifications.map((notif) => {
                  const loc = getLocalizedNotification(notif, currentLang);
                  return (
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
                        <Text style={{ fontSize: 12, fontWeight: '800', color: notif.isRead ? '#475569' : '#166534', flex: 1, marginRight: 6 }}>
                          {loc.title}
                        </Text>
                        {!notif.isRead && (
                          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10b981' }} />
                        )}
                      </View>
                      <Text style={{ fontSize: 11, color: '#334155', lineHeight: 16, marginBottom: 6 }}>
                        {loc.message}
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
                  );
                })
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
          <View style={[styles.modalCard, { maxHeight: '90%', padding: 16 }]}>
            <View style={styles.webModalHeader}>
              <View>
                <Text style={styles.modalTitle}>➕ {t.newExpense || 'Yeni Gider Kaydı Ekle'}</Text>
                <Text style={styles.webModalSub}>{t.rawPlusFplusV || 'Sabit veya değişken işletme maliyet kalemi'}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowAddExpenseModal(false)}>
                <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              {/* Gider Türü Seçimi: Sabit vs Değişken */}
              <Text style={{ fontSize: 12, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 6 }}>
                {t.category || 'Gider Ana Kategorisi'}:
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
                    🏢 {t.fixedLabel || 'Sabit Gider'}
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
                    ⚡ {t.variableLabel || 'Değişken Gider'}
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
                        🏢 Kira (İşyeri)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'LABOR' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'LABOR' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'LABOR' && styles.chipTxtActive]}>
                        👥 İşçilik & Personel Maaşları
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'ACCOUNTANT' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'ACCOUNTANT' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'ACCOUNTANT' && styles.chipTxtActive]}>
                        📑 Mali Müşavir
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
                        🌐 İnternet & Ağ
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'TAX' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'TAX' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'TAX' && styles.chipTxtActive]}>
                        🏛️ Vergi (KDV / Stopaj)
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[styles.chipBtn, newExpense.subType === 'SGK' && styles.chipBtnActive]}
                      onPress={() => setNewExpense({ ...newExpense, subType: 'SGK' })}
                    >
                      <Text style={[styles.chipTxt, newExpense.subType === 'SGK' && styles.chipTxtActive]}>
                        🛡️ Sigorta (SGK Prim)
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
                        🔨 Tadilat & Bakım
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
                placeholder={`${t.colExpenseTitle || 'Gider Tanımı'} (${t.expElectricity || 'Elektrik, Kira, Maaş'}...)`}
                placeholderTextColor={THEME.colors.textLight}
                value={newExpense.title}
                onChangeText={(tVal) => setNewExpense({ ...newExpense, title: tVal })}
              />

              {/* Kurum / Alacaklı & Fatura Seri No */}
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1.2 }]}
                  placeholder={`${t.supplier || 'Kurum / Muhatap'}`}
                  placeholderTextColor={THEME.colors.textLight}
                  value={newExpense.counterparty}
                  onChangeText={(tVal) => setNewExpense({ ...newExpense, counterparty: tVal })}
                />
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder={`${t.barcodeCol || 'Fatura No'}`}
                  placeholderTextColor={THEME.colors.textLight}
                  value={newExpense.invoiceNumber}
                  onChangeText={(tVal) => setNewExpense({ ...newExpense, invoiceNumber: tVal })}
                />
              </View>

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder={newExpense.isOwnedProperty ? `0 ₺ (${t.ownedPropertyBadge || 'Öz Mülk'})` : `${t.amount || 'Tutar'} (₺)`}
                  placeholderTextColor={THEME.colors.textLight}
                  value={newExpense.isOwnedProperty ? '0' : newExpense.amount}
                  onChangeText={(tVal) => setNewExpense({ ...newExpense, amount: tVal })}
                  keyboardType="numeric"
                  editable={!newExpense.isOwnedProperty}
                />
                <TextInput
                  style={[styles.modalInput, { flex: 1 }]}
                  placeholder={`${t.periodLabel || 'Dönem'} (YYYY-MM)`}
                  placeholderTextColor={THEME.colors.textLight}
                  value={newExpense.period}
                  onChangeText={(tVal) => setNewExpense({ ...newExpense, period: tVal })}
                />
              </View>

              {/* Vade / Son Ödeme Tarihi */}
              <View style={{ marginBottom: 6 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 4 }}>
                  {t.dueDateLabel || 'Son Ödeme Vadesi'} (YYYY-MM-DD):
                </Text>
                <TextInput
                  style={styles.modalInput}
                  placeholder={`${t.dueDateLabel || 'Vade Tarihi'} (YYYY-MM-DD)`}
                  placeholderTextColor={THEME.colors.textLight}
                  value={newExpense.dueDate}
                  onChangeText={(tVal) => setNewExpense({ ...newExpense, dueDate: tVal })}
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
                    💵 {t.paidFromCashier || 'Peşin Ödendi'}
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
                    ⏳ {t.unpaidDebt ? t.unpaidDebt.split(' ')[0] : 'Borçta'}
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
                    ⚡ {t.share || 'Kısmi'}
                  </Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.modalInput}
                placeholder={t.note || 'Açıklama / Fatura Notu (Opsiyonel)'}
                placeholderTextColor={THEME.colors.textLight}
                value={newExpense.note}
                onChangeText={(tVal) => setNewExpense({ ...newExpense, note: tVal })}
              />

            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: '#047857' }]}
                onPress={handleSaveExpense}
              >
                <Text style={styles.modalSubmitTxt}>{t.save || 'Gideri Kaydet'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setShowAddExpenseModal(false)}>
                <Text style={styles.modalCancelTxt}>{t.cancel || 'Vazgeç'}</Text>
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
                <Text style={[styles.modalTitle, { color: '#991b1b' }]}>❌ {t.reject || 'Gideri Deftere Almayı Reddet'}</Text>
                <Text style={styles.webModalSub}>{t.rejectedBadge || 'Muhasebeye iletilecek gerekçeli ret bildirimi'}</Text>
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
                  {t.amount || 'Tutar'}: {parseFloat(expenseToRejectMobile.amount || 0).toLocaleString('tr-TR')} ₺ • {t.barcodeCol || 'Fatura No'}: {expenseToRejectMobile.invoiceNumber || 'Girilmemiş'}
                </Text>
              </View>
            )}

            <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 6 }}>
              {t.note || 'Ret Gerekçesi'} (Zorunlu):
            </Text>
            <TextInput
              style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]}
              placeholder={`${t.rejectionReasonPrefix || 'Ret Gerekçesi'}...`}
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
                <Text style={styles.modalSubmitTxt}>❌ {t.reject || 'Reddet ve Bildir'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setExpenseToRejectMobile(null)}
              >
                <Text style={styles.modalCancelTxt}>{t.cancel || 'Vazgeç'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>


      {/* MODAL 7: WEB BİREBİR "SİPARİŞ TALEBİ AÇ" (Stoktan Kasaya Otomatik Harcama & Bildirim) */}
      <Modal visible={!!orderModalItem} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%', padding: 16 }]}>
            <View style={styles.webModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>🛒 {t.orderModalItem || 'Sipariş & Malzeme Talebi Aç'}</Text>
                <Text style={styles.webModalSub}>
                  {orderModalItem?.name} ({orderModalItem?.stock} {orderModalItem?.unit} {t.statusSufficient ? t.statusSufficient.split('•')[1] || 'mevcut' : 'mevcut'})
                </Text>
              </View>
              <TouchableOpacity onPress={() => setOrderModalItem(null)}>
                <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 10 }}>
              <View style={{ marginVertical: 8 }}>
                <Text style={styles.webModalLabel}>{t.quantity || 'Sipariş Miktarı'} ({orderModalItem?.unit?.toUpperCase()})</Text>
                <TextInput
                  style={[styles.modalInput, { fontSize: 16, fontWeight: '800', color: '#047857' }]}
                  placeholder="15"
                  placeholderTextColor={THEME.colors.textLight}
                  value={orderQuantity}
                  onChangeText={setOrderQuantity}
                  keyboardType="numeric"
                />
              </View>

              <View style={{ marginVertical: 8 }}>
                <Text style={styles.webModalLabel}>{t.note || 'Şef / Depo Notu veya Tercihi'}</Text>
                <TextInput
                  style={[styles.modalInput, { minHeight: 60, textAlignVertical: 'top' }]}
                  placeholder={t.note || 'Taze ve iri boy tercih edilsin...'}
                  placeholderTextColor={THEME.colors.textLight}
                  value={orderNote}
                  onChangeText={setOrderNote}
                  multiline
                />
              </View>

              {/* Acil Durum Butonu */}
              <TouchableOpacity
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 8,
                  backgroundColor: orderUrgent ? '#fee2e2' : '#f8fafc',
                  padding: 10,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: orderUrgent ? '#fca5a5' : '#cbd5e1',
                  marginVertical: 8,
                }}
                onPress={() => setOrderUrgent(!orderUrgent)}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 16 }}>{orderUrgent ? '⚡' : '⚪'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: orderUrgent ? '#991b1b' : '#334155' }}>
                    {orderUrgent ? '⚡ [ACİL TALEP]' : '⚡ Normal Talep'}
                  </Text>
                  <Text style={{ fontSize: 10, color: orderUrgent ? '#b91c1c' : '#64748b' }}>
                    {t.criticalStockAlert || 'Kasa ekranında acil öncelik bildirimi oluşturur'}
                  </Text>
                </View>
              </TouchableOpacity>

              {/* Tahmini Maliyet Özeti */}
              <View style={{ backgroundColor: '#f0fdf4', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#bbf7d0', marginBottom: 14 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: '#166534' }}>
                  💰 {t.costLabel || 'Maliyet'}:
                </Text>
                <Text style={{ fontSize: 18, fontWeight: '900', color: '#047857', marginTop: 2 }}>
                  {(Math.round((parseFloat(orderQuantity) || 0) * (orderModalItem?.price || 0))).toLocaleString('tr-TR')} ₺
                </Text>
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              <TouchableOpacity
                style={[styles.modalSubmitBtn, { backgroundColor: '#059669', flex: 1.5 }]}
                onPress={handleCreateOrderRequest}
              >
                <Text style={styles.modalSubmitTxt}>✓ {t.confirm || 'Talebi Aç ve Kasaya İlet'}</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setOrderModalItem(null)}>
                <Text style={styles.modalCancelTxt}>{t.cancel || 'Vazgeç'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 8: WEB BİREBİR RESTORAN EKİP İÇİ ANLIK SOHBET (RestaurantTeamChat) */}
      <Modal visible={showTeamChatModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '90%', height: '84%', padding: 14 }]}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', paddingBottom: 8 }}>
              <View style={{ flex: 1, marginRight: 8 }}>
                <Text style={[styles.modalTitle, { fontSize: 15, fontWeight: '800' }]}>💬 {t.teamChat || 'Restoran Ekip İçi Anlık Sohbet'}</Text>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 1 }} numberOfLines={1}>{t.interDeptComm || 'Departmanlar Arası Anlık Haberleşme'}</Text>
              </View>
              <TouchableOpacity
                style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: '#f1f5f9', alignItems: 'center', justifyContent: 'center' }}
                onPress={() => setShowTeamChatModal(false)}
              >
                <Text style={{ fontSize: 14, color: '#64748b', fontWeight: '800' }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Sohbet Kanalları Sekmeleri (Kompakt Şık Butonlar) */}
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, maxHeight: 34 }}>
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                {[
                  { id: 'general', label: `📢 ${t.chGeneralShort || 'Genel'}`, color: '#10b981' },
                  { id: 'kitchen', label: `🍳 ${t.chKitchenShort || 'Mutfak'}`, color: '#ea580c' },
                  { id: 'cashier', label: `💰 ${t.chCashierShort || 'Kasa'}`, color: '#047857' },
                  { id: 'shift', label: `📋 ${t.chShiftShort || 'Vardiya'}`, color: '#6366f1' },
                ].map((ch) => (
                  <TouchableOpacity
                    key={ch.id}
                    style={[
                      {
                        paddingHorizontal: 10,
                        paddingVertical: 5,
                        borderRadius: 20,
                        backgroundColor: '#f8fafc',
                        borderWidth: 1,
                        borderColor: '#e2e8f0',
                        alignItems: 'center',
                        justifyContent: 'center',
                      },
                      activeChatChannel === ch.id && { backgroundColor: ch.color, borderColor: ch.color },
                    ]}
                    onPress={() => setActiveChatChannel(ch.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={{ fontSize: 11, fontWeight: '700', color: activeChatChannel === ch.id ? '#ffffff' : '#475569' }}>
                      {ch.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            {/* Mesaj Listesi */}
            <ScrollView
              style={{ flex: 1, backgroundColor: '#f8faf9', borderRadius: 12, padding: 8, marginVertical: 4 }}
              contentContainerStyle={{ paddingBottom: 6 }}
              showsVerticalScrollIndicator={false}
            >
              {chatMessages
                .filter((m) => m.channelId === activeChatChannel)
                .map((m) => {
                  const isMe = m.sender === (currentUser?.name || 'Yetkili');
                  return (
                    <View
                      key={m.id}
                      style={{
                        backgroundColor: m.priority === 'urgent' ? '#fff5f5' : '#ffffff',
                        borderRadius: 10,
                        padding: 10,
                        marginBottom: 8,
                        borderLeftWidth: 3.5,
                        borderLeftColor: m.priority === 'urgent' ? '#ef4444' : isMe ? '#059669' : '#10b981',
                        borderWidth: 1,
                        borderColor: m.priority === 'urgent' ? '#fca5a5' : '#e2e8f0',
                        alignSelf: 'stretch',
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4, flexWrap: 'wrap', gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexShrink: 1 }}>
                          <View style={{ backgroundColor: '#0a1f11', width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }}>
                            <Text style={{ color: '#fff', fontSize: 9, fontWeight: '900' }}>{m.avatar}</Text>
                          </View>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: '#0f172a' }}>{m.sender}</Text>
                          {m.role && (
                            <View style={{ backgroundColor: '#f1f5f9', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '700', color: '#64748b' }}>{getRoleLabel(m.role, currentLang)}</Text>
                            </View>
                          )}
                          {m.priority === 'urgent' && (
                            <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4 }}>
                              <Text style={{ fontSize: 9, fontWeight: '800', color: '#b91c1c' }}>{t.urgentBadge || 'ACİL'}</Text>
                            </View>
                          )}
                        </View>
                        <Text style={{ fontSize: 10, color: '#94a3b8' }}>{m.time}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#334155', lineHeight: 17, flexWrap: 'wrap' }}>
                        {m.text}
                      </Text>
                    </View>
                  );
                })}
            </ScrollView>

            {/* Mesaj Yazma Alanı */}
            <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center', marginTop: 4 }}>
              <TouchableOpacity
                style={{
                  padding: 8,
                  borderRadius: 8,
                  backgroundColor: chatIsUrgent ? '#fee2e2' : '#f1f5f9',
                  borderWidth: 1,
                  borderColor: chatIsUrgent ? '#ef4444' : '#cbd5e1',
                }}
                onPress={() => setChatIsUrgent(!chatIsUrgent)}
              >
                <Text style={{ fontSize: 14 }}>{chatIsUrgent ? '⚡' : '⚪'}</Text>
              </TouchableOpacity>
              <TextInput
                style={[styles.modalInput, { flex: 1, minHeight: 38, paddingVertical: 6, paddingHorizontal: 10, marginBottom: 0 }]}
                placeholder={`${t.writeMessage || 'Mesaj yaz'}...`}
                placeholderTextColor={THEME.colors.textLight}
                value={chatInputMsg}
                onChangeText={setChatInputMsg}
              />
              <TouchableOpacity
                style={{
                  backgroundColor: '#059669',
                  paddingHorizontal: 12,
                  paddingVertical: 10,
                  borderRadius: 10,
                }}
                onPress={handleSendChatMessage}
              >
                <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }}>{t.confirm || 'Gönder'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Web ile Birebir Kaydırmalı & Sıkışmayan Alt Menü Çubuğu (Web NAV_ITEMS Sırası ile) */}
      <View style={[styles.bottomNavAndroid, { paddingBottom: androidBottomPadding, height: 60 + androidBottomPadding }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: 8, alignItems: 'center', gap: 6 }}
        >
          {/* 1. Finansal Özet */}
          {allowedScreens.includes('dashboard') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'dashboard' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('dashboard')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'dashboard' && styles.bottomNavIconActive]}>🏠</Text>
              <Text style={[styles.bottomNavLabel, currentScreen === 'dashboard' && styles.bottomNavLabelActive]}>
                {t.dashboard || 'Finansal Özet'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 2. Kasa & Muhasebe (Web /cashier) */}
          {(allowedScreens.includes('cashier') || allowedScreens.includes('accounting')) && (
            <TouchableOpacity
              style={[styles.bottomNavTab, (currentScreen === 'cashier' || currentScreen === 'accounting') && styles.bottomNavTabActive]}
              onPress={() => navigateTo('cashier')}
            >
              <Text style={[styles.bottomNavIcon, (currentScreen === 'cashier' || currentScreen === 'accounting') && styles.bottomNavIconActive]}>
                💰
              </Text>
              <Text style={[styles.bottomNavLabel, (currentScreen === 'cashier' || currentScreen === 'accounting') && styles.bottomNavLabelActive]}>
                {t.cashierAccounting || 'Kasa & Muhasebe'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3. Mali Müşavir Defteri (Web /advisor-ledger) */}
          {allowedScreens.includes('advisor') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'advisor' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('advisor')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'advisor' && styles.bottomNavIconActive]}>
                📖
              </Text>
              <Text style={[styles.bottomNavLabel, currentScreen === 'advisor' && styles.bottomNavLabelActive]}>
                {t.advisorLedger || 'Müşavir Defteri'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 3. Stok Yönetimi */}
          {allowedScreens.includes('inventory') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'inventory' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('inventory')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'inventory' && styles.bottomNavIconActive]}>📦</Text>
              <Text style={[styles.bottomNavLabel, currentScreen === 'inventory' && styles.bottomNavLabelActive]}>
                {t.inventory || 'Stok Yönetimi'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 4. Reçete Merkezi */}
          {allowedScreens.includes('recipes') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'recipes' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('recipes')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'recipes' && styles.bottomNavIconActive]}>📖</Text>
              <Text style={[styles.bottomNavLabel, currentScreen === 'recipes' && styles.bottomNavLabelActive]}>
                {t.recipes || 'Reçete Merkezi'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 5. Satış Analizi */}
          {allowedScreens.includes('sales') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'sales' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('sales')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'sales' && styles.bottomNavIconActive]}>📊</Text>
              <Text style={[styles.bottomNavLabel, currentScreen === 'sales' && styles.bottomNavLabelActive]}>
                {t.sales || 'Satış Analizi'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 6. Depo Terminali */}
          {allowedScreens.includes('warehouse') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'warehouse' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('warehouse')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'warehouse' && styles.bottomNavIconActive]}>🏬</Text>
              <Text style={[styles.bottomNavLabel, currentScreen === 'warehouse' && styles.bottomNavLabelActive]}>
                {t.warehouse || 'Depo & Mal Kabul'}
              </Text>
            </TouchableOpacity>
          )}

          {/* 7. Kullanıcı Yönetimi */}
          {allowedScreens.includes('users') && (
            <TouchableOpacity
              style={[styles.bottomNavTab, currentScreen === 'users' && styles.bottomNavTabActive]}
              onPress={() => navigateTo('users')}
            >
              <Text style={[styles.bottomNavIcon, currentScreen === 'users' && styles.bottomNavIconActive]}>👥</Text>
              <Text style={[styles.bottomNavLabel, currentScreen === 'users' && styles.bottomNavLabelActive]}>
                {t.users || 'Kullanıcı Yönetimi'}
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    paddingHorizontal: 12,
    minHeight: 48,
    borderRadius: 20,
    marginHorizontal: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.1)',
  },
  bottomNavTabActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    borderColor: '#10b981',
  },
  bottomNavIcon: {
    fontSize: 16,
    marginBottom: 2,
    opacity: 0.75,
  },
  bottomNavIconActive: {
    opacity: 1,
    transform: [{ scale: 1.05 }],
  },
  bottomNavLabel: {
    fontSize: 11,
    color: '#96be9f',
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  bottomNavLabelActive: {
    color: '#10b981',
    fontWeight: '900',
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
    padding: 10,
    borderWidth: 1,
    borderColor: '#dbe7df',
    shadowColor: '#0a1f11',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.03,
    shadowRadius: 6,
    elevation: 2,
    minHeight: 96,
    justifyContent: 'space-between',
    overflow: 'hidden',
  },
  webMetricHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  webMetricLabel: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#64748b',
    flex: 1,
    marginRight: 4,
  },
  webMetricIcon: {
    fontSize: 15,
  },
  webMetricValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0a1f11',
  },
  webMetricChange: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#059669',
    marginTop: 2,
  },
  webMetricSubTxt: {
    fontSize: 9.5,
    color: '#94a3b8',
    marginTop: 2,
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
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: '#dbe7df',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  webMiniStatVal: {
    fontSize: 15,
    fontWeight: '900',
    color: '#0a1f11',
    textAlign: 'center',
  },
  webMiniStatLbl: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#64748b',
    marginTop: 2,
    textAlign: 'center',
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
  catFilterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#dbe7df',
    marginRight: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  catFilterChipActive: {
    backgroundColor: '#0a1f11',
    borderColor: '#0a1f11',
  },
  catFilterTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#334155',
  },
  catFilterTxtActive: {
    color: '#ffffff',
    fontWeight: '800',
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
    overflow: 'hidden',
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
  // WEB İLE BİREBİR GİDER VE MALİ MÜŞAVİR KARTLARI
  webExpenseCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  webExpenseCardNeedsCorrection: {
    borderColor: '#fca5a5',
    borderWidth: 1.5,
    borderLeftWidth: 4,
    borderLeftColor: '#dc2626',
    backgroundColor: '#fffdfd',
  },
  webExpenseCardFinalized: {
    borderLeftWidth: 4,
    borderLeftColor: '#db2777',
  },
  expCardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  expCardTitle: {
    fontSize: 14.5,
    fontWeight: '900',
    color: '#0f172a',
    lineHeight: 20,
  },
  expOwnedPropertyBadge: {
    backgroundColor: '#dbeafe',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#bfdbfe',
  },
  expOwnedPropertyTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  expFinalizedLockBadge: {
    backgroundColor: '#fdf2f8',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: '#fbcfe8',
  },
  expFinalizedLockTxt: {
    fontSize: 10,
    fontWeight: '800',
    color: '#be185d',
  },
  expCardMetaTxt: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 16,
  },
  expCardNoteTxt: {
    fontSize: 11,
    color: '#475569',
    fontStyle: 'italic',
    marginTop: 3,
    lineHeight: 16,
  },
  expCardAmountTxt: {
    fontSize: 17,
    fontWeight: '900',
    color: '#0f172a',
  },
  expRejectionAlertBox: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    borderRadius: 8,
    padding: 8,
    marginBottom: 8,
  },
  expRejectionAlertTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#be123c',
    lineHeight: 16,
  },
  expDetailsGrid: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    marginBottom: 8,
  },
  expDetailCol: {
    flex: 1,
  },
  expDetailHeaderLbl: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  expDetailVendorTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#1e293b',
    lineHeight: 16,
  },
  expDetailInvoiceTxt: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 1,
  },
  expDetailDueTxt: {
    fontSize: 10.5,
    fontWeight: '800',
    marginTop: 2,
  },
  expCatPill: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  expCatPillTxt: {
    fontSize: 10.5,
    fontWeight: '800',
  },
  expSubtypeTxt: {
    fontSize: 11,
    color: '#475569',
    marginTop: 3,
  },
  expStatusBadgesRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  expBadgeHeaderLbl: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 3,
  },
  badgePaidBox: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  badgePaidTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#047857',
  },
  badgeUnpaidBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#f87171',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  badgeUnpaidTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b91c1c',
  },
  badgeUnpaidSubTxt: {
    fontSize: 9.5,
    color: '#dc2626',
    fontWeight: '700',
    marginTop: 2,
  },
  badgePartialBox: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fcd34d',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  badgePartialTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  badgeFinalizedBox: {
    backgroundColor: '#fdf2f8',
    borderWidth: 1,
    borderColor: '#fbcfe8',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  badgeFinalizedTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#be185d',
  },
  badgeNeedsCorrectionBox: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#f87171',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  badgeNeedsCorrectionTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#991b1b',
  },
  badgeRejectionSubTxt: {
    fontSize: 9.5,
    color: '#b91c1c',
    marginTop: 2,
    lineHeight: 13,
  },
  badgePendingBox: {
    backgroundColor: '#fffbeb',
    borderWidth: 1,
    borderColor: '#fde68a',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 14,
    alignSelf: 'flex-start',
  },
  badgePendingTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#b45309',
  },
  expActionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f8fafc',
  },
  webBtnPayDebt: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#6ee7b7',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBtnPayDebtTxt: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#065f46',
  },
  webBtnSendAdvisor: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#bfdbfe',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBtnSendAdvisorTxt: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#1d4ed8',
  },
  webBtnFinalizedBadge: {
    backgroundColor: '#fdf2f8',
    borderWidth: 1,
    borderColor: '#fbcfe8',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBtnFinalizedBadgeTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#be185d',
  },
  webBtnApprove: {
    backgroundColor: '#ecfdf5',
    borderWidth: 1,
    borderColor: '#a7f3d0',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBtnApproveTxt: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#065f46',
  },
  webBtnReject: {
    backgroundColor: '#fff1f2',
    borderWidth: 1,
    borderColor: '#fecdd3',
    paddingVertical: 7,
    paddingHorizontal: 11,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBtnRejectTxt: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#be123c',
  },
  webBtnTrashSquare: {
    backgroundColor: '#fee2e2',
    borderWidth: 1,
    borderColor: '#fecaca',
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  webBtnTrashSquareTxt: {
    fontSize: 14,
  },
});
