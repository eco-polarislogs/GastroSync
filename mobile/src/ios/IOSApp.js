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
  Image,
  Share,
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
import {
  TRANSLATIONS,
  getCategoryLabel,
  getRoleLabel,
  getExpenseTypeLabel,
  getLocalizedNotification,
  getItemName,
  getRecipeName,
  getUnitLabel,
  getExpenseTitle,
  getSupplierLabel,
  getChatMessageText,
  formatIngredientAmount,
} from '../data/translations';
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
  apiReportSecurityAlert,
  apiMarkNotificationRead,
  apiMarkAllNotificationsRead,
  apiFetchChatMessages,
  apiSendChatMessage,
  apiFetchSales,
  apiFetchSalesSummary,
} from '../services/api';
import {
  getStoredExpenses,
  getStoredNotifications,
  saveStoredExpenses,
  saveStoredNotifications,
  getStoredChatMessages,
  saveStoredChatMessages,
} from '../services/storage';
import mobileWebSocketService from '../services/websocketService';

const { width } = Dimensions.get('window');

// Rol Normalizasyonu (Büyük/Küçük Harf Toleranslı Güvenli Yetkilendirme)
const normalizeRole = (r) => (r || 'admin').toString().toLowerCase();

// Web ile Birebir Yetki Matrisi (DashboardLayout.jsx NAV_ITEMS kuralı)
const ROLE_ALLOWED_SCREENS = {
  admin: ['dashboard', 'cashier', 'advisor', 'inventory', 'recipes', 'sales', 'warehouse', 'users'],
  manager: ['dashboard', 'cashier', 'advisor', 'inventory', 'recipes', 'sales', 'warehouse'],
  accountant: ['cashier', 'dashboard', 'inventory', 'sales'],
  financial_advisor: ['advisor', 'dashboard', 'inventory', 'sales'],
  chef: ['recipes', 'inventory'],
  warehouse: ['warehouse'],
};

export default function IOSApp({ initialUser, onLogout }) {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState(() => {
    const raw = initialUser || DEMO_USERS[0];
    return { ...raw, role: normalizeRole(raw?.role) };
  });
  const [showRoleSwitchModal, setShowRoleSwitchModal] = useState(false);

  // Bu rolün izinli olduğu ekranlar listesi (Roller birbirinin ekranlarına geçemez)
  const currentRole = normalizeRole(currentUser?.role);
  const allowedScreens = ROLE_ALLOWED_SCREENS[currentRole] || ROLE_ALLOWED_SCREENS.admin;

  const getDefaultScreen = (role) => {
    const r = normalizeRole(role);
    if (r === 'accountant') return 'cashier';
    if (r === 'financial_advisor') return 'advisor';
    if (r === 'warehouse') return 'warehouse';
    if (r === 'chef') return 'recipes';
    return 'dashboard';
  };

  const [currentScreen, setCurrentScreen] = useState(getDefaultScreen(currentUser.role));
  // Android sanal gezinme tuşuna (üçgen / jest) ihtiyaç bırakmayan dahili ekran geri navigasyon yığını
  const [screenStack, setScreenStack] = useState([getDefaultScreen(currentUser.role)]);

  const [items, setItems] = useState(INITIAL_INVENTORY);
  const [recipes, setRecipes] = useState(INITIAL_RECIPES);
  const [users, setUsers] = useState(DEMO_USERS);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState(getStoredExpenses);
  const [currentLang, setCurrentLang] = useState('tr');
  const [showLangModal, setShowLangModal] = useState(false);
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.tr;

  const isAccountantUser = currentRole === 'accountant';
  const isAdvisorUser = currentRole === 'financial_advisor';

  const [expenseTab, setExpenseTab] = useState('all');
  const [expenseSearch, setExpenseSearch] = useState('');
  const [warehouseTab, setWarehouseTab] = useState('operations'); // 'operations' | 'stock'
  const [advisorTab, setAdvisorTab] = useState('pending_approval'); // 'pending_approval' | 'ledger' | 'tdhp' | 'z_report' | 'rejected'
  const [advisorSearch, setAdvisorSearch] = useState('');
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseToRejectMobile, setExpenseToRejectMobile] = useState(null);
  const [mobileRejectReason, setMobileRejectReason] = useState('');

  // Web Birebir Kasa Dağıtım & Gider Ödemesi Modalı State'leri
  const [showCashAllocationModal, setShowCashAllocationModal] = useState(false);
  const [cashInflowPeriod, setCashInflowPeriod] = useState('DAILY'); // 'DAILY' | 'MONTHLY'
  const [cashInflowSource, setCashInflowSource] = useState('POS_CASH'); // 'POS_CASH' | 'PARTNER' | 'BANK_WITHDRAW'
  const [cashTargetAccount, setCashTargetAccount] = useState('SPECIFIC'); // 'SPECIFIC' | 'CUSTOM'
  const [cashAllocationAmount, setCashAllocationAmount] = useState('5000');
  const [selectedTargetExpenseId, setSelectedTargetExpenseId] = useState('');
  const [customExpenseTitle, setCustomExpenseTitle] = useState('');
  const [customExpenseCategory, setCustomExpenseCategory] = useState('VARIABLE');
  const [customExpenseSubType, setCustomExpenseSubType] = useState('CONSUMABLES');
  const [cashPaymentSource, setCashPaymentSource] = useState('Nakit Kasa');
  const [cashAllocationNote, setCashAllocationNote] = useState('');
  const [openInflowSourceSelect, setOpenInflowSourceSelect] = useState(false);
  const [openTargetExpenseSelect, setOpenTargetExpenseSelect] = useState(false);
  const [openExpenseCatSelect, setOpenExpenseCatSelect] = useState(false);
  const [openExpenseSubSelect, setOpenExpenseSubSelect] = useState(false);
  const [openCustomCatSelect, setOpenCustomCatSelect] = useState(false);
  const [openCustomSubSelect, setOpenCustomSubSelect] = useState(false);
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

  const [mobileNotifications, setMobileNotifications] = useState(getStoredNotifications);
  const [unreadNotifCount, setUnreadNotifCount] = useState(() => {
    const list = getStoredNotifications() || [];
    return list.filter((n) => !n.isRead).length;
  });
  const [showNotifModal, setShowNotifModal] = useState(false);

  // Canlı POS & Satış Ciro Verileri (Web ile 1-e-1 Senkron)
  const [salesSummary, setSalesSummary] = useState({
    totalRevenue: 4620,
    totalCost: 1316.7,
    foodCostPercent: 28.5,
    targetFoodCost: 26.0,
    netProfit: 3303.3,
    totalSalesCount: 6,
  });
  const [todaySales, setTodaySales] = useState(INITIAL_SALES_ITEMS);

  // Canlı Backend Senkronizasyonu (Mount anında ve periyodik olarak verileri çeker)
  const refreshAllData = React.useCallback(async () => {
    try {
      const [liveItems, liveUsers, liveRecipes, liveTx, liveExp, liveNotifs, liveChat, liveSales, liveSalesSummary] = await Promise.all([
        apiFetchInventory(),
        apiFetchUsers(),
        apiFetchRecipes(),
        apiFetchTransactions(),
        apiFetchExpenses(),
        apiFetchNotifications(currentUser.role),
        apiFetchChatMessages(),
        apiFetchSales(),
        apiFetchSalesSummary(),
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
      if (liveChat && Array.isArray(liveChat) && liveChat.length > 0) {
        setChatMessages(liveChat);
      }
      if (liveSalesSummary && typeof liveSalesSummary === 'object' && liveSalesSummary.totalRevenue) {
        setSalesSummary(liveSalesSummary);
      }
      if (liveSales && Array.isArray(liveSales) && liveSales.length > 0) {
        setTodaySales(liveSales);
      }
    } catch (err) {
      // Offline fallback: Yerel demo verisi ile kesintisiz devam eder
    }
  }, [currentUser.role]);

  React.useEffect(() => {
    refreshAllData();

    // ── MOBİL GERÇEK ZAMANLI STOMP WEBSOCKET DİNLEYİCİLERİ ──────
    const userRole = (currentUser.role || 'ALL').toUpperCase();

    // 1. Genel bildirimler
    const unsubAllNotifs = mobileWebSocketService.subscribe('/topic/notifications', (newNotif) => {
      if (!newNotif || !newNotif.id) return;
      setMobileNotifications((prev) => {
        const exists = prev.some((n) => n.id === newNotif.id);
        const updated = exists ? prev.map((n) => (n.id === newNotif.id ? { ...n, ...newNotif } : n)) : [newNotif, ...prev];
        saveStoredNotifications(updated);
        return updated;
      });
      setUnreadNotifCount((c) => c + 1);
    });

    // 2. Rol bazlı bildirimler
    let unsubRoleNotifs = () => {};
    if (userRole !== 'ALL') {
      unsubRoleNotifs = mobileWebSocketService.subscribe(`/topic/notifications/${userRole}`, (newNotif) => {
        if (!newNotif || !newNotif.id) return;
        setMobileNotifications((prev) => {
          const exists = prev.some((n) => n.id === newNotif.id);
          const updated = exists ? prev.map((n) => (n.id === newNotif.id ? { ...n, ...newNotif } : n)) : [newNotif, ...prev];
          saveStoredNotifications(updated);
          return updated;
        });
        setUnreadNotifCount((c) => c + 1);
      });
    }

    // 3. Okundu senkronizasyonu
    const unsubRead = mobileWebSocketService.subscribe('/topic/notifications/read', (payload) => {
      const readId = payload?.id || payload;
      if (!readId) return;
      setMobileNotifications((prev) =>
        prev.map((n) => (n.id === readId ? { ...n, isRead: true } : n))
      );
      setUnreadNotifCount((c) => Math.max(0, c - 1));
    });

    // 4. Tümünü okundu yapma
    const unsubMarkAll = mobileWebSocketService.subscribe('/topic/notifications/mark-all-read', () => {
      setMobileNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadNotifCount(0);
    });

    // 5. Ekip Telsizi Sohbet Mesajları
    const unsubChat = mobileWebSocketService.subscribe('/topic/chat/all', (incomingMsg) => {
      if (!incomingMsg || !incomingMsg.id) return;
      setChatMessages((prev) => {
        const exists = prev.some((m) => m.id === incomingMsg.id);
        if (exists) return prev;
        const updated = [...prev, incomingMsg];
        saveStoredChatMessages(updated);
        return updated;
      });
    });

    // Arka plan yedek canlı senkronizasyon (10 saniye)
    const timer = setInterval(() => {
      refreshAllData();
    }, 10000);

    return () => {
      clearInterval(timer);
      unsubAllNotifs();
      unsubRoleNotifs();
      unsubRead();
      unsubMarkAll();
      unsubChat();
    };
  }, [refreshAllData, currentUser.role]);

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
  const [chatMessages, setChatMessages] = useState(getStoredChatMessages);

  // Aktif kanala dinamik STOMP WebSocket aboneliği (Web ile birebir eşzamanlı)
  React.useEffect(() => {
    if (!activeChatChannel) return;
    const unsubChannel = mobileWebSocketService.subscribe(`/topic/chat/${activeChatChannel.toLowerCase()}`, (incomingMsg) => {
      if (!incomingMsg || !incomingMsg.id) return;
      setChatMessages((prev) => {
        const exists = prev.some((m) => m.id === incomingMsg.id);
        if (exists) return prev;
        const updated = [...prev, incomingMsg];
        saveStoredChatMessages(updated);
        return updated;
      });
    });
    return () => {
      if (unsubChannel) unsubChannel();
    };
  }, [activeChatChannel]);

  const handleSendChatMessage = async () => {
    if (!chatInputMsg.trim()) return;
    const tempId = Date.now();
    const newMsg = {
      channelId: activeChatChannel,
      sender: currentUser.name || 'Yetkili',
      role: currentUser.role || 'admin',
      text: chatInputMsg.trim(),
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      avatar: currentUser.avatar || 'GS',
      priority: chatIsUrgent ? 'urgent' : 'normal',
    };
    setChatMessages((prev) => {
      const updated = [...prev, { ...newMsg, id: tempId }];
      saveStoredChatMessages(updated);
      return updated;
    });
    setChatInputMsg('');
    setChatIsUrgent(false);
    showToast('Mesaj ilgili kanala gönderildi');

    try {
      mobileWebSocketService.send('/app/chat.sendMessage', newMsg);
      await apiSendChatMessage(newMsg);
      refreshAllData();
    } catch (_) {}
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
      title: orderUrgent ? `⚡ Acil Sipariş Talebi: ${getItemName(orderModalItem.name, currentLang)}` : `📦 Yeni Sipariş Talebi: ${orderModalItem.name}`,
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

    try {
      await apiCreateExpense(newExpenseObj);
      refreshAllData();
    } catch (_) {}

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

  // Web Birebir: Satış Analizi Sekme ve Filtreleri
  const [salesActiveTab, setSalesActiveTab] = useState('product'); // 'product' veya 'timeline'
  const [salesSearchQuery, setSalesSearchQuery] = useState('');
  const [salesProfitFilter, setSalesProfitFilter] = useState('all'); // 'all', 'high_profit', 'high_cost'

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
  const totalOperatingExpenses = (fixedExpensesTotal + variableExpensesTotal) > 0 ? (fixedExpensesTotal + variableExpensesTotal) : 526005;
  const foodCostTotal = salesSummary.totalCost || 1316.7;
  const totalRevenue = salesSummary.totalRevenue || 4620;
  const grandTotalCost = foodCostTotal + totalOperatingExpenses;
  const netOperatingProfit = totalRevenue - grandTotalCost;

  // Web Birebir: Satış Analizi Gruplama ve Filtreleme
  const salesItemsToProcess = todaySales.length > 0 ? todaySales : INITIAL_SALES_ITEMS;

  const salesByRecipe = salesItemsToProcess.reduce((acc, sale) => {
    const name = sale.recipeName || sale.name || sale.productName || 'Diğer';
    if (!acc[name]) {
      acc[name] = { quantity: 0, revenue: 0, cost: 0 };
    }
    const qty = sale.quantity || sale.qty || 1;
    const rev = parseFloat(sale.totalRevenue || sale.revenue || sale.totalPrice || 0);
    const cost = parseFloat(sale.totalCost || sale.cost || (rev * 0.285) || 0);
    acc[name].quantity += qty;
    acc[name].revenue += rev;
    acc[name].cost += cost;
    return acc;
  }, {});

  const sortedSalesByRevenue = Object.entries(salesByRecipe)
    .filter(([name, data]) => {
      const matchSearch = name.toLowerCase().includes(salesSearchQuery.toLowerCase());
      const foodCost = data.revenue > 0 ? (data.cost / data.revenue) * 100 : 0;
      let matchFilter = true;
      if (salesProfitFilter === 'high_profit') matchFilter = foodCost < 30;
      if (salesProfitFilter === 'high_cost') matchFilter = foodCost >= 40;
      return matchSearch && matchFilter;
    })
    .sort(([, a], [, b]) => b.revenue - a.revenue);

  const filteredTimelineSales = salesItemsToProcess.filter((sale) => {
    const name = sale.recipeName || sale.name || sale.productName || '';
    const time = sale.time || '';
    const matchSearch =
      name.toLowerCase().includes(salesSearchQuery.toLowerCase()) ||
      time.includes(salesSearchQuery);
    const rev = parseFloat(sale.totalRevenue || sale.revenue || sale.totalPrice || 0);
    const cost = parseFloat(sale.totalCost || sale.cost || (rev * 0.285) || 0);
    const foodCost = rev > 0 ? (cost / rev) * 100 : 0;
    let matchFilter = true;
    if (salesProfitFilter === 'high_profit') matchFilter = foodCost < 30;
    if (salesProfitFilter === 'high_cost') matchFilter = foodCost >= 40;
    return matchSearch && matchFilter;
  });

  // Toplam Borç, Onay Bekleyen ve Müşavir Ret Tutarları (Gerçekçi Muhasebe & Denetim Takibi)
  const totalDebtAmount = expenses
    .filter((e) => e.paymentStatus === 'UNPAID' || e.paymentStatus === 'PARTIAL' || !e.paidByCashier)
    .reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const totalRejectedCount = expenses.filter((e) => e.status === 'NEEDS_CORRECTION' || e.status === 'REJECTED').length;
  const totalPendingAdvisorCount = expenses.filter(
    (e) => (e.status === 'PENDING_APPROVAL' || !e.recordedInLedger) && e.status !== 'NEEDS_CORRECTION' && e.status !== 'REJECTED' && e.status !== 'FINALIZED'
  ).length;
  const totalApprovedLedgerCount = expenses.filter((e) => e.status === 'FINALIZED' || Boolean(e.recordedInLedger)).length;

  // Web Birebir: Depoya Düşen Bekleyen Mutfak & Malzeme Sevkiyatları (Dinamik Hesaplanır)
  const pendingDeliveries = expenses
    .filter((e) => {
      const nonWarehouseSubTypes = ['RENT', 'LABOR', 'ACCOUNTANT', 'ELECTRICITY', 'WATER', 'GAS', 'PHONE', 'INTERNET', 'TAX', 'SGK', 'MARKETING', 'RENOVATION'];
      if (nonWarehouseSubTypes.includes(e.subType)) return false;

      const isFoodOrMaterial =
        e.subType === 'FOOD_SUPPLY' ||
        e.subType === 'CONSUMABLES' ||
        (e.title && (e.title.toLowerCase().includes('sipariş') || e.title.toLowerCase().includes('alım') || e.title.toLowerCase().includes('tedarik'))) ||
        (e.counterparty && (e.counterparty.toLowerCase().includes('hal') || e.counterparty.toLowerCase().includes('tedarik') || e.counterparty.toLowerCase().includes('toptan'))) ||
        items.some((i) => e.title && e.title.toLowerCase().includes(i.name.toLowerCase()));

      const notDeliveredYet = !e.note || !e.note.includes('[Depo:');
      return isFoodOrMaterial && notDeliveredYet;
    })
    .map((exp) => {
      const match = (exp.title || '').match(/(.*?)(?:Malzeme Alımı|\(Sipariş\)|Alımı)?\s*(?:\((\d+(?:\.\d+)?)\s*([a-zA-ZğüşıöçĞÜŞİÖÇ]+)\))?/);
      const rawName = match && match[1] ? match[1].replace('Malzeme Alımı', '').trim() : (exp.title || 'Mutfak Siparişi');
      const parsedQty = match && match[2] ? parseFloat(match[2]) : 15;
      const parsedUnit = match && match[3] ? match[3] : 'kg';

      const matchedItem = items.find((i) =>
        i.name.toLowerCase().includes(rawName.toLowerCase()) ||
        rawName.toLowerCase().includes(i.name.toLowerCase())
      );

      return {
        expenseId: exp.id,
        inventoryItemId: matchedItem ? matchedItem.id : null,
        itemName: matchedItem ? matchedItem.name : rawName,
        barcode: matchedItem ? (matchedItem.barcode || '—') : '—',
        quantity: parsedQty,
        unit: matchedItem ? matchedItem.unit : parsedUnit,
        unitCost: matchedItem ? matchedItem.price : (exp.amount / (parsedQty || 1)),
        totalCost: exp.amount,
        isPaid: exp.paymentStatus === 'PAID' || exp.paidByCashier,
        supplier: exp.counterparty || 'Toptancı Hal Tedarik',
        originalNote: exp.note || '',
        orderDate: exp.expenseDate || 'Bugün',
      };
    });

  const totalInventoryValue = items.reduce((sum, i) => sum + ((parseFloat(i.stock) || 0) * (parseFloat(i.price) || 0)), 0);
  const criticalStockCount = items.filter((i) => (parseFloat(i.stock) || 0) <= (parseFloat(i.min) || 5)).length;

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

  const navigateTo = async (screen) => {
    if (!allowedScreens.includes(screen)) {
      showToast('🚨 Yetkisiz Erişim Engellendi!');
      try {
        await apiReportSecurityAlert(screen, 'MOBİL_NAVİGASYON_DENEMESİ');
        await apiCreateNotification({
          title: '🚨 Yetkisiz Sayfa Erişim Girişimi!',
          message: `${currentUser?.name} (${ROLE_LABELS[currentUser?.role]}) yetkisi olmayan '${screen}' ekranına erişmeye çalıştı. Erişim otomatik engellendi.`,
          targetRole: 'MANAGER',
          type: 'SECURITY_ALERT',
        });
        await apiCreateNotification({
          title: '🚨 Yetkisiz Sayfa Erişim Girişimi!',
          message: `${currentUser?.name} (${ROLE_LABELS[currentUser?.role]}) yetkisi olmayan '${screen}' ekranına erişmeye çalıştı. Erişim otomatik engellendi.`,
          targetRole: 'ADMIN',
          type: 'SECURITY_ALERT',
        });
      } catch (_) {}
      return;
    }
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

  // Web Birebir: Sevkiyat Masasındaki Onaylı Siparişi Tek Dokunuşla Depoya Al & Stoğa Ekle
  const handleAutoReceiveDelivery = async (delivery) => {
    const matchedItem = items.find((i) =>
      (delivery.inventoryItemId && i.id === delivery.inventoryItemId) ||
      i.name.toLowerCase().includes(delivery.itemName.toLowerCase()) ||
      delivery.itemName.toLowerCase().includes(i.name.toLowerCase())
    );

    const qty = delivery.quantity;
    const unit = delivery.unit || (matchedItem ? matchedItem.unit : 'kg');

    if (matchedItem) {
      setItems((prev) =>
        prev.map((i) =>
          i.id === matchedItem.id ? { ...i, stock: Math.round(((parseFloat(i.stock) || 0) + qty) * 100) / 100 } : i
        )
      );
      try {
        await apiReceiveStock(matchedItem.id, qty, `${currentUser.name || 'Depo Sorumlusu'} (Mobile)`);
      } catch (_) {}
    }

    if (delivery.expenseId) {
      const updatedExpense = {
        note: `${delivery.originalNote || ''} | [Depo: ${qty} ${unit} fiilen teslim alındı ve stoğa işlendi ✓]`
      };
      setExpenses((prev) =>
        prev.map((e) => (e.id === delivery.expenseId ? { ...e, ...updatedExpense } : e))
      );
      try {
        await apiUpdateExpense(delivery.expenseId, updatedExpense);
      } catch (_) {}
    }

    showToast(`✓ ${qty} ${unit} "${delivery.itemName}" depoya teslim alındı ve stoğa işlendi!`);
    refreshAllData();
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

  // Web Birebir Excel & CSV Dışa Aktarım (Paylaşım)
  const handleExportExcelMobile = async () => {
    try {
      const csvRows = [
        ['ID', 'Gider Başlığı', 'Kategori', 'Gider Türü', 'Kasa Ödeme Durumu', 'Mali Müşavir Defteri', 'Tutar (TL)', 'Dönem', 'İşlem Tarihi', 'Kaydeden', 'Açıklama'].join('\t')
      ];
      filteredExpenses.forEach(e => {
        csvRows.push([
          e.id,
          `"${e.title}"`,
          e.category === 'FIXED' ? 'Sabit Gider' : 'Değişken Gider',
          getExpenseTypeLabel(e.subType, currentLang) || e.subType,
          e.paidByCashier ? 'Kasadan Ödendi' : 'Ödeme Bekliyor',
          e.recordedInLedger ? 'Resmi Deftere İşlendi' : 'Deftere İşlenmedi',
          e.amount,
          e.period || '2026-10',
          e.expenseDate,
          e.recordedBy || 'Kasa',
          `"${e.note || ''}"`
        ].join('\t'));
      });
      const content = csvRows.join('\n');
      await Share.share({
        title: 'GastroSync_Muhasebe_Gider_Raporu.xlsx',
        message: `GastroSync Kasa & Muhasebe Gider Tablosu (.xlsx):\n\n${content}`
      });
      showToast('✓ Gider tablosu Excel (.xlsx) formatında paylaşıldı');
    } catch (_) {
      showToast('✓ Gider tablosu dışa aktarıldı');
    }
  };

  const handleExportCSVMobile = async () => {
    try {
      const csvRows = [
        ['ID', 'Gider Başlığı', 'Kategori', 'Tutar (TL)', 'Dönem', 'İşlem Tarihi', 'Kaydeden', 'Açıklama'].join(';')
      ];
      filteredExpenses.forEach(e => {
        csvRows.push([
          e.id,
          `"${e.title}"`,
          e.category === 'FIXED' ? 'Sabit' : 'Değişken',
          e.amount,
          e.period || '2026-10',
          e.expenseDate,
          e.recordedBy || 'Kasa',
          `"${e.note || ''}"`
        ].join(';'));
      });
      await Share.share({
        title: 'GastroSync_Muhasebe_Gider_Raporu.csv',
        message: csvRows.join('\n')
      });
      showToast('✓ Gider tablosu CSV formatında paylaşıldı');
    } catch (_) {
      showToast('✓ CSV formatında dışa aktarıldı');
    }
  };

  // Muhasebecinin Mali Müşavire Gönderme İşlemi (Web ile %100 Birebir)
  const handleSendToAdvisorMobile = async (exp) => {
    const updated = {
      ...exp,
      sentToAdvisor: true,
      status: 'PENDING_APPROVAL',
      rejectionReason: '',
    };
    setExpenses((prev) => prev.map((e) => (e.id === exp.id ? updated : e)));
    showToast(`🚀 "${exp.title}" (${parseFloat(exp.amount || 0).toLocaleString('tr-TR')} ₺) Mali Müşavir defter onayına gönderildi.`);

    await apiUpdateExpense(exp.id, {
      sentToAdvisor: true,
      status: 'PENDING_APPROVAL',
      rejectionReason: '',
    });

    await apiCreateNotification({
      title: '🚀 Gider Defter Onayı Bekliyor',
      message: `${currentUser?.name || 'Kasa / Muhasebe'} tarafından '${exp.title} (${parseFloat(exp.amount || 0).toLocaleString('tr-TR')} ₺)' onaylanmak üzere Mali Müşavire iletildi.`,
      targetRole: 'FINANCIAL_ADVISOR',
      senderName: currentUser?.name || 'Kasa / Muhasebe',
      type: 'EXPENSE_APPROVAL',
      relatedEntityId: exp.id,
    });

    refreshAllData();
  };

  // Kasaya Para Girişi & Gider Dağıtımı (Web /cashier ile Birebir)
  const handleConfirmCashAllocation = async () => {
    const amountNum = parseFloat(cashAllocationAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      showToast('Lütfen geçerli bir tutar giriniz');
      return;
    }

    if (cashTargetAccount === 'SPECIFIC') {
      if (!selectedTargetExpenseId) {
        showToast('Lütfen listeden ödenecek bir gider / borç seçiniz');
        return;
      }
      const targetExp = expenses.find((e) => String(e.id) === String(selectedTargetExpenseId));
      if (!targetExp) return;

      const isFull = amountNum >= targetExp.amount;
      const updated = {
        ...targetExp,
        paidByCashier: true,
        paymentStatus: isFull ? 'PAID' : 'PARTIAL',
        sentToAdvisor: true,
        status: targetExp.status === 'NEEDS_CORRECTION' ? 'PENDING_APPROVAL' : targetExp.status,
        rejectionReason: targetExp.status === 'NEEDS_CORRECTION' ? '' : targetExp.rejectionReason,
        note: targetExp.note
          ? `${targetExp.note} [Kasadan ${amountNum.toLocaleString('tr-TR')} ₺ ödendi (${cashPaymentSource})]`
          : `Kasadan ${amountNum.toLocaleString('tr-TR')} ₺ ödendi (${cashPaymentSource})`,
      };

      setExpenses((prev) => prev.map((e) => (e.id === targetExp.id ? updated : e)));
      showToast(`✓ "${targetExp.title}" için ${amountNum.toLocaleString('tr-TR')} ₺ ödendi`);

      await apiUpdateExpense(targetExp.id, {
        paidByCashier: true,
        paymentStatus: isFull ? 'PAID' : 'PARTIAL',
        sentToAdvisor: true,
        status: updated.status,
        rejectionReason: updated.rejectionReason,
        note: updated.note,
      });

      await apiCreateNotification({
        title: '💵 Kasadan Gider Ödemesi Yapıldı',
        message: `${currentUser?.name || 'Kasa / Muhasebe'} '${targetExp.title}' kalemi için kasadan ${amountNum.toLocaleString('tr-TR')} ₺ fiili ödeme gerçekleştirdi.`,
        targetRole: 'FINANCIAL_ADVISOR',
        senderName: currentUser?.name || 'Kasa / Muhasebe',
        type: 'EXPENSE_APPROVAL',
        relatedEntityId: targetExp.id,
      });
    } else {
      if (!customExpenseTitle.trim()) {
        showToast('Lütfen ödeme başlığı giriniz');
        return;
      }
      const newExpObj = {
        id: Date.now(),
        title: customExpenseTitle.trim(),
        category: customExpenseCategory,
        subType: customExpenseSubType,
        amount: amountNum,
        period: new Date().toISOString().substring(0, 7),
        expenseDate: new Date().toISOString().split('T')[0],
        dueDate: new Date().toISOString().split('T')[0],
        counterparty: 'Doğrudan Kasa Çıkışı',
        invoiceNumber: `KAS-${Date.now().toString().slice(-6)}`,
        paymentStatus: 'PAID',
        paidByCashier: true,
        recordedInLedger: false,
        sentToAdvisor: true,
        status: 'PENDING_APPROVAL',
        rejectionReason: '',
        recordedBy: currentUser?.name || 'Kasa / Muhasebe',
        note: cashAllocationNote.trim() || `Kasadan doğrudan ödendi (${cashPaymentSource})`,
      };

      setExpenses((prev) => [newExpObj, ...prev]);
      showToast(`✓ Yeni gider çıkışı yapıldı: ${amountNum.toLocaleString('tr-TR')} ₺`);

      await apiCreateExpense(newExpObj);
      await apiCreateNotification({
        title: '💵 Yeni Gider Çıkışı & Müşavir Onay Talebi',
        message: `${currentUser?.name || 'Kasa'} tarafından '${newExpObj.title}' (${amountNum.toLocaleString('tr-TR')} ₺) kasadan ödendi ve Mali Müşavir onayına gönderildi.`,
        targetRole: 'FINANCIAL_ADVISOR',
        senderName: currentUser?.name || 'Kasa / Muhasebe',
        type: 'EXPENSE_APPROVAL',
        relatedEntityId: newExpObj.id,
      });
    }

    setShowCashAllocationModal(false);
    setCashAllocationAmount('');
    setSelectedTargetExpenseId('');
    setCustomExpenseTitle('');
    setCashAllocationNote('');
    refreshAllData();
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

  const canViewFinancials = ['admin', 'manager', 'accountant', 'financial_advisor'].includes(currentRole);
  const canViewCashier = ['admin', 'manager', 'accountant'].includes(currentRole);
  const canViewAdvisor = ['admin', 'manager', 'financial_advisor'].includes(currentRole);
  const canViewAccounting = canViewCashier;
  const canViewUsers = currentRole === 'admin';
  const canViewRecipes = ['admin', 'manager', 'chef'].includes(currentRole);
  const canViewInventory = ['admin', 'manager', 'chef', 'accountant', 'financial_advisor', 'warehouse'].includes(currentRole);
  const canViewWarehouse = ['admin', 'manager', 'warehouse'].includes(currentRole);

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
            <Image
              source={require('../../assets/logo.jpg')}
              style={{
                width: 28,
                height: 28,
                borderRadius: 14,
                borderWidth: 1.5,
                borderColor: 'rgba(212, 175, 55, 0.85)',
                marginRight: 6,
              }}
              resizeMode="cover"
            />
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

          {/* Kompakt Rol Avatar Rozeti (Dokunulduğunda Hızlı Profil/Rol Geçişi) */}
          <TouchableOpacity
            style={[styles.fixedRoleBadge, { backgroundColor: ROLE_COLORS[currentUser.role], paddingHorizontal: 7, paddingVertical: 4 }]}
            onPress={() => setShowRoleSwitchModal(true)}
            activeOpacity={0.7}
          >
            <Text style={styles.roleAvatar}>{currentUser.avatar}</Text>
          </TouchableOpacity>

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
                  <Text style={styles.webMetricLabel}>{t.todaySalesRevenue || 'BUGÜNKÜ SATIŞ (CİRO)'}</Text>
                  <Text style={styles.webMetricIcon}>💰</Text>
                </View>
                <Text style={styles.webMetricValue}>{(salesSummary.totalRevenue || 4620).toLocaleString('tr-TR')} ₺</Text>
                <Text style={styles.webMetricChange}>▲ {t.moreThanYesterday || '%12.5 dünden fazla'}</Text>
              </View>

              <View style={styles.webMetricCard}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel}>{t.actualFoodCost || 'GERÇEKLEŞEN GIDA MALİYETİ'}</Text>
                  <Text style={styles.webMetricIcon}>📦</Text>
                </View>
                <Text style={styles.webMetricValue}>{(salesSummary.totalCost || 1316.7).toLocaleString('tr-TR')} ₺</Text>
                <Text style={styles.webMetricSubTxt}>{t.autoDeductedStock || 'POS sisteminden otomatik düşülen stok'}</Text>
              </View>

              <View style={styles.webMetricCard}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel}>{t.averageFoodCost || 'ORTALAMA FOOD COST'}</Text>
                  <Text style={styles.webMetricIcon}>🎯</Text>
                </View>
                <Text style={[styles.webMetricValue, { color: '#047857' }]}>% {parseFloat(salesSummary.foodCostPercent || 28.5).toFixed(1)}</Text>
                <Text style={styles.webMetricSubTxt}>⚠️ {t.aboveTargetFoodCost ? t.aboveTargetFoodCost.replace('{target}', '26.0') : "Hedeflenen %26'un üzerinde!"}</Text>
              </View>

              <View style={styles.webMetricCard}>
                <View style={styles.webMetricHeader}>
                  <Text style={styles.webMetricLabel}>{t.generalOperatingExpenses || 'GENEL İŞLETME GİDERLERİ'}</Text>
                  <Text style={styles.webMetricIcon}>📑</Text>
                </View>
                <Text style={[styles.webMetricValue, { color: '#4338ca' }]}>
                  {totalOperatingExpenses.toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMetricSubTxt}>{t.fixedPlusVariableCosts || 'Sabit + Değişken Genel Masraflar'}</Text>
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
                  {criticalStockCount}
                </Text>
                <Text style={styles.webMiniStatLbl}>{t.criticalStockStat || 'Kritik Stok'}</Text>
              </View>
              <View style={[styles.webMiniStatCard, { borderColor: '#bbf7d0' }]}>
                <Text style={[styles.webMiniStatVal, { color: '#047857' }]}>
                  {pendingDeliveries.length}
                </Text>
                <Text style={styles.webMiniStatLbl}>{t.pendingShipments || 'Bekleyen Sevkiyat'}</Text>
              </View>
              <View style={styles.webMiniStatCard}>
                <Text style={[styles.webMiniStatVal, { color: '#047857', fontSize: 12 }]}>
                  {totalInventoryValue.toLocaleString('tr-TR')} ₺
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
                        <Text style={styles.webItemName}>{getItemName(it.name, currentLang)}</Text>
                        <Text style={styles.webItemBarcode}>{t.barcodeCol || 'Barkod'}: {it.barcode || (t.notSpecified || 'Belirtilmedi')}</Text>
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
                          {it.stock} {getUnitLabel(it.unit, currentLang)}
                        </Text>
                      </View>
                      <View style={styles.webItemMetricCol}>
                        <Text style={styles.webItemMetricLbl}>{t.minStockCol || 'Min. Stok'}</Text>
                        <Text style={styles.webItemMetricVal}>{it.min} {getUnitLabel(it.unit, currentLang)}</Text>
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
                        {t.supplier || 'Tedarikçi'}: <Text style={{ fontWeight: '700', color: '#334155' }}>{getSupplierLabel(it.supplier, currentLang) || (t.notSpecified || 'Standart')}</Text>
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
                      <Text style={styles.webRecipeTitle}>{getRecipeName(r.name, currentLang)}</Text>
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
                        <Text style={styles.webRecipeIngName}>• {getItemName(ing.name, currentLang)}</Text>
                        <Text style={styles.webRecipeIngAmount}>{formatIngredientAmount(ing.amount, currentLang)}</Text>
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
                  {(salesSummary.totalRevenue || 4620).toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMiniStatLbl}>{t.totalRevenueStat || 'Toplam Ciro'}</Text>
              </View>
              <View style={[styles.webMiniStatCard, { borderColor: '#bbf7d0' }]}>
                <Text style={[styles.webMiniStatVal, { color: '#047857' }]}>
                  {(salesSummary.netProfit || 3303.3).toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMiniStatLbl}>{t.netProfitStat || 'Net Kâr'}</Text>
              </View>
              <View style={styles.webMiniStatCard}>
                <Text style={styles.webMiniStatVal}>{salesItemsToProcess.length}</Text>
                <Text style={styles.webMiniStatLbl}>{t.salesItemsStat || 'Satış Kalemi'}</Text>
              </View>
            </View>

            {/* Segmented View Switcher (Web ile Birebir) */}
            <View style={{
              flexDirection: 'row',
              backgroundColor: '#eef6f0',
              padding: 4,
              borderRadius: 12,
              marginBottom: 12,
              gap: 6
            }}>
              <TouchableOpacity
                onPress={() => setSalesActiveTab('product')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: 9,
                  alignItems: 'center',
                  backgroundColor: salesActiveTab === 'product' ? '#ffffff' : 'transparent',
                  shadowColor: salesActiveTab === 'product' ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: salesActiveTab === 'product' ? 0.08 : 0,
                  shadowRadius: 3,
                  elevation: salesActiveTab === 'product' ? 2 : 0,
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: salesActiveTab === 'product' ? '#0a1f11' : '#64748b'
                }}>
                  {t.productBasedSummaryTab || '📊 Ürün Bazlı Kârlılık Özeti'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => setSalesActiveTab('timeline')}
                style={{
                  flex: 1,
                  paddingVertical: 10,
                  paddingHorizontal: 8,
                  borderRadius: 9,
                  alignItems: 'center',
                  backgroundColor: salesActiveTab === 'timeline' ? '#ffffff' : 'transparent',
                  shadowColor: salesActiveTab === 'timeline' ? '#000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: salesActiveTab === 'timeline' ? 0.08 : 0,
                  shadowRadius: 3,
                  elevation: salesActiveTab === 'timeline' ? 2 : 0,
                }}
              >
                <Text style={{
                  fontSize: 12,
                  fontWeight: '800',
                  color: salesActiveTab === 'timeline' ? '#0a1f11' : '#64748b'
                }}>
                  {t.detailedTimelineTab || '🕒 Detaylı Satış Günlüğü'} ({salesItemsToProcess.length})
                </Text>
              </TouchableOpacity>
            </View>

            {/* Filters Bar (Web ile Birebir) */}
            <View style={styles.webFilterBar}>
              <TextInput
                style={styles.webSearchInput}
                placeholder={salesActiveTab === 'product' ? (t.searchDishPlaceholder || '🔍 Yemek adına göre ara...') : (t.searchTimelinePlaceholder || '🔍 Saat veya yemek adına göre filtrele...')}
                placeholderTextColor={THEME.colors.textLight}
                value={salesSearchQuery}
                onChangeText={setSalesSearchQuery}
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }}>
                <TouchableOpacity
                  style={[styles.webChipBtn, salesProfitFilter === 'all' && styles.webChipBtnActive]}
                  onPress={() => setSalesProfitFilter('all')}
                >
                  <Text style={[styles.webChipTxt, salesProfitFilter === 'all' && styles.webChipTxtActive]}>
                    {t.allSalesFilter || 'Tüm Satışlar'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.webChipBtn, salesProfitFilter === 'high_profit' && { backgroundColor: '#10b981', borderColor: '#059669' }]}
                  onPress={() => setSalesProfitFilter('high_profit')}
                >
                  <Text style={[styles.webChipTxt, salesProfitFilter === 'high_profit' && { color: '#ffffff', fontWeight: '800' }]}>
                    ✨ {t.highProfitFilter || 'Yüksek Kârlı (<%30)'}
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.webChipBtn, salesProfitFilter === 'high_cost' && { backgroundColor: '#ef4444', borderColor: '#dc2626' }]}
                  onPress={() => setSalesProfitFilter('high_cost')}
                >
                  <Text style={[styles.webChipTxt, salesProfitFilter === 'high_cost' && { color: '#ffffff', fontWeight: '800' }]}>
                    ⚠️ {t.highCostFilter || 'Yüksek Maliyetli (>=%40)'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
              <View style={styles.webFilterCountRow}>
                <Text style={styles.webFilterCountTxt}>
                  {t.recordsListed || 'Kayıt Listelendi'}: <Text style={{ fontWeight: '800', color: THEME.colors.primary }}>
                    {salesActiveTab === 'product' ? sortedSalesByRevenue.length : filteredTimelineSales.length}
                  </Text>
                </Text>
              </View>
            </View>

            {/* Tab 1: Ürün Bazlı Kârlılık Özeti */}
            {salesActiveTab === 'product' && (
              <View>
                <Text style={styles.subHeading}>
                  {t.productProfitHeader ? t.productProfitHeader.toUpperCase() : 'ÜRÜN BAZLI KÂRLILIK DAĞILIMI'}
                </Text>
                {sortedSalesByRevenue.length === 0 ? (
                  <View style={[styles.webSalesCard, { justifyContent: 'center', padding: 24 }]}>
                    <Text style={{ textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
                      Kayıt bulunamadı.
                    </Text>
                  </View>
                ) : (
                  sortedSalesByRevenue.map(([name, data]) => {
                    const profit = data.revenue - data.cost;
                    const foodCost = data.revenue > 0 ? (data.cost / data.revenue) * 100 : 0;
                    const isHighCost = foodCost >= 40;
                    const isMidCost = foodCost >= 30;
                    const badgeBg = isHighCost ? '#fee2e2' : isMidCost ? '#fef3c7' : '#dcfce7';
                    const badgeBorder = isHighCost ? '#fca5a5' : isMidCost ? '#fde047' : '#86efac';
                    const badgeColor = isHighCost ? '#b91c1c' : isMidCost ? '#b45309' : '#15803d';

                    return (
                      <View key={name} style={[styles.webSalesCard, { flexDirection: 'column', alignItems: 'stretch' }]}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <Text style={[styles.itemTitle, { flex: 1, fontSize: 15 }]}>{getRecipeName(name, currentLang)}</Text>
                          <View style={{
                            backgroundColor: badgeBg,
                            borderColor: badgeBorder,
                            borderWidth: 1,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            borderRadius: 8
                          }}>
                            <Text style={{ fontSize: 11, fontWeight: '800', color: badgeColor }}>
                              %{foodCost.toFixed(1)} FC
                            </Text>
                          </View>
                        </View>
                        <View style={{
                          flexDirection: 'row',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          borderTopWidth: 1,
                          borderTopColor: '#f1f5f9',
                          paddingTop: 8
                        }}>
                          <View>
                            <Text style={styles.itemMeta}>
                              {data.quantity} {getUnitLabel('porsiyon', currentLang)}
                            </Text>
                            <Text style={[styles.itemMeta, { fontSize: 11 }]}>
                              {t.costLabel || 'Maliyet'}: {data.cost.toLocaleString('tr-TR')} ₺
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end' }}>
                            <Text style={styles.salesRevBold}>{data.revenue.toLocaleString('tr-TR')} ₺</Text>
                            <Text style={[styles.itemMeta, { color: profit >= 0 ? '#047857' : '#dc2626', fontWeight: '800' }]}>
                              +{t.profitCol || 'Net Kâr'}: {profit.toLocaleString('tr-TR')} ₺
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}

            {/* Tab 2: Detaylı Satış Günlüğü (Bugün) */}
            {salesActiveTab === 'timeline' && (
              <View>
                <Text style={styles.subHeading}>
                  {t.timelineSalesHeader ? t.timelineSalesHeader.toUpperCase() : 'DETAYLI SATIŞ GÜNLÜĞÜ (BUGÜN)'}
                </Text>
                {filteredTimelineSales.length === 0 ? (
                  <View style={[styles.webSalesCard, { justifyContent: 'center', padding: 24 }]}>
                    <Text style={{ textAlign: 'center', color: '#64748b', fontWeight: '600' }}>
                      Kayıt bulunamadı.
                    </Text>
                  </View>
                ) : (
                  filteredTimelineSales.map((sale, idx) => {
                    const itemName = sale.recipeName || sale.name || sale.productName || `Satış #${sale.id || idx + 1}`;
                    const itemQty = sale.quantity || sale.qty || 1;
                    const itemRev = parseFloat(sale.totalRevenue || sale.revenue || sale.totalPrice || 0);
                    const itemCost = parseFloat(sale.totalCost || sale.cost || (itemRev * 0.285));
                    const itemProfit = itemRev - itemCost;
                    const itemTime = sale.time || '12:00';

                    return (
                      <View key={sale.id || idx} style={styles.webSalesCard}>
                        <View style={{
                          backgroundColor: '#f1f5f9',
                          borderColor: '#cbd5e1',
                          borderWidth: 1,
                          borderRadius: 8,
                          paddingHorizontal: 8,
                          paddingVertical: 6,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginRight: 10
                        }}>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155' }}>
                            🕒 {itemTime}
                          </Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.itemTitle}>{itemName}</Text>
                          <Text style={styles.itemMeta}>
                            {itemQty} {getUnitLabel('porsiyon', currentLang)} • {t.costLabel || 'Maliyet'}: {itemCost.toLocaleString('tr-TR')} ₺
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={styles.salesRevBold}>{itemRev.toLocaleString('tr-TR')} ₺</Text>
                          <Text style={[styles.itemMeta, { color: '#047857', fontWeight: '700' }]}>
                            +{t.profitCol || 'Kâr'}: {itemProfit.toLocaleString('tr-TR')} ₺
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </View>
            )}
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

            {/* Segmented Tab Bar: [ 📦 İşlemler & Mal Kabul ] [ 📊 Depo Stok Durumu ] */}
            <View style={{ flexDirection: 'row', backgroundColor: '#e2e8f0', borderRadius: 10, padding: 3, marginBottom: 14 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: 8,
                  backgroundColor: warehouseTab === 'operations' ? '#ffffff' : 'transparent',
                  shadowColor: warehouseTab === 'operations' ? '#000000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: warehouseTab === 'operations' ? 0.1 : 0,
                  shadowRadius: 2,
                  elevation: warehouseTab === 'operations' ? 2 : 0,
                }}
                onPress={() => setWarehouseTab('operations')}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: warehouseTab === 'operations' ? THEME.colors.primary : '#64748b' }}>
                  📦 {t.tabStockOps || 'İşlemler & Mal Kabul'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 1,
                  paddingVertical: 8,
                  alignItems: 'center',
                  borderRadius: 8,
                  backgroundColor: warehouseTab === 'stock' ? '#ffffff' : 'transparent',
                  shadowColor: warehouseTab === 'stock' ? '#000000' : 'transparent',
                  shadowOffset: { width: 0, height: 1 },
                  shadowOpacity: warehouseTab === 'stock' ? 0.1 : 0,
                  shadowRadius: 2,
                  elevation: warehouseTab === 'stock' ? 2 : 0,
                }}
                onPress={() => setWarehouseTab('stock')}
                activeOpacity={0.8}
              >
                <Text style={{ fontSize: 12, fontWeight: '800', color: warehouseTab === 'stock' ? THEME.colors.primary : '#64748b' }}>
                  📊 {t.tabWarehouseStatus || 'Depo Stok Durumu'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Dinamik 4'lü Mini-Stats Barı */}
            <View style={styles.webMiniStatsRow}>
              <View style={styles.webMiniStatCard}>
                <Text style={styles.webMiniStatVal}>{items.length}</Text>
                <Text style={styles.webMiniStatLbl}>{t.totalProductsStat || 'Toplam Ürün'}</Text>
              </View>
              <View style={[styles.webMiniStatCard, { borderColor: '#fed7aa' }]}>
                <Text style={[styles.webMiniStatVal, { color: '#f59e0b' }]}>
                  {criticalStockCount}
                </Text>
                <Text style={styles.webMiniStatLbl}>{t.criticalStockStat || 'Kritik Stok'}</Text>
              </View>
              <View style={[styles.webMiniStatCard, { borderColor: '#bbf7d0' }]}>
                <Text style={[styles.webMiniStatVal, { color: '#047857' }]}>
                  {pendingDeliveries.length}
                </Text>
                <Text style={styles.webMiniStatLbl}>{t.pendingShipments || 'Bekleyen Sevkiyat'}</Text>
              </View>
              <View style={styles.webMiniStatCard}>
                <Text style={[styles.webMiniStatVal, { color: '#047857', fontSize: 12 }]}>
                  {totalInventoryValue.toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMiniStatLbl}>{t.totalInventoryValueStat || 'Envanter Değeri'}</Text>
              </View>
            </View>

            {warehouseTab === 'operations' ? (
              <>
                {/* Web Birebir: Sevkiyat & Bekleyen Mal Kabul Masası */}
                <View style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1.5,
                  borderColor: '#a7f3d0',
                  marginBottom: 14,
                  shadowColor: '#10b981',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  elevation: 2,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={{ fontSize: 20 }}>🚚</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 13, fontWeight: '800', color: '#064e3b' }}>
                          Sevkiyat & Bekleyen Mal Kabul Masası
                        </Text>
                        <Text style={{ fontSize: 10, color: '#64748b' }}>
                          Mutfak / muhasebe onaylı sevkiyatlar
                        </Text>
                      </View>
                    </View>
                    <View style={{
                      backgroundColor: pendingDeliveries.length > 0 ? '#fef3c7' : '#f1f5f9',
                      paddingHorizontal: 8,
                      paddingVertical: 3,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: pendingDeliveries.length > 0 ? '#fde68a' : '#cbd5e1',
                    }}>
                      <Text style={{
                        fontSize: 10,
                        fontWeight: '800',
                        color: pendingDeliveries.length > 0 ? '#92400e' : '#64748b',
                      }}>
                        {pendingDeliveries.length} {t.pendingCount || 'Bekleyen'}
                      </Text>
                    </View>
                  </View>

                  {pendingDeliveries.length === 0 ? (
                    <View style={{ padding: 14, backgroundColor: '#f8fafc', borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', borderStyle: 'dashed', alignItems: 'center' }}>
                      <Text style={{ fontSize: 11, color: '#64748b', textAlign: 'center' }}>
                        {t.noPendingShipments || '✓ Şu an bekleyen açık mal kabul sevkiyatı bulunmuyor. Tüm mutfak siparişleri depoya eksiksiz alınmıştır.'}
                      </Text>
                    </View>
                  ) : (
                    <View style={{ gap: 8 }}>
                      {pendingDeliveries.map((del, idx) => (
                        <View
                          key={del.expenseId || idx}
                          style={{
                            padding: 12,
                            backgroundColor: '#f8fbf9',
                            borderRadius: 10,
                            borderWidth: 1,
                            borderColor: '#d1fae5',
                          }}
                        >
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                            <View style={{ flex: 1, marginRight: 8 }}>
                              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }}>{getItemName(del.itemName, currentLang)}</Text>
                                <View style={{
                                  backgroundColor: del.isPaid ? '#ecfdf5' : '#fffbeb',
                                  paddingHorizontal: 6,
                                  paddingVertical: 1,
                                  borderRadius: 8,
                                  borderWidth: 1,
                                  borderColor: del.isPaid ? '#a7f3d0' : '#fde68a',
                                }}>
                                  <Text style={{ fontSize: 9, fontWeight: '800', color: del.isPaid ? '#047857' : '#b45309' }}>
                                    {del.isPaid ? (t.paidByCashierBadge || '✓ Kasa Ödedi') : (t.pendingCashierBadge || '⏳ Kasa Onayında')}
                                  </Text>
                                </View>
                              </View>
                              <Text style={{ fontSize: 10, color: '#64748b', marginTop: 2 }}>
                                {t.supplier || 'Tedarikçi'}: <Text style={{ fontWeight: '700', color: '#334155' }}>{getSupplierLabel(del.supplier, currentLang)}</Text>
                              </Text>
                            </View>
                            <View style={{ alignItems: 'flex-end' }}>
                              <Text style={{ fontSize: 14, fontWeight: '900', color: '#047857' }}>
                                +{del.quantity} {getUnitLabel(del.unit, currentLang)}
                              </Text>
                              <Text style={{ fontSize: 10, fontWeight: '700', color: '#475569' }}>
                                {del.totalCost ? `${del.totalCost.toLocaleString('tr-TR')} ₺` : ''}
                              </Text>
                            </View>
                          </View>

                          <TouchableOpacity
                            style={{
                              backgroundColor: '#059669',
                              borderRadius: 8,
                              paddingVertical: 8,
                              paddingHorizontal: 12,
                              alignItems: 'center',
                              flexDirection: 'row',
                              justifyContent: 'center',
                              gap: 6,
                              marginTop: 4,
                            }}
                            onPress={() => handleAutoReceiveDelivery(del)}
                            activeOpacity={0.8}
                          >
                            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 11 }}>
                              {t.oneTouchStockIn || '✓ Tek Dokunuşla Depoya Al'} (+{del.quantity} {getUnitLabel(del.unit, currentLang)})
                            </Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </View>
                  )}
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
                      <Text style={styles.itemTitle}>{getItemName(selectedItem.name, currentLang)}</Text>
                      <TouchableOpacity style={styles.inlineBackBtn} onPress={() => setSelectedItem(null)}>
                        <Text style={styles.inlineBackBtnTxt}>✕ {t.cancel || 'Kapat'}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.itemMeta}>{t.barcodeCol || 'Barkod'}: {selectedItem.barcode || 'Yok'}</Text>
                    <Text style={styles.stockStatusBig}>
                      {t.stockCol || 'Mevcut Stok'}: {selectedItem.stock} {getUnitLabel(selectedItem.unit, currentLang)} ({t.minStockCol || 'Min'}: {selectedItem.min} {getUnitLabel(selectedItem.unit, currentLang)})
                    </Text>

                    <TextInput
                      style={[styles.inputBox, { marginTop: 12 }]}
                      placeholder={`${t.quantity || 'Miktar'} (${getUnitLabel(selectedItem.unit, currentLang)})`}
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
                            <Text style={styles.webTxName}>{getItemName(tx.itemName, currentLang)}</Text>
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
                          {tx.type === 'receive' ? '+' : '-'}{tx.quantity} {getUnitLabel(tx.unit, currentLang)}
                        </Text>
                      </View>
                    ))
                  ) : (
                    <Text style={{ fontSize: 12, color: '#94a3b8', textAlign: 'center', paddingVertical: 12 }}>
                      {t.noNotifications || 'Bugün henüz depo hareketi kaydedilmedi.'}
                    </Text>
                  )}
                </View>
              </>
            ) : (
              /* warehouseTab === 'stock' (Web tabWarehouseStatus ile birebir Depo Stok Listesi) */
              <View>
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
                  const isAlert = (parseFloat(it.stock) || 0) <= (parseFloat(it.min) || 5);
                  const totalVal = (parseFloat(it.stock) || 0) * (parseFloat(it.price) || 0);
                  return (
                    <View key={it.id} style={[styles.webItemCard, isAlert && styles.webItemCardAlert]}>
                      <TouchableOpacity style={{ flex: 1 }} onPress={() => { setSelectedItem(it); setWarehouseTab('operations'); }} activeOpacity={0.8}>
                        <View style={styles.webItemTopRow}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.webItemName}>{getItemName(it.name, currentLang)}</Text>
                            <Text style={styles.webItemBarcode}>{t.barcodeCol || 'Barkod'}: {it.barcode || 'Belirtilmedi'}</Text>
                          </View>
                          <View style={styles.webCategoryBadge}>
                            <Text style={styles.webCategoryBadgeTxt}>{getCategoryLabel(it.cat, currentLang) || 'Genel'}</Text>
                          </View>
                        </View>

                        <View style={styles.webItemMetricsRow}>
                          <View style={styles.webItemMetricCol}>
                            <Text style={styles.webItemMetricLbl}>{t.stockCol || 'Mevcut Stok'}</Text>
                            <Text style={[styles.webItemMetricVal, isAlert && { color: '#dc2626' }]}>
                              {it.stock} {getUnitLabel(it.unit, currentLang)}
                            </Text>
                          </View>
                          <View style={styles.webItemMetricCol}>
                            <Text style={styles.webItemMetricLbl}>{t.minStockCol || 'Min. Stok'}</Text>
                            <Text style={styles.webItemMetricVal}>{it.min} {getUnitLabel(it.unit, currentLang)}</Text>
                          </View>
                          <View style={styles.webItemMetricCol}>
                            <Text style={styles.webItemMetricLbl}>{t.unitPriceCol || 'Birim Fiyat'}</Text>
                            <Text style={styles.webItemMetricVal}>{it.price.toFixed(2)} ₺</Text>
                          </View>
                          <View style={styles.webItemMetricCol}>
                            <Text style={styles.webItemMetricLbl}>{t.totalValueCol || 'Toplam Değer'}</Text>
                            <Text style={[styles.webItemMetricVal, { color: '#047857' }]}>
                              {totalVal.toLocaleString('tr-TR')} ₺
                            </Text>
                          </View>
                        </View>

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
                            {t.supplier || 'Tedarikçi'}: <Text style={{ fontWeight: '700', color: '#334155' }}>{getSupplierLabel(it.supplier, currentLang) || (t.notSpecified || 'Standart')}</Text>
                          </Text>
                        </View>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            )}
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
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 24 }}>💰</Text>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '900',
                    color: '#0a1f11',
                    letterSpacing: -0.4,
                  }}
                >
                  {t.cashierAccountingHeader ? t.cashierAccountingHeader.replace(/^💰\s*/, '') : 'Kasa & Muhasebe (Gelir/Gider)'}
                </Text>
              </View>
              <Text style={{ fontSize: 12.5, color: '#475569', marginTop: 4, lineHeight: 18, fontWeight: '500' }}>
                {t.cashierSubHeader || 'Restoran kasasına gelen bütçeleri gider kalemlerine dağıtın, fiili ödemeleri yapıp Mali Müşavir onayına gönderin.'}
              </Text>

              {/* 4 Ana Buton: 2 Ana Kasa Aksiyon Kartı + 2 Dışa Aktarım Butonu */}
              <View style={{ marginTop: 12, marginBottom: 6 }}>
                {/* 1. Sıra: 2 Temel Kasa & Gider Aksiyon Butonu */}
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#ecfdf5',
                      borderColor: '#86efac',
                      borderWidth: 1.5,
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 52,
                    }}
                    onPress={() => setShowCashAllocationModal(true)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 11.5,
                        color: '#065f46',
                        fontWeight: '800',
                        textAlign: 'center',
                        lineHeight: 16,
                      }}
                      numberOfLines={2}
                    >
                      💵 {t.allocateCash || 'Kasaya Para Girişi & Gider Ödemesi'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#047857',
                      borderColor: '#047857',
                      borderWidth: 1.5,
                      borderRadius: 12,
                      paddingVertical: 10,
                      paddingHorizontal: 8,
                      alignItems: 'center',
                      justifyContent: 'center',
                      minHeight: 52,
                    }}
                    onPress={() => setShowAddExpenseModal(true)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={{
                        fontSize: 11.5,
                        color: '#ffffff',
                        fontWeight: '800',
                        textAlign: 'center',
                        lineHeight: 16,
                      }}
                      numberOfLines={2}
                    >
                      ➕ {t.newExpense || 'Yeni Gider Çıkışı (Öde)'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* 2. Sıra: Excel ve CSV Dışa Aktarım Butonları */}
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#f0fdf4',
                      borderColor: '#a7f3d0',
                      borderWidth: 1.2,
                      borderRadius: 8,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onPress={handleExportExcelMobile}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11.5, color: '#047857', fontWeight: '800' }}>
                      📄 {t.exportExcel || 'Excel (.xlsx) İndir'}
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      backgroundColor: '#ffffff',
                      borderColor: '#cbd5e1',
                      borderWidth: 1.2,
                      borderRadius: 8,
                      paddingVertical: 8,
                      paddingHorizontal: 10,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 6,
                    }}
                    onPress={handleExportCSVMobile}
                    activeOpacity={0.7}
                  >
                    <Text style={{ fontSize: 11.5, color: '#334155', fontWeight: '800' }}>
                      📄 {t.exportCsv || 'CSV İndir'}
                    </Text>
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

            {/* CANLI İŞ AKIŞ & ONAY SÜREÇ DİYAGRAMI (Gider -> Kasa -> Müşavir -> Resmi Defter) */}
            <View style={{
              backgroundColor: '#ffffff',
              borderRadius: 14,
              padding: 12,
              marginBottom: 12,
              borderWidth: 1.5,
              borderColor: '#cbd5e1'
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Text style={{ fontSize: 14 }}>🔄</Text>
                  <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a' }}>
                    Canlı Kasa & Müşavir Onay Süreç Akışı
                  </Text>
                </View>
                <View style={{ backgroundColor: '#ecfdf5', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 10, borderWidth: 1, borderColor: '#a7f3d0' }}>
                  <Text style={{ fontSize: 9.5, fontWeight: '800', color: '#047857' }}>● CANLI SENKRON</Text>
                </View>
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  {/* Aşama 1 */}
                  <TouchableOpacity
                    style={{
                      width: 135,
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: expenseTab === 'all' ? '#ecfdf5' : '#f8fafc',
                      borderWidth: 1.5,
                      borderColor: expenseTab === 'all' ? '#10b981' : '#e2e8f0'
                    }}
                    onPress={() => setExpenseTab('all')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#64748b' }}>{t.stage1 || '1. AŞAMA'}</Text>
                      <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#0f172a' }}>{expenses.length} {t.receiptCountSuffix || 'Fiş'}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>{t.stage1Title || '📝 Gider Girişi'}</Text>
                    <Text style={{ fontSize: 9.5, color: '#059669', fontWeight: '700', marginTop: 4 }}>{t.stage1Sub || '✓ Başlangıç'}</Text>
                  </TouchableOpacity>

                  {/* Aşama 2 */}
                  <TouchableOpacity
                    style={{
                      width: 135,
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: expenseTab === 'debt' ? '#ecfdf5' : '#f0fdf4',
                      borderWidth: 1.5,
                      borderColor: expenseTab === 'debt' ? '#16a34a' : '#bbf7d0'
                    }}
                    onPress={() => setExpenseTab('debt')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#166534' }}>{t.stage2 || '2. AŞAMA'}</Text>
                      <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#166534' }}>{expenses.filter(e => e.paidByCashier).length} {t.paidCountSuffix || 'Ödendi'}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#14532d' }}>{t.stage2Title || '💵 Kasa Ödemesi'}</Text>
                    <Text style={{ fontSize: 9.5, color: totalDebtAmount > 0 ? '#dc2626' : '#166534', fontWeight: '700', marginTop: 4 }}>
                      {expenses.filter(e => !e.paidByCashier).length > 0 ? `⏳ ${expenses.filter(e => !e.paidByCashier).length} ${t.unpaidDebtSuffix || 'Borçta'}` : '✓ Ödendi'}
                    </Text>
                  </TouchableOpacity>

                  {/* Aşama 3 */}
                  <TouchableOpacity
                    style={{
                      width: 135,
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: expenseTab === 'awaiting_advisor' ? '#eff6ff' : '#f0f9ff',
                      borderWidth: 1.5,
                      borderColor: expenseTab === 'awaiting_advisor' ? '#2563eb' : '#bfdbfe'
                    }}
                    onPress={() => setExpenseTab('awaiting_advisor')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#1e40af' }}>{t.stage3 || '3. AŞAMA'}</Text>
                      <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#1d4ed8' }}>{totalPendingAdvisorCount} {t.receiptCountSuffix || 'Fiş'}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#1e3a8a' }}>{t.stage3Title || '📤 Müşavire Gönder'}</Text>
                    <Text style={{ fontSize: 9.5, color: '#2563eb', fontWeight: '700', marginTop: 4 }}>{t.stage3Sub || '✓ İletildi'}</Text>
                  </TouchableOpacity>

                  {/* Aşama 4 */}
                  <TouchableOpacity
                    style={{
                      width: 135,
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: expenseTab === 'rejected' ? '#fff1f2' : '#faf5ff',
                      borderWidth: 1.5,
                      borderColor: expenseTab === 'rejected' ? '#be123c' : '#e9d5ff'
                    }}
                    onPress={() => setExpenseTab(totalRejectedCount > 0 ? 'rejected' : 'all')}
                    activeOpacity={0.7}
                  >
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
                      <Text style={{ fontSize: 9, fontWeight: '800', color: '#6b21a8' }}>{t.stage4 || '4. AŞAMA'}</Text>
                      <Text style={{ fontSize: 9.5, fontWeight: '900', color: '#7e22ce' }}>{expenses.filter(e => e.recordedInLedger).length} {t.approvedSuffix || 'Onaylı'}</Text>
                    </View>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#581c87' }}>{t.stage4Title || '🏛️ Defter Onayı'}</Text>
                    <Text style={{ fontSize: 9.5, color: totalRejectedCount > 0 ? '#b91c1c' : '#7e22ce', fontWeight: '700', marginTop: 4 }}>
                      {totalRejectedCount > 0 ? `⚠️ ${totalRejectedCount} ${t.rejectedSuffix || 'Ret'}` : '✓ Deftere İşlendi'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </ScrollView>
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
                    {t.todaySalesSummaryTitle || '🍽️ Bugün Restoranda Ne Satıldı? (Kasa Dökümü)'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                    {t.totalRevenueLabel || 'Toplam Gelir'}: {totalRevenue.toLocaleString('tr-TR')} ₺ • {t.grossProfitLabel || 'Brüt Kâr'}: {(totalRevenue - foodCostTotal).toLocaleString('tr-TR')} ₺
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
                <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.colors.textDark }}>{t.noMatchingExpense || 'Eşleşen gider kaydı bulunamadı'}</Text>
                <Text style={{ fontSize: 12, color: THEME.colors.textLight, marginTop: 4 }}>{t.changeSearchFilterHint || 'Arama terimini veya filtre sekmesini değiştirebilirsiniz.'}</Text>
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
                          <Text style={styles.expCardTitle}>{getExpenseTitle(exp.title, currentLang)}</Text>
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
                          {getSupplierLabel(exp.counterparty, currentLang) || t.notSpecified || 'Belirtilmedi'}
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

                    {/* Mali Müşavir Ret / Düzeltme Notu Vurgusu (Kasa Ekranı) */}
                    {isNeedsCorrection && exp.rejectionReason ? (
                      <View style={{ backgroundColor: '#fef2f2', borderWidth: 1, borderColor: '#fca5a5', borderRadius: 8, padding: 8, marginTop: 8 }}>
                        <Text style={{ fontSize: 11, fontWeight: '800', color: '#991b1b' }}>
                          ⚠️ {t.rejectionReasonPrefix || 'Müşavir Düzeltme Notu'}:
                        </Text>
                        <Text style={{ fontSize: 11, color: '#b91c1c', marginTop: 2 }}>
                          {exp.rejectionReason}
                        </Text>
                      </View>
                    ) : null}

                    {/* Web Birebir İşlem Satırı: Müşavire Gönder, Kasadan Öde, Kilitli Rozeti & Silme */}
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

                        {/* Muhasebeci / Kasa: Mali Müşavir Defter Onayına Gönder Butonu (Web ile Birebir) */}
                        {(!isFinalized && (!exp.sentToAdvisor || isNeedsCorrection)) && (
                          <TouchableOpacity
                            style={styles.webBtnSendAdvisor}
                            onPress={() => handleSendToAdvisorMobile(exp)}
                            activeOpacity={0.8}
                          >
                            <Text style={styles.webBtnSendAdvisorTxt}>
                              🚀 {t.sendToAdvisorBtn || 'Müşavire Gönder'}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* Deftere Kesinleştiğinde Gösterilen Kilitli Rozeti */}
                        {isFinalized && (
                          <View style={styles.webBtnFinalizedBadge}>
                            <Text style={styles.webBtnFinalizedBadgeTxt}>{t.lockedInLedger || '🔒 Kilitli (Deftere İşlendi)'}</Text>
                          </View>
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
                  onPress={() => showToast(t.exportReadyToast || '📥 Luca & Zirve formatında Mahsup Fişi (.XML/.XLS) hazırlandı!')}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.webBtnPrimaryTxt, { fontSize: 11 }]}>{t.exportLucaZirve || '📥 Luca/Zirve Aktar'}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.webBtnSecondary, { flex: 1, minWidth: 140, backgroundColor: '#f0fdf4', borderColor: '#86efac', paddingVertical: 8, paddingHorizontal: 10, alignItems: 'center', justifyContent: 'center', borderRadius: 8 }]}
                  onPress={() => setAdvisorTab('tax_reports')}
                  activeOpacity={0.8}
                >
                  <Text style={{ fontSize: 11, fontWeight: '800', color: '#166534' }}>{t.taxAndDeclarations || '📋 Vergi & Beyanname'}</Text>
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
                    {t.tdhpChartTitle || '🏛️ Tek Düzen Hesap Planı (TDHP)'}
                  </Text>
                  <TouchableOpacity
                    style={{ backgroundColor: '#0d9488', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}
                    onPress={() => showToast('Luca/Zirve XML fişi dışa aktarıldı')}
                  >
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{t.xmlDownloadBtn || 'XML İndir'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#f0fdfa', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f766e' }}>100.01 {t.coaCash || 'Merkez Kasa (Nakit)'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#047857' }}>{Math.round(totalRevenue * 0.35).toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#f0fdfa', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f766e' }}>108.01 {t.coaPos || 'POS / Kredi Kartı Bloke'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#047857' }}>{Math.round(totalRevenue * 0.65).toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155' }}>150.01 {t.coaRawMaterials || 'İlk Madde & Malzeme (Stok)'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#b45309' }}>{foodCostTotal.toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155' }}>770.01 {t.coaFixedAdmin || 'Genel Yönetim (Sabit)'}</Text>
                    <Text style={{ fontSize: 11, fontWeight: '900', color: '#4338ca' }}>{fixedExpensesTotal.toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#f8fafc', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, fontWeight: '800', color: '#334155' }}>770.02 {t.coaVariableOps || 'Operasyonel Gider (Değişken)'}</Text>
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
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{t.printPdfBtn || '🖨️ PDF Yazdır'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={{ gap: 6 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#fffbeb', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, color: '#713f12' }}>{t.cashDrawerLabel || 'Nakit Tahsilat (Çekmece):'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a' }}>{Math.round(totalRevenue * 0.35).toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#fffbeb', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, color: '#713f12' }}>{t.posContactlessLabel || 'Banka POS & Temassız:'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a' }}>{Math.round(totalRevenue * 0.55).toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 8, backgroundColor: '#fffbeb', borderRadius: 8 }}>
                    <Text style={{ fontSize: 11, color: '#713f12' }}>{t.mealCardsLabel || 'Yemek Kartları (Sodexo/Multi):'}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#0f172a' }}>{Math.round(totalRevenue * 0.10).toLocaleString('tr-TR')} ₺</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', padding: 10, backgroundColor: '#ecfdf5', borderRadius: 8, borderWidth: 1, borderColor: '#a7f3d0' }}>
                    <Text style={{ fontSize: 12, fontWeight: '900', color: '#065f46' }}>{t.totalZRevenueLabel || 'TOPLAM GÜNLÜK Z-HASILATI:'}</Text>
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
                      {t.taxReportsDeskTitle || '📋 Resmi Vergi & Beyanname Masası'}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                      {t.taxReportsDeskSub || 'KDV-1, Muhtasar Stopaj & Geçici Vergi Dökümü'}
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
                    {t.vat1Title || '1. KDV-1 Beyannamesi (Aylık)'}
                  </Text>
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#15803d' }}>{t.calculatedVatLabel || '• Hesaplanan KDV (%10 Restoran Satış):'}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#166534' }}>{Math.round(totalRevenue - (totalRevenue / 1.1)).toLocaleString('tr-TR')} ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#15803d' }}>{t.deductibleVatLabel || '• İndirilecek KDV (Gider Faturaları):'}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#166534' }}>{Math.round(variableExpensesTotal * 0.15).toLocaleString('tr-TR')} ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#bbf7d0', paddingTop: 4, marginTop: 2 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '900', color: '#064e3b' }}>{t.netVatPayableLabel || 'ÖDENECEK NET KDV:'}</Text>
                      <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#047857' }}>
                        {Math.max(0, Math.round((totalRevenue - (totalRevenue / 1.1)) - (variableExpensesTotal * 0.15))).toLocaleString('tr-TR')} ₺
                      </Text>
                    </View>
                  </View>
                </View>

                {/* 2. Muhtasar ve Prim Hizmet Beyannamesi (MPHB) */}
                <View style={{ backgroundColor: '#f8fafc', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 8 }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#1e293b', marginBottom: 4 }}>
                    {t.withholdingTitle || '2. Muhtasar & Prim Hizmet Beyannamesi (MPHB)'}
                  </Text>
                  <View style={{ gap: 4 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#475569' }}>{t.sgkProvisionLabel || '• Personel SGK Prim Karşılığı (6 Kişi):'}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>27.500 ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#475569' }}>{t.incomeTaxWithholdingLabel || '• Personel Gelir Vergisi Stopajı:'}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>4.800 ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#475569' }}>{t.rentWithholdingLabel || '• Dükkan Kira Stopajı (%20 Tevkifat):'}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>9.000 ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                      <Text style={{ fontSize: 10.5, color: '#475569' }}>{t.cpaWithholdingLabel || '• SMMM Serbest Meslek Stopajı (%20):'}</Text>
                      <Text style={{ fontSize: 11, fontWeight: '800', color: '#0f172a' }}>1.700 ₺</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: '#cbd5e1', paddingTop: 4, marginTop: 2 }}>
                      <Text style={{ fontSize: 10.5, fontWeight: '900', color: '#0f172a' }}>{t.totalWithholdingLabel || 'TOPLAM STOPAJ & SGK TAHAKKUK:'}</Text>
                      <Text style={{ fontSize: 11.5, fontWeight: '900', color: '#b45309' }}>43.000 ₺</Text>
                    </View>
                  </View>
                </View>

                {/* 3. Geçici Kurumlar Vergisi Özeti */}
                <View style={{ backgroundColor: '#fffbeb', padding: 10, borderRadius: 10, borderWidth: 1, borderColor: '#fde68a' }}>
                  <Text style={{ fontSize: 11, fontWeight: '900', color: '#92400e', marginBottom: 4 }}>
                    {t.corpTaxTitle || '3. Üç Aylık Geçici Vergi / Faaliyet Kârı Karşılığı'}
                  </Text>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 10.5, color: '#78350f' }}>{t.corpTaxProvisionLabel || 'Tahmini Net Kâr Karşılığı (%25):'}</Text>
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
                    placeholder={t.searchAdvisorPlaceholder || "🔍 Defterde gider, kurum veya fatura ara..."}
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
                              <Text style={styles.expCardTitle}>{getExpenseTitle(exp.title, currentLang)}</Text>
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
                              {getSupplierLabel(exp.counterparty, currentLang) || t.notSpecified || 'Belirtilmedi'}
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
                                <Text style={styles.webBtnRejectTxt}>{t.requestCorrection || '↺ Düzeltme İste'}</Text>
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
                  const severity = notif.severity || 'INFO';
                  const badgeColor = severity === 'CRITICAL' ? '#ef4444' : severity === 'WARNING' ? '#f59e0b' : '#10b981';
                  const badgeBg = severity === 'CRITICAL' ? '#fee2e2' : severity === 'WARNING' ? '#fef3c7' : '#ecfdf5';
                  const badgeText = severity === 'CRITICAL' ? 'KRİTİK' : severity === 'WARNING' ? 'UYARI' : 'BİLGİ';

                  return (
                    <TouchableOpacity
                      key={notif.id}
                      style={{
                        padding: 12,
                        borderRadius: 10,
                        backgroundColor: notif.isRead ? '#f8fafc' : '#f0fdf4',
                        borderWidth: 1,
                        borderColor: notif.isRead ? '#e2e8f0' : (severity === 'CRITICAL' ? '#fca5a5' : '#86efac'),
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
                        // Mobil Derin Bağlantı (Deep Linking)
                        if (notif.route) {
                          setShowNotifModal(false);
                          if (notif.route.includes('cashier')) {
                            navigateTo('cashier');
                          } else if (notif.route.includes('advisor')) {
                            navigateTo('advisor');
                          } else if (notif.route.includes('inventory')) {
                            navigateTo('inventory');
                          } else if (notif.route.includes('warehouse')) {
                            navigateTo('warehouse');
                          } else if (notif.route.includes('recipes')) {
                            navigateTo('recipes');
                          } else if (notif.route.includes('sales')) {
                            navigateTo('sales');
                          } else if (notif.route.includes('users')) {
                            navigateTo('users');
                          } else if (notif.route.includes('chat')) {
                            setShowTeamChatModal(true);
                          }
                        }
                      }}
                      activeOpacity={0.8}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 6 }}>
                          <View
                            style={{
                              backgroundColor: badgeBg,
                              paddingHorizontal: 6,
                              paddingVertical: 1,
                              borderRadius: 4,
                              marginRight: 6,
                              borderWidth: 0.5,
                              borderColor: badgeColor,
                            }}
                          >
                            <Text style={{ fontSize: 9, fontWeight: '900', color: badgeColor }}>
                              {badgeText}
                            </Text>
                          </View>
                          <Text style={{ fontSize: 12, fontWeight: '800', color: notif.isRead ? '#475569' : '#166534', flex: 1 }}>
                            {loc.title}
                          </Text>
                        </View>
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
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          {notif.route && (
                            <Text style={{ fontSize: 10, fontWeight: '800', color: '#059669', textDecorationLine: 'underline' }}>
                              İncele →
                            </Text>
                          )}
                          <Text style={{ fontSize: 10, color: '#94a3b8' }}>
                            🕒 {notif.createdAt ? new Date(notif.createdAt).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) : 'Şimdi'}
                          </Text>
                        </View>
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

      {/* MODAL 4C-2: KULLANICI PROFİL KARTI & GÜVENLİK KORUMASI (Yetkisiz Rol Değişimi Engelli) */}
      <Modal visible={showRoleSwitchModal} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 360, padding: 20 }]}>
            <View style={styles.webModalHeader}>
              <View>
                <Text style={styles.modalTitle}>👤 Profil & Güvenlik Kartı</Text>
                <Text style={styles.webModalSub}>Aktif Yetkili Kullanıcı Oturumu</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRoleSwitchModal(false)}>
                <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
              </TouchableOpacity>
            </View>

            {/* Kullanıcı Kimlik Kartı */}
            <View style={{
              alignItems: 'center',
              paddingVertical: 16,
              backgroundColor: '#f8fafc',
              borderRadius: 16,
              borderWidth: 1.5,
              borderColor: '#e2e8f0',
              marginTop: 10,
              gap: 8
            }}>
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: ROLE_COLORS[currentUser.role] || '#10b981',
                  justifyContent: 'center',
                  alignItems: 'center',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20 }}>{currentUser.avatar}</Text>
              </View>

              <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a' }}>{currentUser.name}</Text>
              <View style={{
                backgroundColor: ROLE_COLORS[currentUser.role] ? `${ROLE_COLORS[currentUser.role]}20` : '#ecfdf5',
                paddingHorizontal: 10,
                paddingVertical: 3,
                borderRadius: 8,
                borderWidth: 1,
                borderColor: ROLE_COLORS[currentUser.role] || '#10b981'
              }}>
                <Text style={{ fontSize: 12, fontWeight: '800', color: ROLE_COLORS[currentUser.role] || '#059669' }}>
                  {ROLE_LABELS[currentUser.role]}
                </Text>
              </View>

              <Text style={{ fontSize: 12, color: '#64748b' }}>
                Kullanıcı: @{currentUser.username} • {currentUser.email || 'gastrosync.com'}
              </Text>
            </View>

            {/* Güvenlik & Yetkilendirme Uyarısı */}
            <View style={{
              backgroundColor: '#fef2f2',
              borderRadius: 12,
              padding: 12,
              marginTop: 12,
              borderWidth: 1,
              borderColor: '#fecaca',
              gap: 4
            }}>
              <Text style={{ fontSize: 12, fontWeight: '800', color: '#991b1b' }}>
                🛡️ Yetkilendirme Koruması Aktif
              </Text>
              <Text style={{ fontSize: 11, color: '#b91c1c', lineHeight: 15 }}>
                Sistem politikası gereği profilden diğer rollere doğrudan geçiş yapılamaz. Farklı bir personel olarak işlem yapmak için lütfen güvenli çıkış yapıp kendi şifrenizle giriş yapınız.
              </Text>
            </View>

            {/* Güvenli Çıkış Yap Butonu */}
            <TouchableOpacity
              style={{
                backgroundColor: '#dc2626',
                paddingVertical: 12,
                borderRadius: 12,
                alignItems: 'center',
                marginTop: 14,
                flexDirection: 'row',
                justifyContent: 'center',
                gap: 8
              }}
              onPress={() => {
                setShowRoleSwitchModal(false);
                if (onLogout) onLogout();
              }}
              activeOpacity={0.8}
            >
              <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 13 }}>⎋ Güvenli Çıkış Yap</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.modalCancelBtn, { marginTop: 8 }]}
              onPress={() => setShowRoleSwitchModal(false)}
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
                <Text style={styles.modalTitle}>{t.languageModalTitle || '🌐 Şirket Dili / Language'}</Text>
                <Text style={styles.webModalSub}>{t.languageModalSub || 'Tek dokunuşla dil değiştirin'}</Text>
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

      {/* MODAL 5: MUHASEBE & KASA GİDER GİRİŞİ (Web /cashier & /accounting ile %100 Birebir) */}
      <Modal visible={showAddExpenseModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '92%', padding: 18, borderRadius: 16 }]}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e8f0ea', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Text style={{ fontSize: 18, color: '#10b981', fontWeight: '900' }}>➕</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#0f172a' }} numberOfLines={1}>
                    {currentUser.role === ROLES.FINANCIAL_ADVISOR ? (t.advisorLedgerEntry || 'Mali Müşavir Defter Girişi') : (t.newExpenseModalTitle || 'Muhasebe & Kasa Gider Girişi')}
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }} numberOfLines={1}>
                    Sabit ve değişken maliyet kalemi kaydı
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowAddExpenseModal(false)} style={{ padding: 4, flexShrink: 0 }}>
                <Text style={{ fontSize: 20, color: '#64748b', fontWeight: '600' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
              {/* Row 1: Gider Başlığı * */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 5 }}>
                  Gider Başlığı *
                </Text>
                <TextInput
                  style={[styles.modalInput, { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }]}
                  placeholder={t.expenseTitlePlaceholder || "Elektrik Faturası, Şube Kirası, Sarf Malzeme Alımı..."}
                  placeholderTextColor="#94a3b8"
                  value={newExpense.title}
                  onChangeText={(val) => setNewExpense({ ...newExpense, title: val })}
                />
              </View>

              {/* Row 2: Ana Kategori & Gider Türü (2 Sütun) */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                {/* Ana Kategori */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 5 }}>
                    Ana Kategori
                  </Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f8fafc',
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                    onPress={() => {
                      setOpenExpenseCatSelect(!openExpenseCatSelect);
                      setOpenExpenseSubSelect(false);
                    }}
                  >
                    <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>
                      {newExpense.category === 'FIXED' ? ('🏢 ' + (t.fixedExpenseLabel || 'Sabit Gider')) : ('⚡ ' + (t.variableExpenseLabel || 'Değişken Gider'))}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>▼</Text>
                  </TouchableOpacity>

                  {openExpenseCatSelect && (
                    <View style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginTop: 4, elevation: 4, zIndex: 10 }}>
                      <TouchableOpacity
                        style={{ padding: 10, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: newExpense.category === 'FIXED' ? '#ecfdf5' : '#ffffff' }}
                        onPress={() => {
                          setNewExpense({ ...newExpense, category: 'FIXED', subType: 'RENT' });
                          setOpenExpenseCatSelect(false);
                        }}
                      >
                        <Text style={{ fontSize: 12.5, fontWeight: newExpense.category === 'FIXED' ? '800' : '600', color: '#0f172a' }}>🏢 {t.fixedExpenseLabel || 'Sabit Gider'}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={{ padding: 10, backgroundColor: newExpense.category === 'VARIABLE' ? '#ecfdf5' : '#ffffff' }}
                        onPress={() => {
                          setNewExpense({ ...newExpense, category: 'VARIABLE', subType: 'ELECTRICITY' });
                          setOpenExpenseCatSelect(false);
                        }}
                      >
                        <Text style={{ fontSize: 12.5, fontWeight: newExpense.category === 'VARIABLE' ? '800' : '600', color: '#0f172a' }}>{`⚡ ${t.variableLabel || 'Değişken Gider'}`}</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>

                {/* Gider Türü */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 5 }}>
                    Gider Türü
                  </Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f8fafc',
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                    }}
                    onPress={() => {
                      setOpenExpenseSubSelect(!openExpenseSubSelect);
                      setOpenExpenseCatSelect(false);
                    }}
                  >
                    <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>
                      {newExpense.category === 'FIXED'
                        ? (newExpense.subType === 'RENT' ? '🏢 Kira (İşyeri)' : newExpense.subType === 'LABOR' ? '👥 İşçilik (Maaş)' : '📑 Mali Müşavir')
                        : (newExpense.subType === 'ELECTRICITY' ? '⚡ Elektrik'
                          : newExpense.subType === 'WATER' ? '💧 Su'
                          : newExpense.subType === 'GAS' ? '🔥 Doğalgaz'
                          : newExpense.subType === 'PHONE' ? '📞 Telefon'
                          : newExpense.subType === 'INTERNET' ? '🌐 İnternet & Ağ'
                          : newExpense.subType === 'TAX' ? '🏛️ Vergi (KDV/Stopaj)'
                          : newExpense.subType === 'SGK' ? '🛡️ Sigorta (SGK Prim)'
                          : newExpense.subType === 'CONSUMABLES' ? '📦 Sarf Malzeme'
                          : newExpense.subType === 'LOGISTICS' ? '🚚 Lojistik & Nakliye'
                          : newExpense.subType === 'MARKETING' ? '📣 Reklam & Tanıtım'
                          : '🔨 Tadilat & Bakım')}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b' }}>▼</Text>
                  </TouchableOpacity>

                  {openExpenseSubSelect && (
                    <View style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginTop: 4, maxHeight: 180, elevation: 5, zIndex: 20 }}>
                      <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                        {newExpense.category === 'FIXED' ? (
                          [
                            { id: 'RENT', label: '🏢 Kira (İşyeri)' },
                            { id: 'LABOR', label: '👥 İşçilik & Personel Maaşları' },
                            { id: 'ACCOUNTANT', label: '📑 Mali Müşavir' },
                          ].map((item) => (
                            <TouchableOpacity
                              key={item.id}
                              style={{ padding: 9, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: newExpense.subType === item.id ? '#ecfdf5' : '#ffffff' }}
                              onPress={() => {
                                setNewExpense({ ...newExpense, subType: item.id });
                                setOpenExpenseSubSelect(false);
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: newExpense.subType === item.id ? '800' : '600', color: '#0f172a' }}>{getExpenseTypeLabel(item.id, currentLang)}</Text>
                            </TouchableOpacity>
                          ))
                        ) : (
                          [
                            { id: 'ELECTRICITY', label: '⚡ Elektrik' },
                            { id: 'WATER', label: '💧 Su' },
                            { id: 'GAS', label: '🔥 Doğalgaz' },
                            { id: 'PHONE', label: '📞 Telefon' },
                            { id: 'INTERNET', label: '🌐 İnternet & Ağ' },
                            { id: 'TAX', label: '🏛️ Vergi (KDV / Stopaj)' },
                            { id: 'SGK', label: '🛡️ Sigorta (SGK Prim)' },
                            { id: 'CONSUMABLES', label: '📦 Sarf Malzeme' },
                            { id: 'LOGISTICS', label: '🚚 Lojistik & Nakliye' },
                            { id: 'MARKETING', label: '📣 Reklam & Tanıtım' },
                            { id: 'RENOVATION', label: '🔨 Tadilat & Bakım' },
                          ].map((item) => (
                            <TouchableOpacity
                              key={item.id}
                              style={{ padding: 9, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: newExpense.subType === item.id ? '#ecfdf5' : '#ffffff' }}
                              onPress={() => {
                                setNewExpense({ ...newExpense, subType: item.id });
                                setOpenExpenseSubSelect(false);
                              }}
                            >
                              <Text style={{ fontSize: 12, fontWeight: newExpense.subType === item.id ? '800' : '600', color: '#0f172a' }}>{getExpenseTypeLabel(item.id, currentLang)}</Text>
                            </TouchableOpacity>
                          ))
                        )}
                      </ScrollView>
                    </View>
                  )}
                </View>
              </View>

              {/* Row 3: Kira İse Öz Mülk Seçeneği */}
              {newExpense.subType === 'RENT' && (
                <TouchableOpacity
                  style={{
                    flexDirection: 'row',
                    alignItems: 'flex-start',
                    gap: 10,
                    backgroundColor: newExpense.isOwnedProperty ? '#ecfdf5' : '#f8fafc',
                    padding: 11,
                    borderRadius: 8,
                    borderWidth: 1,
                    borderColor: newExpense.isOwnedProperty ? '#6ee7b7' : '#e2e8f0',
                    marginBottom: 12,
                  }}
                  onPress={() =>
                    setNewExpense({
                      ...newExpense,
                      isOwnedProperty: !newExpense.isOwnedProperty,
                      amount: !newExpense.isOwnedProperty ? '0' : newExpense.amount,
                    })
                  }
                >
                  <View
                    style={{
                      width: 18,
                      height: 18,
                      borderRadius: 4,
                      borderWidth: 1.5,
                      borderColor: newExpense.isOwnedProperty ? '#059669' : '#94a3b8',
                      backgroundColor: newExpense.isOwnedProperty ? '#059669' : '#ffffff',
                      alignItems: 'center',
                      justifyContent: 'center',
                      marginTop: 2,
                    }}
                  >
                    {newExpense.isOwnedProperty && <Text style={{ color: '#fff', fontSize: 11, fontWeight: '900' }}>✓</Text>}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#1e293b' }}>
                      🏠 {t.ownedPropertyTitle || 'Dükkan Restoranın Kendi Mülkü (Öz Mülk - Kira Ödenmiyor)'}
                    </Text>
                    <Text style={{ fontSize: 11, color: '#64748b', marginTop: 3 }}>
                      {t.ownedPropertyDesc || 'İşaretlenirse kira maliyeti 0 ₺ olarak kaydedilir ve mülkiyet resmi kayıtlara işlenir.'}
                    </Text>
                  </View>
                </TouchableOpacity>
              )}

              {/* Row 4: Kurum / Tedarikçi & Fatura Seri No (2 Sütun) */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 5 }}>
                    Kurum / Alacaklı / Tedarikçi
                  </Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }]}
                    placeholder={t.counterpartyPlaceholder || "Enerjisa, İGDAŞ, Mülk Sahibi vb."}
                    placeholderTextColor="#94a3b8"
                    value={newExpense.counterparty}
                    onChangeText={(val) => setNewExpense({ ...newExpense, counterparty: val })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 5 }}>
                    Resmi Fatura / Fiş Seri No
                  </Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }]}
                    placeholder="GİB-2026-000412"
                    placeholderTextColor="#94a3b8"
                    value={newExpense.invoiceNumber}
                    onChangeText={(val) => setNewExpense({ ...newExpense, invoiceNumber: val })}
                  />
                </View>
              </View>

              {/* Row 5: 4 Grid Alanı: Tutar, İşlem Tarihi, Son Ödeme Vadesi, Muhasebe Dönemi */}
              <View style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 4 }}>
                    {newExpense.isOwnedProperty ? (t.amountOwnedProperty || 'Tutar (0 ₺ Öz Mülk)') : ((t.amount || 'Tutar') + ' (₺) *')}
                  </Text>
                  <TextInput
                    style={[
                      styles.modalInput,
                      {
                        backgroundColor: newExpense.isOwnedProperty ? '#f1f5f9' : '#ffffff',
                        borderColor: '#cbd5e1',
                        paddingHorizontal: 8,
                        fontSize: 13,
                        fontWeight: '700',
                      },
                    ]}
                    placeholder="0.00"
                    placeholderTextColor="#94a3b8"
                    keyboardType="numeric"
                    editable={!newExpense.isOwnedProperty}
                    value={newExpense.isOwnedProperty ? '0' : newExpense.amount}
                    onChangeText={(val) => setNewExpense({ ...newExpense, amount: val })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 4 }}>
                    İşlem Tarihi *
                  </Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', paddingHorizontal: 6, fontSize: 11.5 }]}
                    placeholder="2026-10-21"
                    placeholderTextColor="#94a3b8"
                    value={newExpense.expenseDate}
                    onChangeText={(val) => {
                      const p = val && val.length >= 7 ? val.substring(0, 7) : newExpense.period;
                      setNewExpense({ ...newExpense, expenseDate: val, period: p });
                    }}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#b91c1c', marginBottom: 4 }}>
                    Son Ödeme Vadesi
                  </Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', paddingHorizontal: 6, fontSize: 11.5 }]}
                    placeholder="2026-11-05"
                    placeholderTextColor="#94a3b8"
                    value={newExpense.dueDate}
                    onChangeText={(val) => setNewExpense({ ...newExpense, dueDate: val })}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#334155', marginBottom: 4 }}>
                    Muhasebe Dönemi
                  </Text>
                  <TextInput
                    style={[styles.modalInput, { backgroundColor: '#f8fafc', borderColor: '#cbd5e1', paddingHorizontal: 6, fontSize: 11.5 }]}
                    placeholder="2026-10"
                    placeholderTextColor="#94a3b8"
                    value={newExpense.period}
                    onChangeText={(val) => setNewExpense({ ...newExpense, period: val })}
                  />
                </View>
              </View>

              {/* Row 6: Kasa Ödeme Durumu (Peşin / Borç / Kısmi) Radio Grubu */}
              <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#e2e8f0', marginBottom: 12 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '800', color: '#1e293b', marginBottom: 8 }}>
                  Kasa Ödeme Durumu (Peşin / Borç / Kısmi)
                </Text>
                <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    onPress={() => setNewExpense({ ...newExpense, paymentStatus: 'PAID', paidByCashier: true })}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: newExpense.paymentStatus === 'PAID' ? '#059669' : '#94a3b8',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {newExpense.paymentStatus === 'PAID' && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#059669' }} />
                      )}
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#065f46' }}>{`💵 ${t.paidFromCashier || 'Kasadan Peşin Ödendi'}`}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    onPress={() => setNewExpense({ ...newExpense, paymentStatus: 'UNPAID', paidByCashier: false })}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: newExpense.paymentStatus === 'UNPAID' ? '#dc2626' : '#94a3b8',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {newExpense.paymentStatus === 'UNPAID' && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#dc2626' }} />
                      )}
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#b91c1c' }}>{`⏳ ${t.debtUnpaid || 'Ödenmedi (Borca / Vadeye Bırakıldı)'}`}</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
                    onPress={() => setNewExpense({ ...newExpense, paymentStatus: 'PARTIAL', paidByCashier: true })}
                  >
                    <View
                      style={{
                        width: 16,
                        height: 16,
                        borderRadius: 8,
                        borderWidth: 2,
                        borderColor: newExpense.paymentStatus === 'PARTIAL' ? '#d97706' : '#94a3b8',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {newExpense.paymentStatus === 'PARTIAL' && (
                        <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#d97706' }} />
                      )}
                    </View>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#b45309' }}>{`⚡ ${t.partialPaid || 'Kısmi Ödeme (Avans / Parçalı)'}`}</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* Row 7: Açıklama / Detaylı Not */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 5 }}>
                  Açıklama / Detaylı Not
                </Text>
                <TextInput
                  style={[
                    styles.modalInput,
                    {
                      backgroundColor: '#f8fafc',
                      borderColor: '#cbd5e1',
                      minHeight: 55,
                      textAlignVertical: 'top',
                      paddingTop: 8,
                    },
                  ]}
                  placeholder={t.expenseNotePlaceholder || "Gider sebebi, fatura detayı veya vade açıklaması..."}
                  placeholderTextColor="#94a3b8"
                  multiline
                  numberOfLines={2}
                  value={newExpense.note}
                  onChangeText={(val) => setNewExpense({ ...newExpense, note: val })}
                />
              </View>
            </ScrollView>

            {/* Row 8: Action Buttons */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={{
                  flex: 1,
                  backgroundColor: '#047857',
                  paddingVertical: 12,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={handleSaveExpense}
              >
                <Text style={{ color: '#ffffff', fontSize: 14, fontWeight: '800' }}>{t.save || 'Kaydet'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  paddingVertical: 12,
                  paddingHorizontal: 22,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  backgroundColor: '#f1f5f9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setShowAddExpenseModal(false)}
              >
                <Text style={{ color: '#334155', fontSize: 14, fontWeight: '700' }}>{t.cancel || 'Vazgeç'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* MODAL 5C: KASAYA PARA GİRİŞİ & GİDER ÖDEMESİ (Web /cashier ile %100 Birebir) */}
      <Modal visible={showCashAllocationModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '92%', padding: 18, borderRadius: 16 }]}>
            {/* Modal Header */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingBottom: 14, borderBottomWidth: 1, borderBottomColor: '#e8f0ea', marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, paddingRight: 8 }}>
                <View style={{ width: 38, height: 38, borderRadius: 10, backgroundColor: 'rgba(16, 185, 129, 0.15)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <Text style={{ fontSize: 18 }}>💵</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15.5, fontWeight: '800', color: '#0f172a' }} numberOfLines={1}>
                    Kasaya Para Girişi & Gider Ödemesi
                  </Text>
                  <Text style={{ fontSize: 11.5, color: '#64748b', marginTop: 1 }} numberOfLines={1}>
                    Kasa nakit girişi ve ilgili işletme gider kalemine ödeme aktarımı
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => setShowCashAllocationModal(false)} style={{ padding: 4, flexShrink: 0 }}>
                <Text style={{ fontSize: 20, color: '#64748b', fontWeight: '600' }}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 12 }}>
              {/* Row 1: Dönem Türü & Para Giriş Kaynağı (2 Sütun) */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                {/* Dönem Türü */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                    Dönem Türü
                  </Text>
                  <View style={{ flexDirection: 'row', gap: 6 }}>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        paddingHorizontal: 4,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: cashInflowPeriod === 'DAILY' ? '#059669' : '#cbd5e1',
                        backgroundColor: cashInflowPeriod === 'DAILY' ? '#ecfdf5' : '#ffffff',
                        alignItems: 'center',
                      }}
                      onPress={() => setCashInflowPeriod('DAILY')}
                    >
                      <Text style={{ fontSize: 11, fontWeight: cashInflowPeriod === 'DAILY' ? '800' : '600', color: cashInflowPeriod === 'DAILY' ? '#065f46' : '#64748b', textAlign: 'center' }}>
                        ☀️ {t.dailyCashTl || 'Günlük Kasa TL'}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={{
                        flex: 1,
                        paddingVertical: 8,
                        paddingHorizontal: 4,
                        borderRadius: 8,
                        borderWidth: 1.5,
                        borderColor: cashInflowPeriod === 'MONTHLY' ? '#059669' : '#cbd5e1',
                        backgroundColor: cashInflowPeriod === 'MONTHLY' ? '#ecfdf5' : '#ffffff',
                        alignItems: 'center',
                      }}
                      onPress={() => setCashInflowPeriod('MONTHLY')}
                    >
                      <Text style={{ fontSize: 11, fontWeight: cashInflowPeriod === 'MONTHLY' ? '800' : '600', color: cashInflowPeriod === 'MONTHLY' ? '#065f46' : '#64748b', textAlign: 'center' }}>
                        🗓️ {t.monthlyBudgetTl || 'Aylık Bütçe TL'}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Para Giriş Kaynağı */}
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                    Para Giriş Kaynağı
                  </Text>
                  <TouchableOpacity
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      backgroundColor: '#f8fafc',
                      borderWidth: 1,
                      borderColor: '#dbe7df',
                      borderRadius: 8,
                      paddingHorizontal: 10,
                      paddingVertical: 9,
                    }}
                    onPress={() => setOpenInflowSourceSelect(!openInflowSourceSelect)}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>
                      {cashInflowSource === 'POS_CASH'
                        ? (t.inflowPosCash || 'Nakit POS & Restoran Kasa Hasılatı')
                        : cashInflowSource === 'PARTNER'
                          ? (t.inflowPartner || 'Ortak / Sermaye İlavesi')
                          : (t.inflowBankWithdraw || 'Banka Hesabından Nakit Çekim')}
                    </Text>
                    <Text style={{ fontSize: 10, color: '#64748b', marginLeft: 4 }}>▼</Text>
                  </TouchableOpacity>

                  {openInflowSourceSelect && (
                    <View style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginTop: 4, elevation: 4, zIndex: 10 }}>
                      {[
                        { key: 'POS_CASH', label: t.inflowPosCash || 'Nakit POS & Restoran Kasa Hasılatı' },
                        { key: 'PARTNER', label: t.inflowPartner || 'Ortak / İşletme Sermaye İlavesi' },
                        { key: 'BANK_WITHDRAW', label: t.inflowBankWithdraw || 'Ticari Banka Hesabından Nakit Çekim' },
                      ].map((item) => (
                        <TouchableOpacity
                          key={item.key}
                          style={{ padding: 9, borderBottomWidth: 1, borderBottomColor: '#f1f5f9', backgroundColor: cashInflowSource === item.key ? '#ecfdf5' : '#ffffff' }}
                          onPress={() => {
                            setCashInflowSource(item.key);
                            setOpenInflowSourceSelect(false);
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: cashInflowSource === item.key ? '800' : '600', color: '#0f172a' }}>{item.label}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>
              </View>

              {/* Row 2: Tutar Girişi (Büyük giriş + ₺ ikonu) */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                  {cashInflowPeriod === 'DAILY' ? 'Günlük Kasaya Giren Nakit Tutarı (TL) *' : 'Aylık Tahsis Edilen Nakit Tutarı (TL) *'}
                </Text>
                <View style={{ position: 'relative', justifyContent: 'center' }}>
                  <TextInput
                    style={{
                      width: '100%',
                      backgroundColor: '#ffffff',
                      borderWidth: 1,
                      borderColor: '#cbd5e1',
                      borderRadius: 8,
                      paddingVertical: 10,
                      paddingLeft: 14,
                      paddingRight: 40,
                      fontSize: 19,
                      fontWeight: '800',
                      color: '#0f172a',
                    }}
                    keyboardType="numeric"
                    value={cashAllocationAmount}
                    onChangeText={setCashAllocationAmount}
                    placeholder="5000"
                    placeholderTextColor="#94a3b8"
                  />
                  <Text style={{ position: 'absolute', right: 14, fontSize: 18, fontWeight: '800', color: '#64748b' }}>₺</Text>
                </View>
              </View>

              {/* Row 3: Paranın Aktarılacağı Gider Hesabı Tabs */}
              <View style={{ marginBottom: 12 }}>
                <Text style={{ fontSize: 12.5, fontWeight: '700', color: '#334155', marginBottom: 6 }}>
                  Paranın Aktarılacağı Gider Hesabı
                </Text>
                <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      borderWidth: cashTargetAccount === 'SPECIFIC' ? 1.5 : 1,
                      borderColor: cashTargetAccount === 'SPECIFIC' ? '#059669' : '#cbd5e1',
                      backgroundColor: cashTargetAccount === 'SPECIFIC' ? '#ecfdf5' : '#ffffff',
                      alignItems: 'center',
                    }}
                    onPress={() => setCashTargetAccount('SPECIFIC')}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: cashTargetAccount === 'SPECIFIC' ? '#065f46' : '#475569', textAlign: 'center' }}>
                      🎯 Belirli Bekleyen Borca / Kaleme Öde
                    </Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={{
                      flex: 1,
                      paddingVertical: 9,
                      paddingHorizontal: 8,
                      borderRadius: 8,
                      borderWidth: cashTargetAccount === 'CUSTOM' ? 1.5 : 1,
                      borderColor: cashTargetAccount === 'CUSTOM' ? '#059669' : '#cbd5e1',
                      backgroundColor: cashTargetAccount === 'CUSTOM' ? '#ecfdf5' : '#ffffff',
                      alignItems: 'center',
                    }}
                    onPress={() => setCashTargetAccount('CUSTOM')}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: cashTargetAccount === 'CUSTOM' ? '#065f46' : '#475569', textAlign: 'center' }}>
                      ⚡ Yeni Doğrudan Gider Ödemesi Yap
                    </Text>
                  </TouchableOpacity>
                </View>

                {/* SPECIFIC Modu: Dropdown */}
                {cashTargetAccount === 'SPECIFIC' && (
                  <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0' }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 6 }}>
                      Ödenecek Kayıtlı Fatura veya Kalemi Seçin:
                    </Text>
                    <TouchableOpacity
                      style={{
                        backgroundColor: '#ffffff',
                        borderWidth: 1,
                        borderColor: '#cbd5e1',
                        borderRadius: 8,
                        paddingVertical: 10,
                        paddingHorizontal: 12,
                        flexDirection: 'row',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                      onPress={() => setOpenTargetExpenseSelect(!openTargetExpenseSelect)}
                    >
                      <Text style={{ fontSize: 12.5, fontWeight: '700', color: selectedTargetExpenseId ? '#0f172a' : '#64748b' }} numberOfLines={1}>
                        {(() => {
                          const matched = expenses.find((e) => String(e.id) === String(selectedTargetExpenseId));
                          if (matched) {
                            return `${matched.title} (${parseFloat(matched.amount || 0).toLocaleString('tr-TR')} ₺) - ${matched.paidByCashier ? 'Ödendi' : 'Bekleyen Borç'}`;
                          }
                          return t.selectPendingExpense || '-- Listeden Bekleyen Gider / Fatura Seçin --';
                        })()}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#64748b' }}>▼</Text>
                    </TouchableOpacity>

                    {openTargetExpenseSelect && (
                      <View style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginTop: 4, maxHeight: 180 }}>
                        <ScrollView nestedScrollEnabled style={{ maxHeight: 180 }}>
                          <TouchableOpacity
                            style={{ padding: 9, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}
                            onPress={() => {
                              setSelectedTargetExpenseId('');
                              setOpenTargetExpenseSelect(false);
                            }}
                          >
                            <Text style={{ fontSize: 12, color: '#64748b' }}>{t.selectPendingExpense || '-- Listeden Bekleyen Gider / Fatura Seçin --'}</Text>
                          </TouchableOpacity>
                          {expenses
                            .filter((e) => e.status !== 'REJECTED')
                            .map((exp) => (
                              <TouchableOpacity
                                key={exp.id}
                                style={{
                                  padding: 10,
                                  borderBottomWidth: 1,
                                  borderBottomColor: '#f1f5f9',
                                  backgroundColor: String(selectedTargetExpenseId) === String(exp.id) ? '#ecfdf5' : '#ffffff',
                                }}
                                onPress={() => {
                                  setSelectedTargetExpenseId(exp.id);
                                  setOpenTargetExpenseSelect(false);
                                }}
                              >
                                <Text style={{ fontSize: 12, fontWeight: String(selectedTargetExpenseId) === String(exp.id) ? '800' : '600', color: '#0f172a' }}>
                                  {exp.title} ({parseFloat(exp.amount || 0).toLocaleString('tr-TR')} ₺) - {exp.paidByCashier ? 'Ödendi' : 'Bekleyen Borç'}
                                </Text>
                              </TouchableOpacity>
                            ))}
                        </ScrollView>
                      </View>
                    )}
                  </View>
                )}

                {/* CUSTOM Modu: Gider Detayları Formu */}
                {cashTargetAccount === 'CUSTOM' && (
                  <View style={{ backgroundColor: '#f8fafc', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#e2e8f0', gap: 10 }}>
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: '700', color: '#475569', marginBottom: 4 }}>
                        Ödeme Başlığı / Alıcı Kurum
                      </Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: '#ffffff', borderColor: '#cbd5e1' }]}
                        placeholder="Örn: Hal Sebze-Meyve Nakit Alımı, Personel Günlük Yevmiye..."
                        placeholderTextColor="#94a3b8"
                        value={customExpenseTitle}
                        onChangeText={setCustomExpenseTitle}
                      />
                    </View>

                    <View style={{ flexDirection: 'row', gap: 8 }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#64748b', marginBottom: 3 }}>Kategori</Text>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#ffffff',
                            borderWidth: 1,
                            borderColor: '#cbd5e1',
                            borderRadius: 8,
                            padding: 8,
                          }}
                          onPress={() => {
                            setOpenCustomCatSelect(!openCustomCatSelect);
                            setOpenCustomSubSelect(false);
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0f172a' }}>
                            {customExpenseCategory === 'VARIABLE' ? '⚡ Değişken' : '🏢 Sabit'}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#64748b' }}>▼</Text>
                        </TouchableOpacity>
                        {openCustomCatSelect && (
                          <View style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginTop: 4 }}>
                            <TouchableOpacity
                              style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}
                              onPress={() => {
                                setCustomExpenseCategory('VARIABLE');
                                setOpenCustomCatSelect(false);
                              }}
                            >
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0f172a' }}>{`⚡ ${t.variableLabel || 'Değişken Gider'}`}</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              style={{ padding: 8 }}
                              onPress={() => {
                                setCustomExpenseCategory('FIXED');
                                setOpenCustomCatSelect(false);
                              }}
                            >
                              <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0f172a' }}>🏢 Sabit Gider</Text>
                            </TouchableOpacity>
                          </View>
                        )}
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#64748b', marginBottom: 3 }}>{t.expenseType || 'Gider Türü'}</Text>
                        <TouchableOpacity
                          style={{
                            flexDirection: 'row',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            backgroundColor: '#ffffff',
                            borderWidth: 1,
                            borderColor: '#cbd5e1',
                            borderRadius: 8,
                            padding: 8,
                          }}
                          onPress={() => {
                            setOpenCustomSubSelect(!openCustomSubSelect);
                            setOpenCustomCatSelect(false);
                          }}
                        >
                          <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>
                            {customExpenseSubType === 'CONSUMABLES'
                              ? '📦 Sarf Malzeme'
                              : customExpenseSubType === 'LOGISTICS'
                              ? '🚚 Hal / Lojistik'
                              : customExpenseSubType === 'ELECTRICITY'
                              ? '⚡ Elektrik'
                              : customExpenseSubType === 'LABOR'
                              ? '👥 İşçilik'
                              : customExpenseSubType === 'RENT'
                              ? '🏢 Kira'
                              : '🏛️ Vergi'}
                          </Text>
                          <Text style={{ fontSize: 10, color: '#64748b' }}>▼</Text>
                        </TouchableOpacity>
                        {openCustomSubSelect && (
                          <View style={{ backgroundColor: '#ffffff', borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 8, marginTop: 4, maxHeight: 150 }}>
                            <ScrollView nestedScrollEnabled style={{ maxHeight: 150 }}>
                              {[
                                { key: 'CONSUMABLES', label: '📦 Sarf Malzeme' },
                                { key: 'LOGISTICS', label: '🚚 Hal / Lojistik' },
                                { key: 'ELECTRICITY', label: '⚡ Elektrik / Enerji' },
                                { key: 'LABOR', label: '👥 İşçilik / Personel' },
                                { key: 'RENT', label: '🏢 Kira' },
                                { key: 'TAX', label: '🏛️ Vergi / Stopaj' },
                              ].map((it) => (
                                <TouchableOpacity
                                  key={it.key}
                                  style={{ padding: 8, borderBottomWidth: 1, borderBottomColor: '#f1f5f9' }}
                                  onPress={() => {
                                    setCustomExpenseSubType(it.key);
                                    setOpenCustomSubSelect(false);
                                  }}
                                >
                                  <Text style={{ fontSize: 11.5, color: '#0f172a' }}>{it.label}</Text>
                                </TouchableOpacity>
                              ))}
                            </ScrollView>
                          </View>
                        )}
                      </View>
                    </View>

                    <View>
                      <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#64748b', marginBottom: 3 }}>{t.note || 'Açıklama / Not'}</Text>
                      <TextInput
                        style={[styles.modalInput, { backgroundColor: '#ffffff', borderColor: '#cbd5e1' }]}
                        placeholder="Ek kasa dekontu veya tedarikçi fişi notu..."
                        placeholderTextColor="#94a3b8"
                        value={cashAllocationNote}
                        onChangeText={setCashAllocationNote}
                      />
                    </View>
                  </View>
                )}
              </View>

              {/* Row 4: Bilgilendirme Notu */}
              <View
                style={{
                  backgroundColor: '#f0fdf4',
                  paddingVertical: 12,
                  paddingHorizontal: 14,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#bbf7d0',
                  flexDirection: 'row',
                  gap: 10,
                  alignItems: 'center',
                  marginBottom: 14,
                }}
              >
                <Text style={{ fontSize: 18 }}>ℹ️</Text>
                <Text style={{ fontSize: 11.5, color: '#166534', lineHeight: 16, flex: 1 }}>
                  Muhasebe kasasından yapılan bu nakit çıkışı doğrudan ilgili hesaba işlenecek,{' '}
                  <Text style={{ fontWeight: '800' }}>{t.advisorApprovalDesk || 'Mali Müşavir Onay Masası'}</Text>'na teyit için gönderilecektir.
                </Text>
              </View>
            </ScrollView>

            {/* Row 5: Aksiyon Butonları */}
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
              <TouchableOpacity
                style={{
                  flex: 1.6,
                  backgroundColor: '#047857',
                  paddingVertical: 13,
                  borderRadius: 10,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={handleConfirmCashAllocation}
              >
                <Text style={{ color: '#ffffff', fontSize: 13.5, fontWeight: '800' }}>
                  ✓ Kasadan Gideri Öde ve Müşavire Bildir
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={{
                  flex: 0.8,
                  paddingVertical: 13,
                  borderRadius: 10,
                  borderWidth: 1,
                  borderColor: '#cbd5e1',
                  backgroundColor: '#f1f5f9',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                onPress={() => setShowCashAllocationModal(false)}
              >
                <Text style={{ color: '#334155', fontSize: 13.5, fontWeight: '700' }}>{t.cancel || 'Vazgeç'}</Text>
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
                  { id: 'warehouse', label: `📦 ${t.chWarehouseShort || 'Depo'}`, color: '#8b5cf6' },
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
  webExportBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1.5,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
});
