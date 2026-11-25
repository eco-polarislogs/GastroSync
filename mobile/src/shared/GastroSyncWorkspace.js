import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Modal,
  Image,
  Share,
  AppState,
} from 'react-native';
import { Text, TextInput, setI18nLang, getI18nLang, useI18nLang } from '../i18n';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  ROLES,
  ROLE_LABELS,
  ROLE_COLORS,
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
  apiFetchUsers,
  apiFetchRecipes,
  apiFetchTransactions,
  apiFetchExpenses,
  apiFetchNotifications,
  apiCreateNotification,
  apiReportSecurityAlert,
  apiFetchChatMessages,
  apiFetchSales,
  apiFetchSalesSummary,
  apiFetchPendingDeliveries,
  apiFetchMe,
  apiFetchMenuPricing,
  apiFetchPeriodSummary,
  apiFetchChatUnread,
  apiMarkChatRead,
  apiApproveExpense as raw_apiApproveExpense,
  apiSubmitExpense as raw_apiSubmitExpense,
  apiFinalizeExpense as raw_apiFinalizeExpense,
  apiRejectExpense as raw_apiRejectExpense,
  apiPurchaseRequest,
  setApiErrorHandler,
  apiReceiveStock as raw_apiReceiveStock,
  apiRecordWaste as raw_apiRecordWaste,
  apiUpdateUserRole as raw_apiUpdateUserRole,
  apiCreateUser as raw_apiCreateUser,
  apiDeleteUser as raw_apiDeleteUser,
  apiCreateRecipe as raw_apiCreateRecipe,
  apiUpdateRecipe as raw_apiUpdateRecipe,
  apiDeleteRecipe as raw_apiDeleteRecipe,
  apiSetRecipePrice as raw_apiSetRecipePrice,
  apiSetUserActive as raw_apiSetUserActive,
  apiFetchRoleCatalog,
  apiResetUserPassword as raw_apiResetUserPassword,
  apiUpdateUserProfile as raw_apiUpdateUserProfile,
  apiVoidSale as raw_apiVoidSale,
  apiAdjustStock as raw_apiAdjustStock,
  apiCreateInventoryItem as raw_apiCreateInventoryItem,
  apiUpdateInventoryItem as raw_apiUpdateInventoryItem,
  apiDeleteInventoryItem as raw_apiDeleteInventoryItem,
  apiCreateExpense as raw_apiCreateExpense,
  apiUpdateExpense as raw_apiUpdateExpense,
  apiDeleteExpense as raw_apiDeleteExpense,
  apiSendChatMessage as raw_apiSendChatMessage,
  apiMarkNotificationRead as raw_apiMarkNotificationRead,
  apiMarkAllNotificationsRead as raw_apiMarkAllNotificationsRead,
} from '../services/api';
import mobileWebSocketService from '../services/websocketService';
import PosScreen from '../screens/PosScreen';
import KitchenScreen from '../screens/KitchenScreen';
import CashControlPanel from '../screens/CashControlPanel';
import { AuditScreen, PeriodPanel, VatSummary } from '../screens/RecordsScreens';
import ApprovalsList from '../screens/ApprovalsScreen';
import { initPhoneNotifications, registerRemotePush, presentPhoneNotification, onPhoneNotificationTap } from '../services/pushNotifications';
import { ensureFreshSession } from '../services/mobileAxiosClient';

/** Bildirim bağlantısı (web rotası) -> mobil ekran (yalnızca rolün açabildiği ekran açılır) */
const screenForRoute = (r) => {
  if (!r) return null;
  if (r.includes('approvals')) return 'cashier';
  if (r.includes('pos')) return 'pos';
  if (r.includes('kitchen')) return 'kitchen';
  if (r.includes('cashier') || r.includes('accounting')) return 'cashier';
  if (r.includes('advisor')) return 'advisor';
  if (r.includes('inventory')) return 'inventory';
  if (r.includes('warehouse')) return 'warehouse';
  if (r.includes('recipes')) return 'recipes';
  if (r.includes('sales')) return 'sales';
  if (r.includes('users')) return 'users';
  if (r.includes('audit')) return 'audit';
  return null;
};

const { width } = Dimensions.get('window');

// Sohbet kanalları: sunucudaki AppRoles.CHAT_CHANNELS ile birebir aynı (sunucu ayrıca zorunlu kılar)
const CHAT_CHANNEL_ROLES = {
  general: ['admin', 'manager', 'chef', 'warehouse', 'accountant', 'financial_advisor', 'cashier'],
  shift: ['admin', 'manager', 'chef', 'warehouse', 'accountant', 'cashier'],
  kitchen: ['admin', 'manager', 'chef', 'warehouse', 'cashier'],
  warehouse: ['admin', 'manager', 'chef', 'warehouse', 'accountant'],
  cashier: ['admin', 'manager', 'accountant', 'financial_advisor', 'cashier'],
  management: ['admin', 'manager', 'accountant', 'financial_advisor'],
};
const LIST_PAGE_SIZE = 10;
const EMPTY_SALES_SUMMARY = { totalRevenue: 0, totalCost: 0, foodCostPercent: 0, targetFoodCost: 30, netProfit: 0, totalSalesCount: 0 };

// Rol Normalizasyonu (Büyük/Küçük Harf Toleranslı Güvenli Yetkilendirme)
const normalizeRole = (r) => (r || '').toString().toLowerCase();

// Ekranlar SUNUCUDAN gelir (/api/auth/me → screens). Sunucu ekran kimliği → mobil ekran eşlemesi.
// Mobilde karşılığı olmayan ekranlar (Menü & Maliyet, Denetim İzi) web panelindedir.
const SERVER_TO_MOBILE_SCREEN = {
  dashboard: 'dashboard',
  approvals: 'cashier',
  accounting: 'cashier',
  'advisor-ledger': 'advisor',
  pos: 'pos',
  kitchen: 'kitchen',
  sales: 'sales',
  inventory: 'inventory',
  recipes: 'recipes',
  warehouse: 'warehouse',
  users: 'users',
  audit: 'audit',
};
const mobileScreensOf = (screens) => Array.from(new Set((Array.isArray(screens) ? screens : [])
  .map((s) => SERVER_TO_MOBILE_SCREEN[s]).filter(Boolean)));

// Alt menü: kısa etiketler (taşmayı önler) ve simgeler
const NAV_ICONS = {
  dashboard: '🏠', pos: '🍽️', kitchen: '👨‍🍳', cashier: '💰', advisor: '📒',
  inventory: '📦', recipes: '📖', sales: '📊', warehouse: '🏬', users: '👥', audit: '🛡️',
};
const NAV_LABELS = {
  tr: { dashboard: 'Özet', pos: 'Masalar', kitchen: 'Mutfak', cashier: 'Muhasebe', approvals: 'Onaylar', advisor: 'Defter', inventory: 'Stok', recipes: 'Reçete', sales: 'Satış', warehouse: 'Depo', users: 'Personel', more: 'Daha', audit: 'Denetim' },
  en: { dashboard: 'Home', pos: 'Tables', kitchen: 'Kitchen', cashier: 'Accounts', approvals: 'Approvals', advisor: 'Ledger', inventory: 'Stock', recipes: 'Recipes', sales: 'Sales', warehouse: 'Receiving', users: 'Staff', more: 'More', audit: 'Audit' },
  de: { dashboard: 'Übersicht', pos: 'Tische', kitchen: 'Küche', cashier: 'Buchhaltung', approvals: 'Freigaben', advisor: 'Journal', inventory: 'Lager', recipes: 'Rezepte', sales: 'Verkauf', warehouse: 'Eingang', users: 'Personal', more: 'Mehr', audit: 'Prüfung' },
  ar: { dashboard: 'الملخص', pos: 'الطاولات', kitchen: 'المطبخ', cashier: 'المحاسبة', approvals: 'الموافقات', advisor: 'الدفتر', inventory: 'المخزون', recipes: 'الوصفات', sales: 'المبيعات', warehouse: 'المستودع', users: 'الموظفون', more: 'المزيد', audit: 'التدقيق' },
};
const MAX_NAV_TABS = 5;

export default function GastroSyncWorkspace({ initialUser, onLogout }) {
  const insets = useSafeAreaInsets();
  const [currentUser, setCurrentUser] = useState(() => {
    return { ...initialUser, role: normalizeRole(initialUser?.role) };
  });
  const [showRoleSwitchModal, setShowRoleSwitchModal] = useState(false);

  // Bu rolün izinli olduğu ekranlar ve izinler sunucudan gelir (roller birbirinin ekranlarına geçemez)
  const currentRole = normalizeRole(currentUser?.role);
  const permissions = Array.isArray(currentUser?.permissions) ? currentUser.permissions : [];
  const can = (...perms) => perms.some((p) => permissions.includes(p));
  const allowedScreens = mobileScreensOf(currentUser?.screens);
  // Telefon bildirimi dinleyicileri tek sefer kurulur; güncel dil / ekran listesi / gezinme ref ile okunur
  const allowedScreensRef = React.useRef(allowedScreens);
  allowedScreensRef.current = allowedScreens;
  const navigateRef = React.useRef(() => {});

  const getDefaultScreen = (screens) => mobileScreensOf(screens)[0] || 'dashboard';

  const [currentScreen, setCurrentScreen] = useState(getDefaultScreen(currentUser.screens));
  // Android sanal gezinme tuşuna (üçgen / jest) ihtiyaç bırakmayan dahili ekran geri navigasyon yığını
  const [screenStack, setScreenStack] = useState([getDefaultScreen(currentUser.screens)]);

  const [items, setItems] = useState([]);
  const [recipes, setRecipes] = useState([]);
  const [users, setUsers] = useState([]);
  const [transactions, setTransactions] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [deliveries, setDeliveries] = useState([]);
  const [currentLang, setCurrentLang] = useState(getI18nLang());
  const i18nLang = useI18nLang();
  // Giriş ekranında seçilen / cihazda kayıtlı dil çalışma alanına yansır
  React.useEffect(() => { if (i18nLang !== currentLang) setCurrentLang(i18nLang); }, [i18nLang]);
  const langRef = React.useRef(currentLang);
  langRef.current = currentLang;
  // Seçili dil, ortak Text / TextInput bileşenlerinin çevirisine aktarılır (sabit metinlerin tamamı değişir)
  React.useEffect(() => { setI18nLang(currentLang); }, [currentLang]);
  const [showLangModal, setShowLangModal] = useState(false);
  const [showMoreNav, setShowMoreNav] = useState(false);
  const [showAllAlerts, setShowAllAlerts] = useState(false);
  const t = TRANSLATIONS[currentLang] || TRANSLATIONS.tr;

  const isAccountantUser = currentRole === 'accountant';
  const isAdvisorUser = currentRole === 'financial_advisor';

  const [expenseTab, setExpenseTab] = useState(() => {
    const perms = Array.isArray(initialUser?.permissions) ? initialUser.permissions : [];
    if (perms.includes('EXPENSE_CREATE')) return 'pending_approval';
    if (perms.includes('EXPENSE_APPROVE')) return 'approve';
    return 'all';
  });
  const [acctSection, setAcctSection] = useState('expenses');
  const [showExportRow, setShowExportRow] = useState(false);
  const [expenseSearch, setExpenseSearch] = useState('');
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

  const [mobileNotifications, setMobileNotifications] = useState([]);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [salesSummary, setSalesSummary] = useState(EMPTY_SALES_SUMMARY);
  const [periodSummary, setPeriodSummary] = useState(null);
  const [todaySales, setTodaySales] = useState([]);

  // Sunucu verisi: her rol yalnızca yetkili olduğu veriyi çeker (yetkisiz okuma = güvenlik alarmı)
  const refreshAllData = React.useCallback(async () => {
    const p = Array.isArray(currentUser.permissions) ? currentUser.permissions : [];
    const has = (perm) => p.includes(perm);
    const none = async () => null;
    // Her rol yalnızca izinli olduğu veriyi ister; yetkisiz okuma denemesi sunucuda güvenlik alarmı üretir
    const [liveItems, liveUsers, liveRecipes, liveTx, liveExp, liveNotifs, liveChat, liveSales, liveSalesSummary, liveDeliveries] = await Promise.all([
      has('INVENTORY_VIEW') ? apiFetchInventory() : none(),
      has('USER_MANAGE') ? apiFetchUsers() : none(),
      has('RECIPE_VIEW') ? apiFetchRecipes() : none(),
      has('INVENTORY_VIEW') ? apiFetchTransactions() : none(),
      has('EXPENSE_VIEW') ? apiFetchExpenses() : none(),
      apiFetchNotifications(),
      apiFetchChatMessages(),
      has('SALES_VIEW') ? apiFetchSales() : none(),
      has('SALES_VIEW') ? apiFetchSalesSummary() : none(),
      has('DELIVERY_VIEW') ? apiFetchPendingDeliveries() : none(),
    ]);
    if (Array.isArray(liveItems)) setItems(liveItems);
    if (Array.isArray(liveUsers)) setUsers(liveUsers);
    if (Array.isArray(liveRecipes)) setRecipes(liveRecipes);
    if (Array.isArray(liveTx)) setTransactions(liveTx);
    if (Array.isArray(liveExp)) setExpenses(liveExp);
    if (Array.isArray(liveNotifs)) {
      setMobileNotifications(liveNotifs);
      setUnreadNotifCount(liveNotifs.filter((n) => !n.isRead).length);
    }
    if (Array.isArray(liveChat)) setChatMessages(liveChat);
    if (Array.isArray(liveSales)) setTodaySales(liveSales);
    if (liveSalesSummary) setSalesSummary(liveSalesSummary);
    if (Array.isArray(liveDeliveries)) setDeliveries(liveDeliveries);
    if (has('FINANCE_SUMMARY_VIEW')) {
      const ps = await apiFetchPeriodSummary();
      if (ps) setPeriodSummary(ps);
    }
  }, [currentUser.role, currentUser.permissions]);

  React.useEffect(() => {
    setApiErrorHandler((msg) => showToast(`⚠️ ${msg}`));
    refreshAllData();
    const role = normalizeRole(currentUser.role);
    const userRole = role.toUpperCase();
    const seenPhone = new Set();
    const mergeNotif = (newNotif, phone = false) => {
      if (!newNotif || !newNotif.id) return;
      setMobileNotifications((prev) => {
        if (prev.some((n) => n.id === newNotif.id)) return prev;
        setUnreadNotifCount((c) => c + 1);
        return [newNotif, ...prev].slice(0, 200);
      });
      // Kullanıcının rolüne gelen bildirim telefonun bildirim çubuğunda da gösterilir (seçili dilde)
      if (phone && !seenPhone.has(newNotif.id)) {
        seenPhone.add(newNotif.id);
        const loc = getLocalizedNotification(newNotif, langRef.current);
        presentPhoneNotification({ ...newNotif, title: loc.title || newNotif.title, message: loc.message || newNotif.message });
      }
    };
    // Telefon bildirimi izni + (EAS derlemesinde) uzak push kaydı
    initPhoneNotifications().then((ok) => { if (ok) registerRemotePush(); });
    const offTap = onPhoneNotificationTap((data) => {
      const target = screenForRoute(data && data.route);
      if (target && allowedScreensRef.current.includes(target)) navigateRef.current(target);
    });
    // Uygulama ön plana dönünce oturum (erişim token'ı) süresi dolmak üzereyse yenilenir
    const appStateSub = AppState.addEventListener('change', (state) => { if (state === 'active') ensureFreshSession(); });
    const subs = [
      offTap,
      () => appStateSub.remove(),
      mobileWebSocketService.subscribe('/topic/notifications', (n) => mergeNotif(n, true)),
      mobileWebSocketService.subscribe(`/topic/notifications/${userRole}`, (n) => mergeNotif(n, true)),
      // Aynı kullanıcının diğer cihazlarındaki okundu işlemleri
      mobileWebSocketService.subscribe('/user/queue/notifications', (evt) => {
        if (evt?.type === 'READ') {
          setMobileNotifications((prev) => prev.map((n) => (n.id === evt.id ? { ...n, isRead: true } : n)));
          setUnreadNotifCount((c) => Math.max(0, c - 1));
        }
        if (evt?.type === 'READ_ALL') {
          setMobileNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
          setUnreadNotifCount(0);
        }
      }),
      // Stok / finans değişikliklerinde ilgili veriyi tazele
      mobileWebSocketService.subscribe('/topic/inventory', () => {
        if ((currentUser.permissions || []).includes('INVENTORY_VIEW')) {
          apiFetchInventory().then((list) => Array.isArray(list) && setItems(list));
        }
      }),
    ];
    if (role === 'admin') subs.push(mobileWebSocketService.subscribe('/topic/notifications/supervisors', mergeNotif));
    const perms = currentUser.permissions || [];
    if (perms.includes('EXPENSE_VIEW') || perms.includes('SALES_VIEW')) {
      // Gider, ödeme, satış ve iptal sinyalleri: ilgili listeler sunucudan yeniden çekilir
      subs.push(mobileWebSocketService.subscribe('/topic/finance', () => {
        if (perms.includes('EXPENSE_VIEW')) apiFetchExpenses().then((list) => Array.isArray(list) && setExpenses(list));
        if (perms.includes('SALES_VIEW')) {
          apiFetchSales().then((list) => Array.isArray(list) && setTodaySales(list));
          apiFetchSalesSummary().then((sum) => sum && setSalesSummary(sum));
        }
      }));
    }
    if (perms.includes('RECIPE_VIEW')) {
      // Şefin yeni reçetesi / Müdürün fiyat onayı web ve mobilde anında görünür
      subs.push(mobileWebSocketService.subscribe('/topic/recipes', () => {
        apiFetchRecipes().then((list) => Array.isArray(list) && setRecipes(list));
      }));
    }
    if (perms.includes('USER_MANAGE')) {
      subs.push(mobileWebSocketService.subscribe('/topic/users', () => {
        apiFetchUsers().then((list) => Array.isArray(list) && setUsers(list));
      }));
    }
    // Bağlantı kopmasına karşı yedek periyodik yenileme
    const timer = setInterval(refreshAllData, 60000);
    return () => {
      clearInterval(timer);
      subs.forEach((u) => u && u());
      setApiErrorHandler(null);
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
  const [newRecipe, setNewRecipe] = useState({ name: '', category: 'Ana Yemek', salePrice: '', ingredients: [{ itemId: null, name: '', quantity: '', unit: '' }] });
  const [ingFocusIdx, setIngFocusIdx] = useState(null);
  const [editingRecipe, setEditingRecipe] = useState(null);

  // Web Birebir Silme Onay Modalı (Delete Confirmation Modal)
  const [itemToDelete, setItemToDelete] = useState(null); // { type: 'stock'|'recipe'|'user', id, name, details }

  const [showAddUserModal, setShowAddUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', username: '', email: '', role: ROLES.CHEF, password: '' });
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
  const [chatMessages, setChatMessages] = useState([]);

  // Kanal bazlı okunmamış sayıları sunucuda tutulur: web ve mobil aynı durumu görür
  const [chatUnread, setChatUnread] = useState({});
  const chatOpenRef = React.useRef(false);
  const activeChatRef = React.useRef('general');
  chatOpenRef.current = showTeamChatModal;
  activeChatRef.current = activeChatChannel;
  const refreshChatUnread = React.useCallback(async () => {
    const data = await apiFetchChatUnread();
    if (data) setChatUnread(data);
  }, []);
  const markChatRead = React.useCallback((channelId) => {
    if (!channelId) return;
    setChatUnread((prev) => (prev[channelId] ? { ...prev, [channelId]: 0 } : prev));
    apiMarkChatRead(channelId);
  }, []);

  // Yetkili olunan tüm kanallar dinlenir (mesajlar + diğer kanalların okunmamış sayaçları)
  React.useEffect(() => {
    const channels = Object.keys(CHAT_CHANNEL_ROLES).filter((ch) => CHAT_CHANNEL_ROLES[ch].includes(currentRole));
    refreshChatUnread();
    const unsubs = channels.map((ch) => mobileWebSocketService.subscribe(`/topic/chat/${ch}`, (incomingMsg) => {
      if (!incomingMsg || !incomingMsg.id) return;
      setChatMessages((prev) => (prev.some((m) => m.id === incomingMsg.id) ? prev : [...prev, incomingMsg]));
      const own = incomingMsg.senderUsername && incomingMsg.senderUsername === currentUser?.username;
      if (own) return;
      if (chatOpenRef.current && activeChatRef.current === ch) markChatRead(ch);
      else setChatUnread((prev) => ({ ...prev, [ch]: (prev[ch] || 0) + 1 }));
    }));
    // Başka cihazda (web / diğer telefon) okunan kanal burada da okunmuş görünür
    const unsubRead = mobileWebSocketService.subscribe('/user/queue/chat-read', (evt) => {
      if (evt && evt.channelId) setChatUnread((prev) => ({ ...prev, [evt.channelId]: Number(evt.unread) || 0 }));
    });
    const timer = setInterval(refreshChatUnread, 60000);
    return () => {
      unsubs.forEach((u) => u && u());
      if (unsubRead) unsubRead();
      clearInterval(timer);
    };
  }, [currentRole, currentUser?.username, refreshChatUnread, markChatRead]);

  // Açık olan kanal okunmuş sayılır
  React.useEffect(() => {
    if (showTeamChatModal && activeChatChannel) markChatRead(activeChatChannel);
  }, [showTeamChatModal, activeChatChannel, markChatRead]);
  const totalChatUnread = Object.values(chatUnread).reduce((sum, n) => sum + (Number(n) || 0), 0);

  // Menü fiyat / maliyet dalgalanması analizi (sunucuda hesaplanır; yönetim ve muhasebe görür)
  const [menuPricing, setMenuPricing] = useState(null);
  const loadMenuPricing = React.useCallback(async () => {
    if (!permissions.includes('PRICING_VIEW')) return;
    const data = await apiFetchMenuPricing(30);
    if (data) setMenuPricing(data);
  }, [currentRole, permissions.join(',')]);
  React.useEffect(() => {
    loadMenuPricing();
    const timer = setInterval(loadMenuPricing, 120000);
    return () => clearInterval(timer);
  }, [loadMenuPricing]);

  // Muhasebe: faturalandır & Mali Müşavire gönder penceresi
  const [submitTargetMobile, setSubmitTargetMobile] = useState(null);
  const [submitInvoiceNo, setSubmitInvoiceNo] = useState('');
  const [submitCounterparty, setSubmitCounterparty] = useState('');
  const [submitNote, setSubmitNote] = useState('');

  const handleSendChatMessage = async () => {
    const text = chatInputMsg.trim();
    if (!text) return;
    // Gönderen kimliği sunucuda belirlenir; mesaj yalnızca bir kez (REST) kaydedilir
    const res = await apiSendChatMessage({ channelId: activeChatChannel, text, priority: chatIsUrgent ? 'urgent' : 'normal' });
    if (res.success) {
      setChatInputMsg('');
      setChatIsUrgent(false);
      if (res.data?.id) setChatMessages((prev) => (prev.some((m) => m.id === res.data.id) ? prev : [...prev, res.data]));
    }
  };

  const handleCreateOrderRequest = async () => {
    if (!orderModalItem) return;
    const qty = parseFloat(String(orderQuantity).replace(',', '.')) || 0;
    if (qty <= 0) {
      showToast('Lütfen geçerli bir sipariş miktarı giriniz.');
      return;
    }
    // Sunucu: muhasebe onayına tahmini tutarlı kayıt + ilgili rollere bildirim + depo kanalına mesaj
    const res = await apiPurchaseRequest(orderModalItem.id, qty, orderUrgent, orderNote);
    if (!res.success) {
      showToast(`❌ ${res.message}`);
      return;
    }
    showToast(`✓ "${orderModalItem.name}" tedarik talebi muhasebe onayına iletildi.`);
    setOrderModalItem(null);
    setOrderQuantity('15');
    setOrderNote('');
    setOrderUrgent(false);
    refreshAllData();
  };

  // Filtreler
  const [inventorySearch, setInventorySearch] = useState('');
  const [inventoryCategory, setInventoryCategory] = useState('all');
  const [recipeSearch, setRecipeSearch] = useState('');
  const [openRecipeId, setOpenRecipeId] = useState(null);
  const [openUserId, setOpenUserId] = useState(null);
  // Rol görev tanımları sunucudan (web personel ekranıyla aynı metin)
  const [roleCatalog, setRoleCatalog] = useState({});
  React.useEffect(() => {
    if (!(initialUser?.permissions || []).includes('USER_MANAGE')) return;
    apiFetchRoleCatalog().then((res) => {
      if (res && res.success && Array.isArray(res.data)) {
        setRoleCatalog(Object.fromEntries(res.data.map((r) => [String(r.role || '').toLowerCase(), r])));
      }
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Yönetici personel işlemi: { type: 'profile' | 'password', user }
  const [userAction, setUserAction] = useState(null);
  const [userActionName, setUserActionName] = useState('');
  const [userActionEmail, setUserActionEmail] = useState('');
  const [userActionPassword, setUserActionPassword] = useState('');
  // Müdür satış iptali / Depo sayım düzeltmesi
  const [voidTarget, setVoidTarget] = useState(null);
  const [voidReason, setVoidReason] = useState('');
  const [countMode, setCountMode] = useState(false);
  const [countReason, setCountReason] = useState('');
  // Stok ekranı ürün işlem penceresi: rolün izinli olduğu işlemler (fire / mal kabul / sayım / maliyet / kart)
  const [itemSheetMode, setItemSheetMode] = useState(null);
  // Muhasebe ödeme penceresi: tutar (kısmi ödeme) + yöntem (nakit / banka / kart) — web ile aynı
  const [payTarget, setPayTarget] = useState(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState('BANK_TRANSFER');
  const [payNote, setPayNote] = useState('');
  const [itemSheetQty, setItemSheetQty] = useState('');
  const [itemSheetReason, setItemSheetReason] = useState('');
  const [priceTarget, setPriceTarget] = useState(null);
  const [priceInput, setPriceInput] = useState('');
  const [priceReason, setPriceReason] = useState('');
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

  // Depo: barkod tam eşleşmesi önce, sonra ad içinde arama (en fazla 5 öneri)
  const normBarcode = (v) => String(v || '').replace(/\s+/g, '');
  const warehouseMatches = (() => {
    const q = (barcodeInput || '').trim().toLowerCase();
    if (q.length < 2) return [];
    const exact = items.filter((i) => i.barcode && normBarcode(i.barcode) === normBarcode(q));
    const byName = items.filter((i) => !exact.includes(i) && (i.name.toLowerCase().includes(q) || (i.barcode || '').includes(q)));
    return [...exact, ...byName].slice(0, 5);
  })();
  const findWarehouseItem = (raw) => {
    const clean = (raw || '').trim();
    if (!clean) return;
    const exact = items.find((i) => i.barcode && normBarcode(i.barcode) === normBarcode(clean));
    const f = exact || (warehouseMatches.length === 1 ? warehouseMatches[0] : null);
    if (f) {
      setSelectedItem(f);
    } else if (warehouseMatches.length > 1) {
      showToast('Birden fazla ürün eşleşti — listeden seçin');
    } else if (can('INVENTORY_ITEM_MANAGE')) {
      setNewStockItem((prev) => ({ ...prev, barcode: clean, name: '', stock: '' }));
      setShowAddStockModal(true);
      showToast(`Tanımsız barkod (${clean}) — yeni ürün kartı açıldı`);
    } else {
      showToast(`"${clean}" bulunamadı`);
    }
  };

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
  const foodCostTotal = salesSummary.totalCost || 0;
  const totalRevenue = salesSummary.totalRevenue || 0;
  const grandTotalCost = foodCostTotal + totalOperatingExpenses;
  // Faaliyet kârı sunucudaki dönem özetinden gelir (bu ayın net satışı − SMM − fire − faaliyet giderleri);
  // günün cirosundan tüm dönemlerin giderlerini düşmek yanıltıcı olurdu.
  const netOperatingProfit = periodSummary ? Number(periodSummary.operatingProfit) || 0 : 0;

  // Web Birebir: Satış Analizi Gruplama ve Filtreleme
  const salesItemsToProcess = todaySales;

  const saleFigures = (sale) => {
    const gross = parseFloat(sale.totalRevenue ?? sale.totalPrice ?? 0) || 0;
    const vat = parseFloat(sale.vatAmount ?? 0) || 0;
    const cost = parseFloat(sale.totalCost ?? 0) || 0;
    const net = gross - vat;
    return { gross, net, cost, profit: net - cost, fc: net > 0 ? (cost / net) * 100 : 0 };
  };
  const passesProfitFilter = (fc) => (salesProfitFilter === 'high_profit' ? fc < 30 : salesProfitFilter === 'high_cost' ? fc >= 40 : true);

  const salesByRecipe = salesItemsToProcess.reduce((acc, sale) => {
    const name = sale.recipeName || sale.productName || 'Diğer';
    if (!acc[name]) acc[name] = { quantity: 0, revenue: 0, net: 0, cost: 0 };
    const f = saleFigures(sale);
    acc[name].quantity += Number(sale.quantity) || 1;
    acc[name].revenue += f.gross;
    acc[name].net += f.net;
    acc[name].cost += f.cost;
    return acc;
  }, {});

  const sortedSalesByRevenue = Object.entries(salesByRecipe)
    .filter(([name, data]) => {
      const fc = data.net > 0 ? (data.cost / data.net) * 100 : 0;
      return name.toLowerCase().includes(salesSearchQuery.toLowerCase()) && passesProfitFilter(fc);
    })
    .sort(([, x], [, y]) => y.revenue - x.revenue);

  const filteredTimelineSales = salesItemsToProcess.filter((sale) => {
    const name = sale.recipeName || sale.productName || '';
    const q = salesSearchQuery.toLowerCase();
    return (name.toLowerCase().includes(q) || String(sale.time || '').includes(salesSearchQuery)) && passesProfitFilter(saleFigures(sale).fc);
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

  // Depoya beklenen teslimatlar sunucudan gelir (onaylı / bekleyen hammadde alım talepleri)
  const pendingDeliveries = deliveries.map((d) => {
    const item = items.find((i) => i.id === d.itemId);
    return {
      expenseId: d.expenseId,
      inventoryItemId: d.itemId,
      itemName: d.itemName,
      barcode: item ? (item.barcode || '—') : '—',
      quantity: Number(d.remainingQuantity) || 0,
      unit: d.unit,
      unitCost: item ? item.price : 0,
      totalCost: 0,
      isPaid: d.paymentStatus === 'PAID',
      supplier: d.supplier || '-',
      originalNote: `${d.approvalStatus === 'PENDING_APPROVAL' ? 'Muhasebe onayı bekleniyor' : 'Onaylandı'} · Talep: ${d.requestedBy || '-'}`,
      orderDate: d.dueDate || '',
    };
  });

  const totalInventoryValue = items.reduce((sum, i) => sum + ((parseFloat(i.stock) || 0) * (parseFloat(i.price) || 0)), 0);
  const criticalStockCount = items.filter((i) => (parseFloat(i.stock) || 0) <= (parseFloat(i.min) || 5)).length;

  // Gider listeleri (Muhasebe ve Mali Müşavir) için ek filtreler: ödeme durumu, dönem, gider türü
  const [expFilters, setExpFilters] = useState({});
  const getExpFilter = (key) => expFilters[key] || { payment: 'all', period: 'all', type: 'all' };
  const setExpFilter = (key, patch) => {
    setExpFilters((prev) => ({ ...prev, [key]: { ...getExpFilter(key), ...patch } }));
    setListPages((prev) => ({ ...prev, [key]: 1 }));
  };
  const expPayState = (e) => {
    if (e.paymentStatus === 'PARTIAL') return 'partial';
    if (e.paymentStatus === 'PAID') return 'paid';
    return 'unpaid';
  };
  const matchExpFilters = (key, e) => {
    const f = getExpFilter(key);
    if (f.payment !== 'all' && expPayState(e) !== f.payment) return false;
    if (f.period !== 'all' && e.period !== f.period) return false;
    if (f.type !== 'all' && e.subType !== f.type) return false;
    return true;
  };
  const filteredExpenses = expenses.filter((e) => {
    let matchTab = true;
    if (expenseTab === 'fixed') matchTab = e.category === 'FIXED';
    else if (expenseTab === 'variable') matchTab = e.category === 'VARIABLE';
    else if (expenseTab === 'rent') matchTab = e.subType === 'RENT';
    else if (expenseTab === 'debt') matchTab = e.paymentStatus === 'UNPAID' || e.paymentStatus === 'PARTIAL' || !e.paidByCashier;
    else if (expenseTab === 'rejected') matchTab = e.status === 'NEEDS_CORRECTION' || e.status === 'REJECTED';
    else if (expenseTab === 'approve') matchTab = e.status === 'PENDING_APPROVAL';
    else if (expenseTab === 'to_pay') matchTab = e.status === 'APPROVED' && !e.paidByCashier;
    else if (expenseTab === 'at_advisor') matchTab = e.status === 'APPROVED' && Boolean(e.sentToAdvisor) && !e.recordedInLedger;
    else if (expenseTab === 'awaiting_advisor' || expenseTab === 'pending_approval') {
      // Muhasebenin işlem bekleyenleri: onay bekleyen + onaylanmış ama henüz müşavire gönderilmemiş
      matchTab = e.status === 'PENDING_APPROVAL' || (e.status === 'APPROVED' && !e.sentToAdvisor);
    } else if (expenseTab === 'ledger') matchTab = Boolean(e.recordedInLedger) || e.status === 'FINALIZED';

    const matchSearch =
      !expenseSearch ||
      e.title.toLowerCase().includes(expenseSearch.toLowerCase()) ||
      (e.counterparty && e.counterparty.toLowerCase().includes(expenseSearch.toLowerCase())) ||
      (e.invoiceNumber && e.invoiceNumber.toLowerCase().includes(expenseSearch.toLowerCase())) ||
      (e.note && e.note.toLowerCase().includes(expenseSearch.toLowerCase())) ||
      (e.period && e.period.includes(expenseSearch)) ||
      (e.expenseDate && e.expenseDate.includes(expenseSearch));
    return matchTab && matchSearch && matchExpFilters('expenses', e);
  });

  // Mali Müşavir Defteri İçin Özel Filtrelenmiş Giderler
  const filteredAdvisorExpenses = expenses.filter((e) => {
    let matchTab = true;
    const isFinalized = e.status === 'FINALIZED' || Boolean(e.recordedInLedger);
    const isNeedsCorrection = e.status === 'NEEDS_CORRECTION' || e.status === 'REJECTED';
    // Müşavirin inceleme kuyruğu: muhasebenin faturalandırıp gönderdiği kayıtlar
    const isPending = e.status === 'APPROVED' && Boolean(e.sentToAdvisor);

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
    return matchTab && matchSearch && matchExpFilters('advisorExpenses', e);
  });

  const navigateTo = async (screen) => {
    if (!allowedScreens.includes(screen)) {
      showToast('🚨 Yetkisiz Erişim Engellendi!');
      // Güvenlik bildirimi sunucuda üretilir ve Yöneticiye iletilir
      try { await apiReportSecurityAlert(screen, 'MOBIL_NAVIGASYON_DENEMESI'); } catch (_) {}
      return;
    }
    if (screen === currentScreen) return;
    setScreenStack((prev) => {
      const filtered = prev.filter((s) => s !== screen);
      return [...filtered.slice(-4), screen];
    });
    setCurrentScreen(screen);
  };
  navigateRef.current = navigateTo;

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
    const defaultScreen = getDefaultScreen(currentUser.screens);
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
    setTimeout(() => setToastMessage(''), 3500);
  };
  // Alt ekranlara sabit referans: her render'da yeniden oluşan fonksiyon veri yükleme döngüsü yaratmasın
  const showToastRef = React.useRef(showToast);
  showToastRef.current = showToast;
  const notify = React.useCallback((m) => showToastRef.current(m), []);
  // Müdür bu ekranı "Onaylar" olarak, Muhasebe "Muhasebe", Yönetici "Muhasebe (izleme)" olarak görür
  const accountingLabel = can('EXPENSE_CREATE') ? 'Muhasebe' : can('EXPENSE_APPROVE') ? 'Onaylar' : 'Muhasebe (izleme)';

  // Liste sıralama: her liste için seçilebilir sıralama (Türkçe harf sırasına uygun)
  const trCompare = (a, b) => String(a || '').localeCompare(String(b || ''), 'tr', { sensitivity: 'base', numeric: true });
  const n = (v) => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; };
  const SORT_OPTIONS = {
    inventory: [
      ['name', 'A→Z', (a, b) => trCompare(a.name, b.name)],
      ['critical', 'Kritik', (a, b) => (n(a.stock) / Math.max(n(a.min), 0.001)) - (n(b.stock) / Math.max(n(b.min), 0.001))],
      ['stockDesc', 'Stok', (a, b) => n(b.stock) - n(a.stock)],
      ['valueDesc', 'Değer', (a, b) => n(b.stock) * n(b.price) - n(a.stock) * n(a.price)],
    ],
    recipes: [
      ['name', 'A→Z', (a, b) => trCompare(a.name, b.name)],
      ['priceDesc', 'Fiyat', (a, b) => n(b.salePrice) - n(a.salePrice)],
      ['costDesc', 'Maliyet', (a, b) => n(b.cost) - n(a.cost)],
      ['marginAsc', 'Düşük kâr', (a, b) => (n(a.salePrice) - n(a.cost)) - (n(b.salePrice) - n(b.cost))],
      ['pending', 'Onay bekleyen', (a, b) => Number(a.priceApproved !== false) - Number(b.priceApproved !== false) || trCompare(a.name, b.name)],
    ],
    users: [
      ['name', 'A→Z', (a, b) => trCompare(a.name, b.name)],
      ['role', 'Rol', (a, b) => trCompare(ROLE_LABELS[a.role] || a.role, ROLE_LABELS[b.role] || b.role) || trCompare(a.name, b.name)],
    ],
    expenses: [
      ['dateDesc', 'Yeni', (a, b) => trCompare(b.expenseDate, a.expenseDate)],
      ['dueAsc', 'Vade', (a, b) => trCompare(a.dueDate, b.dueDate)],
      ['amountDesc', 'Tutar', (a, b) => n(b.amount) - n(a.amount)],
      ['title', 'A→Z', (a, b) => trCompare(a.title, b.title)],
    ],
  };
  SORT_OPTIONS.advisorExpenses = SORT_OPTIONS.expenses;
  const [listSorts, setListSorts] = useState({});
  const sortedOf = (key, list) => {
    const opts = SORT_OPTIONS[key] || [];
    const chosen = opts.find((o) => o[0] === listSorts[key]) || opts[0];
    return chosen ? [...(list || [])].sort(chosen[2]) : list || [];
  };
  const renderSortChips = (key) => {
    const opts = SORT_OPTIONS[key] || [];
    const active = listSorts[key] || (opts[0] && opts[0][0]);
    return (
      <ScrollView key={`sort-${key}`} horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8, flexGrow: 0 }}
        contentContainerStyle={{ alignItems: 'center' }}>
        <Text style={{ fontSize: 11, fontWeight: '700', color: '#94a3b8', marginRight: 6 }}>Sırala</Text>
        {opts.map(([id, label]) => (
          <TouchableOpacity
            key={id}
            onPress={() => { setListSorts((prev) => ({ ...prev, [key]: id })); setListPages((prev) => ({ ...prev, [key]: 1 })); }}
            style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, marginRight: 5,
              borderColor: active === id ? '#059669' : '#dbe7df', backgroundColor: active === id ? '#059669' : '#ffffff' }}
            activeOpacity={0.8}
          >
            <Text style={{ fontSize: 11.5, fontWeight: '800', color: active === id ? '#ffffff' : '#334155' }} numberOfLines={1}>{label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>
    );
  };

  // Liste sayfalama (web ile aynı mantık): her sayfada 10 kayıt, ‹ önceki · sayfa n/N · sonraki ›
  // Liste uzamaz; sayfa değişince ekran listenin başına döner.
  const [listPages, setListPages] = useState({});
  const mainScrollRef = React.useRef(null);
  const listPageInfo = (key, list) => {
    const total = (list || []).length;
    const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
    const page = Math.min(Math.max(1, listPages[key] || 1), totalPages);
    return { total, totalPages, page };
  };
  const pageOf = (key, list) => {
    const { page } = listPageInfo(key, list);
    return (list || []).slice((page - 1) * LIST_PAGE_SIZE, page * LIST_PAGE_SIZE);
  };
  const goPage = (key, page) => {
    setListPages((prev) => ({ ...prev, [key]: page }));
    try { mainScrollRef.current?.scrollTo({ y: 0, animated: true }); } catch (_) { /* yoksay */ }
  };
  const renderMore = (key, list) => {
    const { total, totalPages, page } = listPageInfo(key, list);
    if (totalPages <= 1) return null;
    const from = (page - 1) * LIST_PAGE_SIZE + 1;
    const to = Math.min(total, page * LIST_PAGE_SIZE);
    const btn = (label, target, disabled, a11y) => (
      <TouchableOpacity
        key={a11y}
        disabled={disabled}
        onPress={() => goPage(key, target)}
        accessibilityLabel={a11y}
        style={[styles.pagerBtn, disabled && styles.pagerBtnDisabled]}
        activeOpacity={0.8}
      >
        <Text style={[styles.pagerBtnTxt, disabled && { color: '#cbd5e1' }]}>{label}</Text>
      </TouchableOpacity>
    );
    return (
      <View key={`pager-${key}`} style={styles.pagerRow}>
        <Text style={styles.pagerInfo} numberOfLines={1}>{`${from}–${to} / ${total}`}</Text>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          {btn('«', 1, page === 1, 'İlk sayfa')}
          {btn('‹', page - 1, page === 1, 'Önceki sayfa')}
          <Text style={styles.pagerPage}>{`${page} / ${totalPages}`}</Text>
          {btn('›', page + 1, page === totalPages, 'Sonraki sayfa')}
          {btn('»', totalPages, page === totalPages, 'Son sayfa')}
        </View>
      </View>
    );
  };

  // Gider listeleri (Muhasebe ve Mali Müşavir) için ek filtreler: ödeme durumu, dönem, gider türü
  const [expFilterOpen, setExpFilterOpen] = useState({});
  const renderExpenseFilters = (key, baseList) => {
    const f = getExpFilter(key);
    const active = (f.payment !== 'all') + (f.period !== 'all') + (f.type !== 'all');
    const open = !!expFilterOpen[key];
    const periods = [...new Set((baseList || []).map((e) => e.period).filter(Boolean))].sort().reverse().slice(0, 6);
    const types = [...new Set((baseList || []).map((e) => e.subType).filter(Boolean))]
      .sort((a, b) => trCompare(getExpenseTypeLabel(a, currentLang) || a, getExpenseTypeLabel(b, currentLang) || b));
    const chip = (label, on, onPress, k) => (
      <TouchableOpacity key={k} onPress={onPress} activeOpacity={0.8} style={[styles.fChip, on && styles.fChipOn]}>
        <Text style={[styles.fChipTxt, on && styles.fChipTxtOn]} numberOfLines={1}>{label}</Text>
      </TouchableOpacity>
    );
    const row = (title, children) => (
      <View style={{ marginTop: 8 }}>
        <Text style={styles.fRowTitle}>{title}</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingRight: 8 }}>{children}</ScrollView>
      </View>
    );
    return (
      <View key={`filters-${key}`} style={styles.fBox}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <TouchableOpacity onPress={() => setExpFilterOpen((p) => ({ ...p, [key]: !open }))} activeOpacity={0.8} style={styles.fToggle}>
            <Text style={styles.fToggleTxt}>{`⚙︎ Filtrele${active ? ` · ${active}` : ''}  ${open ? '▲' : '▼'}`}</Text>
          </TouchableOpacity>
          {active > 0 && (
            <TouchableOpacity onPress={() => setExpFilter(key, { payment: 'all', period: 'all', type: 'all' })} activeOpacity={0.8}>
              <Text style={styles.fClear}>Temizle</Text>
            </TouchableOpacity>
          )}
        </View>
        {open && (
          <View>
            {row('Ödeme', [
              ['all', 'Tümü'], ['paid', 'Ödendi'], ['partial', 'Kısmi'], ['unpaid', 'Ödenmedi'],
            ].map(([id, label]) => chip(label, f.payment === id, () => setExpFilter(key, { payment: id }), `p-${id}`)))}
            {periods.length > 0 && row('Dönem', [
              chip('Tümü', f.period === 'all', () => setExpFilter(key, { period: 'all' }), 'per-all'),
              ...periods.map((pp) => chip(pp, f.period === pp, () => setExpFilter(key, { period: pp }), `per-${pp}`)),
            ])}
            {types.length > 0 && row('Gider türü', [
              chip('Tümü', f.type === 'all', () => setExpFilter(key, { type: 'all' }), 'ty-all'),
              ...types.map((ty) => chip(getExpenseTypeLabel(ty, currentLang) || ty, f.type === ty, () => setExpFilter(key, { type: ty }), `ty-${ty}`)),
            ])}
          </View>
        )}
      </View>
    );
  };

  // Oturum senkronu: yönetici rolü değiştirdiğinde ekran yeni role geçer; pasif hesap 401 ile çıkar
  const syncSession = async () => {
    const me = await apiFetchMe();
    if (!me) return;
    const role = normalizeRole(me.role);
    if (role !== normalizeRole(currentUser.role)) {
      const def = getDefaultScreen(me.screens);
      setCurrentUser((prev) => ({
        ...prev, role, name: me.name,
        permissions: Array.isArray(me.permissions) ? me.permissions : [],
        screens: Array.isArray(me.screens) ? me.screens : [],
      }));
      setCurrentScreen(def);
      setScreenStack([def]);
      setListPages({});
      setActiveChatChannel('general');
      showToast(`🔐 Yetkiniz güncellendi: ${ROLE_LABELS[role] || role}`);
    } else if (me.name && me.name !== currentUser.name) {
      setCurrentUser((prev) => ({ ...prev, name: me.name }));
    }
  };
  const syncSessionRef = React.useRef(syncSession);
  syncSessionRef.current = syncSession;
  React.useEffect(() => {
    const offStatus = mobileWebSocketService.onStatusChange((connected) => { if (connected) syncSessionRef.current(); });
    const offError = mobileWebSocketService.onServerError(() => syncSessionRef.current());
    const timer = setInterval(() => syncSessionRef.current(), 90000);
    return () => { offStatus(); offError(); clearInterval(timer); };
  }, []);

  // Yazma işlemleri sunucu sonucuna göre doğrulanır: başarısızsa hata gösterilir ve
  // ekrandaki iyimser değişiklik sunucudaki gerçek veriyle geri alınır.
  const guard = (fn) => async (...args) => {
    const res = await fn(...args);
    if (res && res.success === false) {
      showToast(`❌ ${res.message || 'İşlem reddedildi'}`);
      refreshAllData();
    }
    return res;
  };
  const apiReceiveStock = guard(raw_apiReceiveStock);
  const apiRecordWaste = guard(raw_apiRecordWaste);
  const apiUpdateUserRole = guard(raw_apiUpdateUserRole);
  const apiCreateUser = guard(raw_apiCreateUser);
  const apiDeleteUser = guard(raw_apiDeleteUser);
  const apiCreateRecipe = guard(raw_apiCreateRecipe);
  const apiUpdateRecipe = guard(raw_apiUpdateRecipe);
  const apiDeleteRecipe = guard(raw_apiDeleteRecipe);
  const apiSetRecipePrice = guard(raw_apiSetRecipePrice);
  const apiSetUserActive = guard(raw_apiSetUserActive);
  const apiResetUserPassword = guard(raw_apiResetUserPassword);
  const apiUpdateUserProfile = guard(raw_apiUpdateUserProfile);
  const apiVoidSale = guard(raw_apiVoidSale);
  const apiAdjustStock = guard(raw_apiAdjustStock);
  const apiCreateInventoryItem = guard(raw_apiCreateInventoryItem);
  const apiUpdateInventoryItem = guard(raw_apiUpdateInventoryItem);
  const apiDeleteInventoryItem = guard(raw_apiDeleteInventoryItem);
  const apiCreateExpense = guard(raw_apiCreateExpense);
  const apiUpdateExpense = guard(raw_apiUpdateExpense);
  const apiDeleteExpense = guard(raw_apiDeleteExpense);
  const apiApproveExpense = guard(raw_apiApproveExpense);
  const apiSubmitExpense = guard(raw_apiSubmitExpense);
  const apiFinalizeExpense = guard(raw_apiFinalizeExpense);
  const apiRejectExpense = guard(raw_apiRejectExpense);
  const apiSendChatMessage = guard(raw_apiSendChatMessage);
  const apiMarkNotificationRead = guard(raw_apiMarkNotificationRead);
  const apiMarkAllNotificationsRead = guard(raw_apiMarkAllNotificationsRead);


  const handleStockAction = async (isAdd) => {
    const qty = parseFloat(String(quantity).replace(',', '.'));
    if (!selectedItem || isNaN(qty) || qty <= 0) return;
    const targetItem = selectedItem;
    const res = isAdd
      ? await apiReceiveStock(targetItem.id, qty)
      : await apiRecordWaste(targetItem.id, qty, 'Mobil depo fire kaydı');
    if (res.success) {
      showToast(isAdd ? `✓ ${targetItem.name} +${qty} ${targetItem.unit} stoğa işlendi` : `⚠️ ${targetItem.name} -${qty} ${targetItem.unit} fire kaydedildi`);
      setQuantity('');
      setSelectedItem(null);
      setBarcodeInput('');
      refreshAllData();
    }
  };

  // Web Birebir: Sevkiyat Masasındaki Onaylı Siparişi Tek Dokunuşla Depoya Al & Stoğa Ekle
  const handleAutoReceiveDelivery = async (delivery) => {
    if (!delivery.inventoryItemId) return;
    // Mal kabul tedarik kaydına bağlanır: teslim alınan miktar sipariş kaydında izlenir
    const res = await apiReceiveStock(delivery.inventoryItemId, delivery.quantity, null, { expenseId: delivery.expenseId });
    if (res.success) {
      showToast(`✓ ${delivery.quantity} ${delivery.unit} "${delivery.itemName}" teslim alındı ve stoğa işlendi`);
      refreshAllData();
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
  // Reçete malzemesi stok kartına bağlanır: satışta stok bu karttan düşer, maliyet kartın fiyatından hesaplanır
  const ingredientItem = (ing) => (ing.itemId ? items.find((i) => i.id === ing.itemId) : null)
    || items.find((i) => i.name.trim().toLowerCase() === String(ing.name || '').trim().toLowerCase());
  const recipeDraftCost = (newRecipe.ingredients || []).reduce((sum, ing) => {
    const it = ingredientItem(ing);
    const q = parseFloat(String(ing.quantity || '').replace(',', '.')) || 0;
    return sum + (it ? q * (Number(it.price) || 0) : 0);
  }, 0);

  const handleSaveRecipe = async () => {
    const name = newRecipe.name.trim();
    const sale = parseFloat(String(newRecipe.salePrice || '').replace(',', '.'));
    if (!name || !(sale > 0)) {
      showToast('⚠️ Reçete adı ve fiyat zorunlu');
      return;
    }
    const rows = (newRecipe.ingredients || []).filter((ing) => String(ing.name || '').trim());
    if (rows.length === 0) {
      showToast('⚠️ En az bir malzeme ekleyin');
      return;
    }
    const ingredients = [];
    for (const ing of rows) {
      const it = ingredientItem(ing);
      if (!it) {
        showToast(`⚠️ "${ing.name.trim()}" stokta tanımlı değil — listeden seçin`);
        return;
      }
      const q = parseFloat(String(ing.quantity || '').replace(',', '.'));
      if (!(q > 0)) {
        showToast(`⚠️ "${it.name}" için miktar girin (${it.unit})`);
        return;
      }
      ingredients.push({ itemId: it.id, name: it.name, quantity: q, unit: it.unit });
    }
    const payload = { name, category: newRecipe.category || 'Ana Yemek', salePrice: sale, ingredients };
    const res = editingRecipe ? await apiUpdateRecipe(editingRecipe.id, payload) : await apiCreateRecipe(payload);
    if (!res || res.success === false) return; // guard hatayı gösterir
    setShowAddRecipeModal(false);
    setEditingRecipe(null);
    setIngFocusIdx(null);
    setNewRecipe({ name: '', category: 'Ana Yemek', salePrice: '', ingredients: [{ itemId: null, name: '', quantity: '', unit: '' }] });
    showToast(editingRecipe
      ? `✓ Reçete güncellendi: ${name}`
      : (can('MENU_PRICE_SET') ? `✓ Reçete eklendi: ${name}` : `✓ ${name} kaydedildi — Müdür fiyat onayı bekleniyor`));
    refreshAllData();
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
      showToast(`🗑️ "${name}" menüden kaldırıldı`);
      await apiDeleteRecipe(id);
      refreshAllData();
    } else if (type === 'user') {
      setUsers((prev) => prev.filter((u) => u.id !== id));
      showToast(`🗑️ "${name}" arşivlendi`);
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
    // Bildirim sunucuda üretilir: kayıt İşletme Müdürünün harcama onayına düşer
    const res = await apiCreateExpense(created);
    if (res && res.success !== false) {
      showToast(
        isPaid
          ? `✓ Gider kaydedildi (peşin ödendi); Müdür onayına iletildi: ${created.title}`
          : `⏳ Gider borç / vade olarak kaydedildi; Müdür onayına iletildi: ${created.title}`
      );
    }
    refreshAllData();
  };

  // Kasa / Muhasebe Borç Ödeme (Kasadan fiilen öde ve borcu kapat - Web ile birebir)
  const handlePayDebtNow = async (exp) => {
    if (exp.paymentStatus === 'PAID') {
      showToast('Bu gider kalemi zaten ödenmiş.');
      return;
    }
    // Kalan borcun tamamı kasadan ödenir; onaysız gider sunucu tarafından reddedilir
    const res = await apiUpdateExpense(exp.id, { paymentStatus: 'PAID', paymentMethod: 'CASH' });
    if (res.success) {
      showToast(`✓ "${exp.title}" için ödeme kaydedildi.`);
      refreshAllData();
    }
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
  // Muhasebe iş akışı: onay bekleyen → onayla; onaylanmış → faturalandır & gönder; reddedilen → tekrar onaya sun
  const handleSendToAdvisorMobile = async (exp) => {
    if (exp.status === 'PENDING_APPROVAL') {
      const res = await apiApproveExpense(exp.id);
      if (res.success) {
        showToast(`✓ Onaylandı: ${exp.title}`);
        refreshAllData();
      }
      return;
    }
    if (exp.status === 'REJECTED' || exp.status === 'NEEDS_CORRECTION') {
      const res = await apiUpdateExpense(exp.id, { status: 'PENDING_APPROVAL' });
      if (res.success) {
        showToast(`↺ "${exp.title}" tekrar onaya sunuldu.`);
        refreshAllData();
      }
      return;
    }
    if (exp.status === 'APPROVED' && !exp.sentToAdvisor) {
      setSubmitTargetMobile(exp);
      setSubmitInvoiceNo(exp.invoiceNumber || '');
      setSubmitCounterparty(exp.counterparty || '');
      setSubmitNote('');
    }
  };

  const handleConfirmSubmitMobile = async () => {
    const exp = submitTargetMobile;
    if (!exp) return;
    if (!submitInvoiceNo.trim() || !submitCounterparty.trim()) {
      showToast('Fatura/fiş numarası ve karşı taraf (tedarikçi) zorunludur');
      return;
    }
    const res = await apiSubmitExpense(exp.id, {
      invoiceNumber: submitInvoiceNo.trim(),
      counterparty: submitCounterparty.trim(),
      note: submitNote.trim() || undefined,
    });
    if (res.success) {
      setSubmitTargetMobile(null);
      showToast(`🚀 "${exp.title}" faturalandırıldı ve Mali Müşavire gönderildi.`);
      refreshAllData();
    }
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
      const remaining = Number(targetExp.remainingAmount ?? targetExp.amount) || 0;
      if (amountNum - remaining > 0.005) {
        showToast(`Ödeme tutarı kalan borcu (${remaining.toLocaleString('tr-TR')} ₺) aşamaz`);
        return;
      }
      const res = await apiUpdateExpense(targetExp.id, {
        paymentStatus: amountNum >= remaining ? 'PAID' : 'PARTIAL',
        paymentAmount: amountNum,
        paymentMethod: 'CASH',
        paymentNote: cashAllocationNote.trim() || cashPaymentSource,
      });
      if (!res.success) return;
      showToast(`✓ Ödendi: ${amountNum.toLocaleString('tr-TR')} ₺`);
    } else {
      if (!customExpenseTitle.trim()) {
        showToast('Lütfen ödeme başlığı giriniz');
        return;
      }
      // Doğrudan kasa çıkışı: peşin ödenmiş gider olarak kaydedilir ve onaya düşer.
      // Belge numarası UYDURULMAZ; fatura/fiş no girilene kadar Mali Müşavir deftere işleyemez.
      const res = await apiCreateExpense({
        title: customExpenseTitle.trim(),
        category: customExpenseCategory,
        subType: customExpenseSubType,
        amount: amountNum,
        expenseDate: new Date().toISOString().split('T')[0],
        counterparty: 'Doğrudan Kasa Çıkışı',
        paymentStatus: 'PAID',
        paymentMethod: 'CASH',
        note: cashAllocationNote.trim() || `Kasadan doğrudan ödendi (${cashPaymentSource})`,
      });
      if (!res.success) return;
      showToast(`✓ Kasa çıkışı onaya sunuldu: ${amountNum.toLocaleString('tr-TR')} ₺`);
    }

    setShowCashAllocationModal(false);
    setCashAllocationAmount('');
    setSelectedTargetExpenseId('');
    setCustomExpenseTitle('');
    setCashAllocationNote('');
    refreshAllData();
  };

  // Mali Müşavir Onaylama İşlemi (Approve & Record -> FINALIZED - Web ile birebir)
  // Mali Müşavir (veya Yönetici) onayı: gönderilen belgeyi resmi deftere işler
  const handleApproveExpenseLedger = async (exp) => {
    const res = await apiFinalizeExpense(exp.id);
    if (res.success) {
      showToast(`✓ "${exp.title}" onaylandı ve resmi deftere işlendi.`);
      refreshAllData();
    }
  };

  // Mali Müşavir Ret Modalı Açma
  const handleOpenRejectModal = (exp) => {
    setExpenseToRejectMobile(exp);
    setMobileRejectReason(exp.rejectionReason || '');
  };

  // Gerekçeli ret (gerekçe en az 10 karakter; sunucu kuralları uygular ve muhasebeye bildirir)
  const handleConfirmRejectExpense = async () => {
    if (!expenseToRejectMobile) return;
    const reason = mobileRejectReason.trim();
    if (reason.length < 10) {
      showToast('Ret gerekçesi en az 10 karakter olmalı');
      return;
    }
    const exp = expenseToRejectMobile;
    const res = await apiRejectExpense(exp.id, reason);
    if (res.success) {
      setExpenseToRejectMobile(null);
      setMobileRejectReason('');
      showToast(`⚠️ "${exp.title}" gerekçeli olarak reddedildi; muhasebeye bildirildi.`);
      refreshAllData();
    }
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
    const pw = newUser.password || '';
    if (pw.length < 8 || !/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(pw) || !/\d/.test(pw)) {
      showToast('Geçici şifre en az 8 karakter olmalı, harf ve rakam içermelidir');
      return;
    }
    const initials = newUser.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase();
    const created = {
      id: Date.now(),
      name: newUser.name,
      username: newUser.username.trim().toLowerCase(),
      email: newUser.email || undefined,
      role: newUser.role,
      avatar: initials,
      password: pw,
    };
    setShowAddUserModal(false);
    setNewUser({ name: '', username: '', email: '', role: ROLES.CHEF, password: '' });

    // Kullanıcı ilk girişte geçici şifresini kendi şifresiyle değiştirmek zorundadır
    const res = await apiCreateUser(created);
    if (res.success) refreshAllData();
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

  // Ekran görünürlüğü sunucunun verdiği ekran listesinden; düğmeler izin listesinden (can) belirlenir
  const canViewDashboard = allowedScreens.includes('dashboard');
  const canViewSales = allowedScreens.includes('sales');
  const canViewFinancials = canViewDashboard;
  const canViewCashier = allowedScreens.includes('cashier');
  const canViewAdvisor = allowedScreens.includes('advisor');
  const canViewAccounting = canViewCashier;
  const canViewUsers = allowedScreens.includes('users');
  const canViewRecipes = allowedScreens.includes('recipes');
  const canViewInventory = allowedScreens.includes('inventory');
  const canViewWarehouse = allowedScreens.includes('warehouse');

  // Samsung, Xiaomi, Pixel vb. telefonların alt navigasyon tuşları için dinamik boşluk
  const androidBottomPadding = Math.max(insets.bottom, 16);

  // Alt menü: rolün ekranları sunucu sırasıyla (ilk ekran = rolün ana işi)
  const navLabels = NAV_LABELS[currentLang] || NAV_LABELS.tr;
  const navLabel = (id) => (id === 'cashier' && !can('EXPENSE_CREATE') && can('EXPENSE_APPROVE') ? navLabels.approvals : navLabels[id] || id);
  const navPrimary = allowedScreens.length > MAX_NAV_TABS ? allowedScreens.slice(0, MAX_NAV_TABS - 1) : allowedScreens;
  const navOverflow = allowedScreens.length > MAX_NAV_TABS ? allowedScreens.slice(MAX_NAV_TABS - 1) : [];
  const showBottomNav = allowedScreens.length > 1;
  // Üst çubukta "Geri": alt menü dışındaki ekranlarda veya açık bir seçim varken (ana sekmelerde logo görünür)
  const showBackBtn = Boolean((screenStack.length > 1 && !(showBottomNav && navPrimary.includes(currentScreen))) || selectedItem || cameraActive);
  const pendingExpenseApprovals = can('EXPENSE_APPROVE') ? expenses.filter((e) => e.status === 'PENDING_APPROVAL').length : 0;
  const pendingPriceApprovals = can('MENU_PRICE_SET') ? recipes.filter((r) => r.priceApproved === false).length : 0;
  const navBadge = (id) => (id === 'cashier' ? pendingExpenseApprovals : id === 'recipes' ? pendingPriceApprovals : 0);

  // Gider iş akışı durumu (tek rozet): Müdür onayı → ödeme / faturalandırma → Mali Müşavir → defter
  const expenseFlow = (exp) => {
    const finalized = exp.status === 'FINALIZED' || Boolean(exp.recordedInLedger);
    if (finalized) return { label: 'Deftere işlendi', bg: '#ecfdf5', border: '#a7f3d0', color: '#047857' };
    if (exp.status === 'NEEDS_CORRECTION' || exp.status === 'REJECTED') return { label: 'Düzeltme istendi', bg: '#fef2f2', border: '#fecaca', color: '#b91c1c' };
    if (exp.status === 'PENDING_APPROVAL') return { label: 'Müdür onayında', bg: '#fffbeb', border: '#fde68a', color: '#b45309' };
    if (exp.status === 'APPROVED' && exp.sentToAdvisor) return { label: 'Müşavirde', bg: '#eff6ff', border: '#bfdbfe', color: '#1d4ed8' };
    if (exp.status === 'APPROVED') return { label: 'Onaylandı', bg: '#f0fdf4', border: '#bbf7d0', color: '#15803d' };
    return { label: exp.status || '-', bg: '#f1f5f9', border: '#e2e8f0', color: '#475569' };
  };
  const advisorQueueCount = expenses.filter((e) => e.status === 'APPROVED' && Boolean(e.sentToAdvisor) && !e.recordedInLedger).length;

  // Muhasebe / Onaylar ekranı: rol bazlı özet ve filtreler
  const fmtTL = (v) => `${Math.round(Number(v) || 0).toLocaleString('tr-TR')} ₺`;
  const countExp = (fn) => expenses.filter(fn).length;
  const isRejectedExp = (e) => e.status === 'NEEDS_CORRECTION' || e.status === 'REJECTED';
  const pendingApprovalAmount = expenses.filter((e) => e.status === 'PENDING_APPROVAL').reduce((sum, e) => sum + (parseFloat(e.amount) || 0), 0);
  const hasCashSection = can('CASH_CLOSING_VIEW') || can('CASH_REPORT_VIEW');
  const acctStats = can('EXPENSE_CREATE') ? [
    { k: 'rev', label: 'Bugünkü ciro', value: fmtTL(totalRevenue), color: '#047857' },
    { k: 'debt', label: 'Ödenecek', value: fmtTL(totalDebtAmount), color: '#b91c1c' },
    { k: 'net', label: 'Dönem net', value: fmtTL(netOperatingProfit), color: netOperatingProfit >= 0 ? '#047857' : '#b91c1c' },
  ] : can('EXPENSE_APPROVE') ? [
    { k: 'cnt', label: 'Onay bekleyen', value: String(pendingExpenseApprovals), color: '#b45309' },
    { k: 'amt', label: 'Bekleyen tutar', value: fmtTL(pendingApprovalAmount) },
    { k: 'rej', label: 'Reddedilen', value: String(totalRejectedCount) },
  ] : [
    { k: 'opex', label: 'Toplam gider', value: fmtTL(totalOperatingExpenses) },
    { k: 'debt', label: 'Ödenmemiş', value: fmtTL(totalDebtAmount), color: '#b91c1c' },
    { k: 'cnt', label: 'Onay bekleyen', value: String(countExp((e) => e.status === 'PENDING_APPROVAL')) },
  ];
  const expenseFilters = can('EXPENSE_CREATE') ? [
    ['pending_approval', 'İşlemde', countExp((e) => e.status === 'PENDING_APPROVAL' || (e.status === 'APPROVED' && !e.sentToAdvisor))],
    ['to_pay', 'Ödenecek', countExp((e) => e.status === 'APPROVED' && !e.paidByCashier)],
    ['rejected', 'Düzeltme', countExp(isRejectedExp)],
    ['ledger', 'Deftere işlenen', countExp((e) => Boolean(e.recordedInLedger) || e.status === 'FINALIZED')],
    ['all', 'Tümü', expenses.length],
  ] : can('EXPENSE_APPROVE') ? [
    ['approve', 'Onay bekleyen', pendingExpenseApprovals],
    ['rejected', 'Reddedilen', countExp(isRejectedExp)],
    ['all', 'Tümü', expenses.length],
  ] : [
    ['all', 'Tümü', expenses.length],
    ['debt', 'Ödenmemiş', countExp((e) => !e.paidByCashier)],
    ['at_advisor', 'Müşavirde', countExp((e) => e.status === 'APPROVED' && Boolean(e.sentToAdvisor) && !e.recordedInLedger)],
    ['rejected', 'Reddedilen', countExp(isRejectedExp)],
  ];

  // Panodaki "Bekleyen İşler": yalnızca bu rolün sorumlu olduğu işler
  const dashboardTasks = [
    pendingExpenseApprovals > 0 && { key: 'exp', icon: '🧾', label: 'Harcama onayı bekliyor', count: pendingExpenseApprovals, screen: 'cashier', tone: 'warn' },
    pendingPriceApprovals > 0 && allowedScreens.includes('recipes') && { key: 'price', icon: '🏷️', label: 'Fiyat onayı bekleyen reçete', count: pendingPriceApprovals, screen: 'recipes', tone: 'warn' },
    can('INVENTORY_VIEW') && criticalStockCount > 0 && allowedScreens.includes('inventory') && { key: 'stock', icon: '📦', label: 'Kritik stok', count: criticalStockCount, screen: 'inventory', tone: 'warn' },
    can('USER_MANAGE') && allowedScreens.includes('users') && { key: 'users', icon: '👥', label: 'Aktif personel', count: users.filter((u) => u.active !== false).length, screen: 'users' },
  ].filter(Boolean);

  // ── Sabit liste çubuğu (arama · filtre · sıralama · sayfa bilgisi) ──
  // Ana kaydırma alanının ilk çocuğu olarak verilir; kaydırırken üstte opak biçimde sabit kalır.
  const pageInfo = (key, total) => {
    const totalPages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
    const page = Math.min(listPages[key] || 1, totalPages);
    return <Text style={styles.stickyCount}>{total === 0 ? '0 kayıt' : totalPages > 1 ? `${total} kayıt · ${page}/${totalPages}` : `${total} kayıt`}</Text>;
  };
  const listToolbar = (() => {
    if (currentScreen === 'inventory' && canViewInventory) {
      return (
        <View style={styles.stickyBar}>
          <TextInput style={[styles.webSearchInput, { marginBottom: 8 }]} placeholder="🔍 Ürün veya barkod ara"
            placeholderTextColor={THEME.colors.textLight} value={inventorySearch} onChangeText={setInventorySearch} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 6, flexGrow: 0 }} keyboardShouldPersistTaps="handled">
            {inventoryCategories.map((c) => (
              <TouchableOpacity key={c} style={[styles.webChipBtn, inventoryCategory === c && styles.webChipBtnActive]} onPress={() => setInventoryCategory(c)}>
                <Text style={[styles.webChipTxt, inventoryCategory === c && styles.webChipTxtActive]} numberOfLines={1}>
                  {c === 'all' ? 'Tümü' : getCategoryLabel(c, currentLang)}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <View style={styles.stickyRow}>
            <View style={{ flex: 1 }}>{renderSortChips('inventory')}</View>
            {pageInfo('inventory', filteredItems.length)}
          </View>
        </View>
      );
    }
    if (currentScreen === 'recipes' && canViewRecipes) {
      return (
        <View style={styles.stickyBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TextInput style={[styles.webSearchInput, { flex: 1 }]} placeholder="🔍 Reçete ara"
              placeholderTextColor={THEME.colors.textLight} value={recipeSearch} onChangeText={setRecipeSearch} />
            {can('RECIPE_EDIT') && (
              <TouchableOpacity style={[styles.webBtnPrimary, { flexShrink: 0 }]} activeOpacity={0.8}
                onPress={() => { setEditingRecipe(null); setNewRecipe({ name: '', category: 'Ana Yemek', salePrice: '', ingredients: [{ itemId: null, name: '', quantity: '', unit: '' }] }); setIngFocusIdx(0); setShowAddRecipeModal(true); }}>
                <Text style={styles.webBtnPrimaryTxt} numberOfLines={1}>+ Yeni</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.stickyRow}>
            <View style={{ flex: 1 }}>{renderSortChips('recipes')}</View>
            {pageInfo('recipes', filteredRecipes.length)}
          </View>
        </View>
      );
    }
    if (currentScreen === 'users' && canViewUsers) {
      return (
        <View style={styles.stickyBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <TextInput style={[styles.webSearchInput, { flex: 1 }]} placeholder="🔍 Ad, kullanıcı adı veya e-posta"
              placeholderTextColor={THEME.colors.textLight} value={usersSearch} onChangeText={setUsersSearch} />
            {can('USER_MANAGE') && (
              <TouchableOpacity style={[styles.webBtnPrimary, { flexShrink: 0 }]} onPress={() => setShowAddUserModal(true)} activeOpacity={0.8}>
                <Text style={styles.webBtnPrimaryTxt} numberOfLines={1}>+ Personel</Text>
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.stickyRow}>
            <View style={{ flex: 1 }}>{renderSortChips('users')}</View>
            {pageInfo('users', filteredUsers.length)}
          </View>
        </View>
      );
    }
    if (currentScreen === 'sales' && canViewSales) {
      return (
        <View style={styles.stickyBar}>
          <View style={{ flexDirection: 'row', backgroundColor: '#eef6f0', padding: 3, borderRadius: 10, marginBottom: 8 }}>
            {[['product', 'Ürünler'], ['timeline', `Saat saat · ${salesItemsToProcess.length}`]].map(([id, label]) => (
              <TouchableOpacity key={id} onPress={() => setSalesActiveTab(id)}
                style={{ flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center', backgroundColor: salesActiveTab === id ? '#ffffff' : 'transparent', elevation: salesActiveTab === id ? 1 : 0 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: salesActiveTab === id ? '#0a1f11' : '#64748b' }} numberOfLines={1}>{label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TextInput style={[styles.webSearchInput, { marginBottom: 8 }]} placeholder={salesActiveTab === 'product' ? '🔍 Yemek ara' : '🔍 Yemek veya saat ara'}
            placeholderTextColor={THEME.colors.textLight} value={salesSearchQuery} onChangeText={setSalesSearchQuery} />
          <View style={styles.stickyRow}>
            <View style={{ flex: 1, flexDirection: 'row' }}>
              {[['all', 'Tümü', null], ['high_profit', 'FC < %30', '#059669'], ['high_cost', 'FC ≥ %40', '#dc2626']].map(([id, label, color]) => (
                <TouchableOpacity key={id}
                  style={[styles.webChipBtn, salesProfitFilter === id && (color ? { backgroundColor: color, borderColor: color } : styles.webChipBtnActive)]}
                  onPress={() => setSalesProfitFilter(id)}>
                  <Text style={[styles.webChipTxt, salesProfitFilter === id && { color: '#ffffff', fontWeight: '800' }]} numberOfLines={1}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            {salesActiveTab === 'timeline'
              ? pageInfo('salesTimeline', filteredTimelineSales.length)
              : <Text style={styles.stickyCount}>{sortedSalesByRevenue.length} ürün</Text>}
          </View>
        </View>
      );
    }
    return null;
  })();

  return (
    <View style={styles.container}>
      {/* Sleek Minimalist Top App Bar (Status bar çakışmasını önleyen dinamik insets) */}
      <View style={[styles.topAppBar, { paddingTop: Math.max(insets.top, 8), height: 54 + Math.max(insets.top, 8) }]}>
        <View style={styles.brandRow}>
          {showBackBtn ? (
            <TouchableOpacity style={styles.androidBackBtn} onPress={handleGoBack} activeOpacity={0.7}>
              <Text style={styles.androidBackArrow}>←</Text>
              <Text style={styles.androidBackLabel}>{t.goBack || 'Geri'}</Text>
            </TouchableOpacity>
          ) : (
            <Image
              source={require('../../assets/logo.png')}
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
            {showBackBtn ? '' : (t.appName || 'GastroSync')}
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
            {totalChatUnread > 0 && (
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
                  {totalChatUnread > 99 ? '99+' : totalChatUnread}
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
        <View pointerEvents="none" style={[styles.snackBar, { bottom: (showBottomNav ? 70 : 12) + androidBottomPadding }]}>
          <Text style={styles.snackText} numberOfLines={3}>{toastMessage}</Text>
        </View>
      ) : null}

      {/* İçerik Alanı - Android Alt Tuşlarına Çarpmaması İçin Dinamik Güvenli Padding */}
      <ScrollView
        ref={mainScrollRef}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: (showBottomNav ? 76 : 16) + androidBottomPadding }
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        stickyHeaderIndices={listToolbar ? [0] : undefined}
      >
        {listToolbar}
        {/* MASALAR & KASA (Kasiyer: adisyon, sipariş, tahsilat, gün sonu · Müdür: izleme, iptal onayı) */}
        {currentScreen === 'pos' && allowedScreens.includes('pos') && (
          <PosScreen can={can} showToast={notify} />
        )}

        {/* MUTFAK EKRANI (Şef: hazırlama durumu · Müdür: izleme) */}
        {currentScreen === 'kitchen' && allowedScreens.includes('kitchen') && (
          <KitchenScreen can={can} showToast={notify} />
        )}

        {/* 1. EKRAN: FİNANSAL ÖZET (Dashboard - Web ile Birebir) */}
        {currentScreen === 'dashboard' && canViewFinancials && (
          <View>
            <Text style={styles.dashHello} numberOfLines={1}>
              Merhaba, {String(currentUser.name || '').split(' ')[0] || ROLE_LABELS[currentRole]}
            </Text>
            <Text style={styles.dashSub} numberOfLines={1}>
              {new Date().toLocaleDateString(({ tr: 'tr-TR', en: 'en-GB', de: 'de-DE', ar: 'ar' })[currentLang] || 'tr-TR', { day: 'numeric', month: 'long', weekday: 'long' })} · {ROLE_LABELS[currentRole]}
            </Text>

            {/* Bekleyen işler: yalnızca bu rolün yapacağı işler, dokununca ilgili ekrana gider */}
            {dashboardTasks.length > 0 && (
              <View style={styles.dashCard}>
                <Text style={styles.dashCardTitle}>Bekleyen İşler</Text>
                {dashboardTasks.map((task, i) => (
                  <TouchableOpacity
                    key={task.key}
                    style={[styles.dashTaskRow, i > 0 && styles.dashRowBorder]}
                    onPress={() => {
                      // İlgili liste, işi öne alan sıralamayla açılır
                      const focusSort = { price: ['recipes', 'pending'], stock: ['inventory', 'critical'] }[task.key];
                      if (focusSort) {
                        setListSorts((prev) => ({ ...prev, [focusSort[0]]: focusSort[1] }));
                        setListPages((prev) => ({ ...prev, [focusSort[0]]: 1 }));
                      }
                      navigateTo(task.screen);
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={styles.dashTaskIcon}>{task.icon}</Text>
                    <Text style={styles.dashTaskLabel} numberOfLines={2}>{task.label}</Text>
                    <View style={[styles.dashCount, task.tone === 'warn' && styles.dashCountWarn]}>
                      <Text style={[styles.dashCountTxt, task.tone === 'warn' && styles.dashCountTxtWarn]}>{task.count}</Text>
                    </View>
                    <Text style={styles.dashChevron}>›</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Temel göstergeler (kısa etiketler) */}
            <View style={styles.dashKpiGrid}>
              {[
                { k: 'rev', label: 'Bugünkü ciro', value: `${Math.round(salesSummary.totalRevenue || 0).toLocaleString('tr-TR')} ₺`, hint: `${salesSummary.orderCount || 0} adisyon` },
                {
                  k: 'fc',
                  label: 'Food cost',
                  value: `%${parseFloat(salesSummary.foodCostPercent || 0).toFixed(1)}`,
                  hint: `Hedef %${Number(salesSummary.targetFoodCost || 30).toFixed(0)}`,
                  warn: Number(salesSummary.foodCostPercent || 0) > Number(salesSummary.targetFoodCost || 30),
                },
                { k: 'cost', label: 'Gıda maliyeti', value: `${Math.round(salesSummary.totalCost || 0).toLocaleString('tr-TR')} ₺`, hint: 'Bugün' },
                { k: 'opex', label: 'Genel gider', value: `${Math.round(totalOperatingExpenses).toLocaleString('tr-TR')} ₺`, hint: 'Kayıtlı toplam' },
              ].map((m) => (
                <View key={m.k} style={styles.dashKpi}>
                  <Text style={styles.dashKpiLabel} numberOfLines={2}>{m.label}</Text>
                  <Text style={[styles.dashKpiValue, m.warn && { color: '#b45309' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                    {m.value}
                  </Text>
                  <Text style={styles.dashKpiHint} numberOfLines={1}>{m.hint}</Text>
                </View>
              ))}
            </View>

            {/* Fiyat uyarıları: ilk 3, istenirse tümü */}
            {menuPricing && (menuPricing.alerts || []).length > 0 && (
              <View style={styles.dashCard}>
                <View style={styles.dashCardHead}>
                  <Text style={styles.dashCardTitle}>Fiyat Uyarıları</Text>
                  <Text style={styles.dashCardMeta}>{menuPricing.alerts.length}</Text>
                </View>
                {menuPricing.alerts.slice(0, showAllAlerts ? 15 : 3).map((a, i) => (
                  <View key={`pa-${i}`} style={[styles.dashAlertRow, i > 0 && styles.dashRowBorder]}>
                    <View style={[styles.dashDot, { backgroundColor: a.severity === 'CRITICAL' ? '#dc2626' : a.severity === 'WARNING' ? '#f59e0b' : '#3b82f6' }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.dashAlertTitle} numberOfLines={1}>{a.title}</Text>
                      <Text style={styles.dashAlertMsg} numberOfLines={2}>{a.message}</Text>
                    </View>
                  </View>
                ))}
                {menuPricing.alerts.length > 3 && (
                  <TouchableOpacity onPress={() => setShowAllAlerts((v) => !v)} style={styles.dashMoreBtn} activeOpacity={0.75}>
                    <Text style={styles.dashMoreTxt}>{showAllAlerts ? 'Daha az göster' : `Tümünü göster (${menuPricing.alerts.length})`}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {/* 2. EKRAN: STOK YÖNETİMİ (Inventory - Web ile Birebir) */}
        {currentScreen === 'inventory' && canViewInventory && (
          <View>
            {/* Tek satır özet: ürün · kritik (dokun → kritikler önce) · değer */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <View style={[styles.webMiniStatCard, { flex: 1, paddingVertical: 8 }]}>
                <Text style={[styles.webMiniStatVal, { fontSize: 16 }]}>{items.length}</Text>
                <Text style={styles.webMiniStatLbl} numberOfLines={1}>Ürün</Text>
              </View>
              <TouchableOpacity
                style={[styles.webMiniStatCard, { flex: 1, paddingVertical: 8, borderColor: criticalStockCount > 0 ? '#fecaca' : '#dbe7df' }]}
                activeOpacity={0.8}
                onPress={() => { setListSorts((prev) => ({ ...prev, inventory: 'critical' })); setListPages((prev) => ({ ...prev, inventory: 1 })); }}
              >
                <Text style={[styles.webMiniStatVal, { fontSize: 16, color: criticalStockCount > 0 ? '#dc2626' : '#047857' }]}>{criticalStockCount}</Text>
                <Text style={styles.webMiniStatLbl} numberOfLines={1}>Kritik</Text>
              </TouchableOpacity>
              <View style={[styles.webMiniStatCard, { flex: 1.6, paddingVertical: 8 }]}>
                <Text style={[styles.webMiniStatVal, { fontSize: 14, color: '#047857' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {Math.round(totalInventoryValue).toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMiniStatLbl} numberOfLines={1}>Stok değeri</Text>
              </View>
            </View>

            {[...pageOf('inventory', sortedOf('inventory', filteredItems)).map((it) => {
              const isAlert = it.stock <= it.min;
              const unit = getUnitLabel(it.unit, currentLang);
              return (
                <TouchableOpacity
                  key={it.id}
                  style={[styles.webItemCard, { padding: 12 }, isAlert && styles.webItemCardAlert]}
                  onPress={() => setSelectedItem(it)}
                  activeOpacity={0.8}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={[styles.webItemName, { marginBottom: 2 }]} numberOfLines={1}>{getItemName(it.name, currentLang)}</Text>
                      <Text style={{ fontSize: 11.5, color: '#64748b' }} numberOfLines={1}>
                        {getCategoryLabel(it.cat, currentLang) || 'Genel'} · Min {it.min} {unit} · {it.price.toFixed(2)} ₺
                      </Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 16, fontWeight: '900', color: isAlert ? '#dc2626' : '#0a1f11' }} numberOfLines={1}>
                        {it.stock} <Text style={{ fontSize: 12, fontWeight: '700' }}>{unit}</Text>
                      </Text>
                      {isAlert && <Text style={{ fontSize: 10.5, fontWeight: '800', color: '#dc2626' }}>⚠️ Kritik</Text>}
                    </View>
                    {can('PURCHASE_REQUEST') && (
                      <TouchableOpacity
                        style={{ marginLeft: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' }}
                        onPress={() => {
                          setOrderModalItem(it);
                          setOrderQuantity('15');
                          setOrderNote('');
                          setOrderUrgent(isAlert);
                        }}
                        activeOpacity={0.8}
                      >
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#047857' }}>🛒 Talep</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
              );
            }), renderMore('inventory', filteredItems)]}
          </View>
        )}

        {/* 3. EKRAN: REÇETE MERKEZİ (Recipes - Web ile Birebir) */}
        {currentScreen === 'recipes' && canViewRecipes && (
          <View>
            {/* Müdür: fiyat onayı bekleyen reçeteler (kasada satışa kapalı) */}
            {can('MENU_PRICE_SET') && recipes.some((r) => r.priceApproved === false) && (
              <TouchableOpacity
                onPress={() => { setListSorts((prev) => ({ ...prev, recipes: 'pending' })); setListPages((prev) => ({ ...prev, recipes: 1 })); }}
                activeOpacity={0.8}
                style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#fffbeb', borderWidth: 1, borderColor: '#fde68a', borderRadius: 12, padding: 10, marginBottom: 10 }}
              >
                <Text style={{ flex: 1, fontSize: 12.5, fontWeight: '800', color: '#92400e' }} numberOfLines={1}>
                  {recipes.filter((r) => r.priceApproved === false).length} reçete fiyat onayı bekliyor
                </Text>
                <Text style={{ fontSize: 12, fontWeight: '800', color: '#b45309' }}>Göster ›</Text>
              </TouchableOpacity>
            )}

            {[...pageOf('recipes', sortedOf('recipes', filteredRecipes)).map((r) => {
              const profit = r.salePrice - r.cost;
              const open = openRecipeId === r.id;
              const pending = r.priceApproved === false;
              const fcHigh = r.foodCostPercent >= 30;
              return (
                <View key={r.id} style={[styles.webRecipeCard, { padding: 12 }, pending && { borderColor: '#fde68a' }]}>
                  <TouchableOpacity activeOpacity={0.7} onPress={() => setOpenRecipeId(open ? null : r.id)}>
                    <View style={[styles.webRecipeTopRow, { marginBottom: 8 }]}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.webRecipeCategory} numberOfLines={1}>
                          {getCategoryLabel(r.category, currentLang)}{pending ? '  ·  ' : ''}
                          {pending && <Text style={{ color: '#b45309' }}>Fiyat onayı bekliyor</Text>}
                        </Text>
                        <Text style={styles.webRecipeTitle} numberOfLines={2}>{getRecipeName(r.name, currentLang)}</Text>
                      </View>
                      <View style={[styles.webFcBadge, fcHigh ? styles.webFcBadgeDanger : styles.webFcBadgeGood]}>
                        <Text style={[styles.webFcBadgeTxt, fcHigh ? styles.webFcBadgeTxtDanger : styles.webFcBadgeTxtGood]} numberOfLines={1}>
                          FC %{r.foodCostPercent > 999 ? '999+' : r.foodCostPercent.toFixed(0)}
                        </Text>
                      </View>
                    </View>

                    <View style={[styles.webRecipeStatsRow, { marginBottom: 0, paddingVertical: 8 }]}>
                      <View style={styles.webRecipeStatCol}>
                        <Text style={styles.webRecipeStatLbl}>Maliyet</Text>
                        <Text style={styles.webRecipeStatVal} numberOfLines={1}>{r.cost.toFixed(2)} ₺</Text>
                      </View>
                      <View style={styles.webRecipeStatCol}>
                        <Text style={styles.webRecipeStatLbl}>Satış</Text>
                        <Text style={[styles.webRecipeStatVal, { fontWeight: '900', color: THEME.colors.primary }]} numberOfLines={1}>
                          {r.salePrice.toFixed(2)} ₺
                        </Text>
                      </View>
                      <View style={styles.webRecipeStatCol}>
                        <Text style={styles.webRecipeStatLbl}>Kâr</Text>
                        <Text style={[styles.webRecipeStatVal, { color: profit >= 0 ? '#047857' : '#b91c1c' }]} numberOfLines={1}>
                          {profit >= 0 ? '+' : ''}{profit.toFixed(2)} ₺
                        </Text>
                      </View>
                    </View>
                    <Text style={{ fontSize: 11.5, fontWeight: '700', color: '#64748b', marginTop: 8 }}>
                      {open ? '▾' : '▸'} Malzemeler ({r.ingredients.length})
                    </Text>
                  </TouchableOpacity>

                  {open && (
                    <View style={[styles.webRecipeIngBox, { marginTop: 6 }]}>
                      {r.ingredients.map((ing, idx) => (
                        <View key={idx} style={styles.webRecipeIngLine}>
                          <Text style={[styles.webRecipeIngName, { flex: 1, marginRight: 8 }]} numberOfLines={1}>• {getItemName(ing.name, currentLang)}</Text>
                          <Text style={styles.webRecipeIngAmount}>{formatIngredientAmount(ing.amount, currentLang)}</Text>
                        </View>
                      ))}
                    </View>
                  )}

                  {(open || pending) && (can('RECIPE_EDIT') || can('MENU_PRICE_SET')) && (
                  <View style={styles.webRecipeActionRow}>
                    {can('MENU_PRICE_SET') && (
                    <TouchableOpacity
                      style={[styles.webRecipeEditBtn, pending && { backgroundColor: '#059669', borderColor: '#059669' }]}
                      onPress={() => { setPriceTarget(r); setPriceInput(String(r.salePrice || '')); setPriceReason(''); }}
                      activeOpacity={0.7}
                    >
                      <Text style={[styles.webRecipeEditTxt, pending && { color: '#ffffff' }]}>{pending ? '✓ Fiyatı Onayla' : '₺ Fiyat'}</Text>
                    </TouchableOpacity>
                    )}
                    {can('RECIPE_EDIT') && (
                    <TouchableOpacity
                      style={styles.webRecipeEditBtn}
                      onPress={() => {
                        setEditingRecipe(r);
                        setNewRecipe({
                          name: r.name,
                          category: r.category,
                          salePrice: String(r.salePrice),
                          ingredients: (r.ingredients && r.ingredients.length > 0)
                            ? r.ingredients.map((ing) => ({ itemId: ing.itemId || null, name: ing.name || '', quantity: ing.quantity ? String(ing.quantity) : '', unit: ing.unit || '' }))
                            : [{ itemId: null, name: '', quantity: '', unit: '' }],
                        });
                        setShowAddRecipeModal(true);
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.webRecipeEditTxt}>✏️ Düzenle</Text>
                    </TouchableOpacity>
                    )}
                    {can('MENU_PRICE_SET') && open && (
                    <TouchableOpacity
                      style={styles.webRecipeDeleteBtn}
                      onPress={() => {
                        setItemToDelete({
                          type: 'recipe',
                          id: r.id,
                          name: r.name,
                          details: `"${r.name}" menüden kaldırılacak (arşivlenir).`,
                        });
                      }}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.webRecipeDeleteTxt}>🗑️ Kaldır</Text>
                    </TouchableOpacity>
                    )}
                  </View>
                  )}
                </View>
              );
            }), renderMore('recipes', filteredRecipes)]}
          </View>
        )}

        {/* 4. EKRAN: SATIŞ ANALİZİ (Sales - Web ile Birebir) */}
        {currentScreen === 'sales' && canViewSales && (
          <View>
            {/* Bugün: ciro (KDV dahil) · net kâr (KDV hariç) · food cost — sunucu özetinden */}
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <View style={[styles.webMiniStatCard, { flex: 1, paddingVertical: 8 }]}>
                <Text style={[styles.webMiniStatVal, { fontSize: 15, color: THEME.colors.primary }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {Math.round(salesSummary.totalRevenue || 0).toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMiniStatLbl} numberOfLines={1}>Ciro</Text>
              </View>
              <View style={[styles.webMiniStatCard, { flex: 1, paddingVertical: 8 }]}>
                <Text style={[styles.webMiniStatVal, { fontSize: 15, color: (salesSummary.netProfit || 0) >= 0 ? '#047857' : '#b91c1c' }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
                  {Math.round(salesSummary.netProfit || 0).toLocaleString('tr-TR')} ₺
                </Text>
                <Text style={styles.webMiniStatLbl} numberOfLines={1}>Net kâr</Text>
              </View>
              <View style={[styles.webMiniStatCard, { flex: 1, paddingVertical: 8 }]}>
                <Text style={[styles.webMiniStatVal, { fontSize: 15, color: (salesSummary.foodCostPercent || 0) > 30 ? '#b45309' : '#047857' }]} numberOfLines={1}>
                  %{(salesSummary.foodCostPercent || 0).toFixed(1)}
                </Text>
                <Text style={styles.webMiniStatLbl} numberOfLines={1}>Food cost</Text>
              </View>
            </View>

            {salesActiveTab === 'product' && (
              sortedSalesByRevenue.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#94a3b8', fontWeight: '600', paddingVertical: 24 }}>Bugün satış yok</Text>
              ) : (
                sortedSalesByRevenue.map(([name, data]) => {
                  const profit = data.net - data.cost;
                  const fc = data.net > 0 ? (data.cost / data.net) * 100 : 0;
                  const fcColor = fc >= 40 ? '#b91c1c' : fc >= 30 ? '#b45309' : '#15803d';
                  return (
                    <View key={name} style={[styles.webSalesCard, { padding: 12 }]}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.itemTitle, { fontSize: 14.5, marginBottom: 2 }]} numberOfLines={1}>{getRecipeName(name, currentLang)}</Text>
                        <Text style={[styles.itemMeta, { marginTop: 0 }]} numberOfLines={1}>
                          {data.quantity} porsiyon · <Text style={{ color: fcColor, fontWeight: '800' }}>FC %{fc.toFixed(1)}</Text>
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.salesRevBold}>{Math.round(data.revenue).toLocaleString('tr-TR')} ₺</Text>
                        <Text style={{ fontSize: 12, fontWeight: '800', color: profit >= 0 ? '#047857' : '#dc2626' }}>
                          kâr {Math.round(profit).toLocaleString('tr-TR')} ₺
                        </Text>
                      </View>
                    </View>
                  );
                })
              )
            )}

            {salesActiveTab === 'timeline' && (
              filteredTimelineSales.length === 0 ? (
                <Text style={{ textAlign: 'center', color: '#94a3b8', fontWeight: '600', paddingVertical: 24 }}>Kayıt yok</Text>
              ) : (
                [...pageOf('salesTimeline', filteredTimelineSales).map((sale, idx) => {
                  const f = saleFigures(sale);
                  return (
                    <View key={sale.id || idx} style={[styles.webSalesCard, { padding: 12 }]}>
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#334155', width: 46 }}>{sale.time || '--:--'}</Text>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={[styles.itemTitle, { fontSize: 14 }]} numberOfLines={1}>{sale.recipeName || sale.productName || `Satış #${sale.id || idx + 1}`}</Text>
                        <Text style={styles.itemMeta} numberOfLines={1}>
                          {Number(sale.quantity) || 1} porsiyon{sale.tableNo ? ` · ${/^masa/i.test(String(sale.tableNo)) ? sale.tableNo : `Masa ${sale.tableNo}`}` : ''}{sale.paymentMethod ? ` · ${sale.paymentMethod === 'CASH' ? 'Nakit' : sale.paymentMethod === 'CARD' ? 'Kart' : sale.paymentMethod}` : ''}
                        </Text>
                      </View>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.salesRevBold}>{f.gross.toLocaleString('tr-TR')} ₺</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: f.profit >= 0 ? '#047857' : '#dc2626' }}>kâr {f.profit.toFixed(0)} ₺</Text>
                        {can('SALES_VOID') && (
                          <TouchableOpacity onPress={() => { setVoidTarget(sale); setVoidReason(''); }} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                            <Text style={{ fontSize: 12, fontWeight: '800', color: '#b91c1c', marginTop: 4 }}>İptal</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  );
                }), renderMore('salesTimeline', filteredTimelineSales)]
              )
            )}
          </View>
        )}

        {/* 5. EKRAN: DEPO & MAL KABUL TERMİNALİ (Warehouse - Web ile Birebir) */}
        {currentScreen === 'warehouse' && canViewWarehouse && (
          <View>
                {/* Esigi asan sayim farklari Mudur onayina gider: depo sorumlusu sonucunu burada izler */}
                {can('INVENTORY_COUNT') && (
                  <ApprovalsList scope="mine" defaultStatus="ALL" title="Sayım Onay Taleplerim" showToast={notify} onChanged={refreshAllData} />
                )}
                {/* Web Birebir: Sevkiyat & Bekleyen Mal Kabul Masası */}
                <View style={{
                  backgroundColor: '#ffffff',
                  borderRadius: 14,
                  padding: 14,
                  borderWidth: 1,
                  borderColor: pendingDeliveries.length > 0 ? '#a7f3d0' : '#dbe7df',
                  marginBottom: 12,
                  shadowColor: '#10b981',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.08,
                  shadowRadius: 6,
                  elevation: 2,
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: pendingDeliveries.length > 0 ? 10 : 0 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flex: 1 }}>
                      <Text style={{ fontSize: 18 }}>🚚</Text>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '800', color: '#064e3b' }} numberOfLines={1}>Bekleyen Sevkiyat</Text>
                        {pendingDeliveries.length === 0 && (
                          <Text style={{ fontSize: 11.5, color: '#64748b' }} numberOfLines={1}>Teslim alınacak sevkiyat yok</Text>
                        )}
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
                        {pendingDeliveries.length}
                      </Text>
                    </View>
                  </View>

                  {pendingDeliveries.length === 0 ? null : (
                    <View style={{ gap: 8 }}>
                      {[...pageOf('deliveries', pendingDeliveries).map((del, idx) => (
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
                                <Text style={{ fontSize: 13, fontWeight: '800', color: '#0f172a' }} numberOfLines={1}>{getItemName(del.itemName, currentLang)}</Text>
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
                              <Text style={{ fontSize: 11, color: '#64748b', marginTop: 2 }} numberOfLines={1}>
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
                            <Text style={{ color: '#ffffff', fontWeight: '800', fontSize: 12 }} numberOfLines={1}>
                              ✓ Depoya Al (+{del.quantity} {getUnitLabel(del.unit, currentLang)})
                            </Text>
                          </TouchableOpacity>
                        </View>
                      )), renderMore('deliveries', pendingDeliveries)]}
                    </View>
                  )}
                </View>


                {/* Ürün bul: barkod okut / ad yaz → ürünü seç → miktar → Mal Kabul veya Fire */}
                <View style={[styles.webSearchCard, { padding: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                    <Text style={[styles.cardHeaderSmall, { flex: 1, marginBottom: 0 }]} numberOfLines={1}>Mal kabul / fire</Text>
                    {can('INVENTORY_ITEM_MANAGE') && (
                    <TouchableOpacity
                      onPress={() => {
                        setEditingStockItem(null);
                        setNewStockItem({ name: '', cat: 'Kuru Gıda', unit: 'kg', stock: '', min: '5', price: '', supplier: '', barcode: '' });
                        setShowAddStockModal(true);
                      }}
                      style={{ paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: '#ecfdf5', borderWidth: 1, borderColor: '#a7f3d0' }}
                      activeOpacity={0.8}
                    >
                      <Text style={{ fontSize: 12, fontWeight: '800', color: '#047857' }}>+ Yeni ürün</Text>
                    </TouchableOpacity>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TextInput
                      style={[styles.inputBox, { flex: 1, marginBottom: 0 }]}
                      placeholder="Barkod veya ürün adı"
                      placeholderTextColor={THEME.colors.textLight}
                      value={barcodeInput}
                      onChangeText={setBarcodeInput}
                      returnKeyType="search"
                      onSubmitEditing={() => findWarehouseItem(barcodeInput)}
                    />
                    <TouchableOpacity
                      style={[styles.btnManualSubmit, { marginTop: 0, paddingHorizontal: 16, justifyContent: 'center' }]}
                      onPress={() => findWarehouseItem(barcodeInput)}
                    >
                      <Text style={styles.btnManualSubmitTxt}>Bul</Text>
                    </TouchableOpacity>
                  </View>
                  {!selectedItem && (barcodeInput || '').trim().length >= 2 && warehouseMatches.length > 0 && (
                    <View style={{ marginTop: 8 }}>
                      {warehouseMatches.map((it) => (
                        <TouchableOpacity
                          key={it.id}
                          onPress={() => setSelectedItem(it)}
                          activeOpacity={0.7}
                          style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 9, borderTopWidth: 1, borderTopColor: '#f1f5f3' }}
                        >
                          <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#0f172a', marginRight: 8 }} numberOfLines={1}>
                            {getItemName(it.name, currentLang)}
                          </Text>
                          <Text style={{ fontSize: 12.5, fontWeight: '800', color: it.stock <= it.min ? '#dc2626' : '#475569' }}>
                            {it.stock} {getUnitLabel(it.unit, currentLang)}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  )}
                </View>

                {selectedItem && (
                  <View style={styles.selectedActionCard}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <Text style={[styles.itemTitle, { flex: 1, marginRight: 8 }]} numberOfLines={1}>{getItemName(selectedItem.name, currentLang)}</Text>
                      <TouchableOpacity style={styles.inlineBackBtn} onPress={() => setSelectedItem(null)}>
                        <Text style={styles.inlineBackBtnTxt}>✕ {t.cancel || 'Kapat'}</Text>
                      </TouchableOpacity>
                    </View>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      Stok {selectedItem.stock} {getUnitLabel(selectedItem.unit, currentLang)} · Min {selectedItem.min} {getUnitLabel(selectedItem.unit, currentLang)}{selectedItem.barcode ? ` · ${selectedItem.barcode}` : ''}
                    </Text>

                    <TextInput
                      style={[styles.inputBox, { marginTop: 10 }]}
                      placeholder={countMode ? `Rafta sayılan miktar (${getUnitLabel(selectedItem.unit, currentLang)})` : `Miktar (${getUnitLabel(selectedItem.unit, currentLang)})`}
                      placeholderTextColor={THEME.colors.textLight}
                      value={quantity}
                      onChangeText={setQuantity}
                      keyboardType="numeric"
                    />

                    {countMode ? (
                      <View>
                        {/* Sayım: girilen miktar rafta SAYILAN gerçek miktardır; sistem farkı düzeltme hareketi olarak yazar */}
                        <TextInput
                          style={[styles.inputBox, { marginTop: 8 }]}
                          placeholder="Sayım gerekçesi (ör. ay sonu sayımı)"
                          placeholderTextColor={THEME.colors.textLight}
                          value={countReason}
                          onChangeText={setCountReason}
                          maxLength={300}
                        />
                        <View style={styles.actionBtnGrid}>
                          <TouchableOpacity
                            style={[styles.actionBtnItem, { backgroundColor: '#0f766e' }]}
                            onPress={async () => {
                              const counted = parseFloat(String(quantity).replace(',', '.'));
                              if (!(counted >= 0)) { showToast('⚠️ Rafta sayılan miktarı girin'); return; }
                              if (countReason.trim().length < 3) { showToast('⚠️ Sayım gerekçesi girin'); return; }
                              const res = await apiAdjustStock(selectedItem.id, counted, countReason.trim());
                              if (res && res.success) {
                                const diff = counted - Number(selectedItem.stock || 0);
                                showToast(res.data && res.data.approvalRequired
                                  ? `⏳ Fark (${diff >= 0 ? '+' : ''}${diff.toFixed(2)} ${selectedItem.unit}) eşiği aştı; İşletme Müdürü onayına gönderildi`
                                  : `✓ Sayım işlendi (${diff >= 0 ? '+' : ''}${diff.toFixed(2)} ${selectedItem.unit})`);
                                setCountMode(false); setCountReason(''); setQuantity(''); setSelectedItem(null); setBarcodeInput('');
                                refreshAllData();
                              }
                            }}
                          >
                            <Text style={styles.actionBtnItemTxt} numberOfLines={1}>Sayımı kaydet</Text>
                          </TouchableOpacity>
                          <TouchableOpacity style={[styles.actionBtnItem, { backgroundColor: '#64748b' }]} onPress={() => { setCountMode(false); setCountReason(''); }}>
                            <Text style={styles.actionBtnItemTxt} numberOfLines={1}>Vazgeç</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                    <View style={styles.actionBtnGrid}>
                      {can('INVENTORY_RECEIVE') && (
                      <TouchableOpacity
                        style={[styles.actionBtnItem, { backgroundColor: '#059669' }]}
                        onPress={() => handleStockAction(true)}
                      >
                        <Text style={styles.actionBtnItemTxt} numberOfLines={1}>+ Mal Kabul</Text>
                      </TouchableOpacity>
                      )}
                      {can('INVENTORY_WASTE') && (
                      <TouchableOpacity
                        style={[styles.actionBtnItem, { backgroundColor: '#dc2626' }]}
                        onPress={() => handleStockAction(false)}
                      >
                        <Text style={styles.actionBtnItemTxt} numberOfLines={1}>− Fire</Text>
                      </TouchableOpacity>
                      )}
                      {can('INVENTORY_COUNT') && (
                      <TouchableOpacity
                        style={[styles.actionBtnItem, { backgroundColor: '#0f766e' }]}
                        onPress={() => setCountMode(true)}
                      >
                        <Text style={styles.actionBtnItemTxt} numberOfLines={1}>Sayım</Text>
                      </TouchableOpacity>
                      )}
                    </View>
                    )}
                  </View>
                )}

                {/* Son depo hareketleri */}
                <View style={styles.webTxBox}>
                  <Text style={[styles.webTxTitle, { marginBottom: 6 }]} numberOfLines={1}>Son hareketler</Text>
                  {transactions && transactions.length > 0 ? (
                    transactions.slice(0, 5).map((tx) => (
                      <View key={tx.id} style={styles.webTxItemRow}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                          <View
                            style={[
                              styles.webTxIconBadge,
                              { backgroundColor: tx.type === 'receive' ? '#ecfdf5' : '#fef2f2' },
                            ]}
                          >
                            <Text style={{ fontSize: 13 }}>{tx.type === 'receive' ? '📥' : '📤'}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <Text style={styles.webTxName} numberOfLines={1}>{getItemName(tx.itemName, currentLang)}</Text>
                            <Text style={styles.webTxMeta} numberOfLines={1}>
                              {tx.recordedBy} · {tx.note ? tx.note : (tx.type === 'receive' ? 'Mal kabul' : 'Çıkış')}
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
                      Henüz depo hareketi yok
                    </Text>
                  )}
                </View>
          </View>
        )}

        {/* 6. EKRAN: KULLANICI YÖNETİMİ (Users - Web ile Birebir) */}
        {currentScreen === 'audit' && allowedScreens.includes('audit') && (
          <AuditScreen showToast={notify} />
        )}

        {currentScreen === 'users' && canViewUsers && (
          <View>
            {/* Kompakt personel satırları: dokununca rolün görevi ve işlemler açılır */}
            {[...pageOf('users', sortedOf('users', filteredUsers)).map((u) => {
              const open = openUserId === u.id;
              const color = ROLE_COLORS[u.role] || '#64748b';
              const isSelf = u.username === currentUser.username || u.id === currentUser.id;
              return (
                <TouchableOpacity
                  key={u.id}
                  activeOpacity={0.8}
                  onPress={() => setOpenUserId(open ? null : u.id)}
                  style={[styles.webUserCard, { padding: 12 }, u.active === false && { opacity: 0.6 }]}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <View style={[styles.webUserAvatar, { backgroundColor: color, width: 40, height: 40, borderRadius: 20, marginRight: 10 }]}>
                      <Text style={[styles.webUserAvatarTxt, { fontSize: 14 }]}>{u.avatar}</Text>
                    </View>
                    <View style={{ flex: 1, marginRight: 8 }}>
                      <Text style={[styles.webUserName, { marginBottom: 1 }]} numberOfLines={1}>{u.name}</Text>
                      <Text style={{ fontSize: 12, color: '#64748b' }} numberOfLines={1}>
                        @{u.username}{u.email ? ` · ${u.email}` : ''}
                      </Text>
                    </View>
                    <View style={[styles.webRolePill, { backgroundColor: color + '18', borderColor: color }]}>
                      <Text style={[styles.webRolePillTxt, { color }]} numberOfLines={1}>{getRoleLabel(u.role, currentLang)}</Text>
                    </View>
                  </View>

                  {open && (
                    <View style={{ marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#f1f5f3' }}>
                      <Text style={{ fontSize: 12.5, color: '#475569', lineHeight: 18 }}>
                        {roleCatalog[u.role]?.description || ROLE_MODULES[u.role] || 'Rolüne tanımlı ekranlar'}
                      </Text>
                      {u.active === false && (
                        <Text style={{ fontSize: 12, fontWeight: '800', color: '#b91c1c', marginTop: 6 }}>Hesap pasif</Text>
                      )}
                      {can('USER_MANAGE') && !isSelf && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
                          <TouchableOpacity
                            style={[styles.webUserDismissBtn, { backgroundColor: '#eff6ff', borderColor: '#bfdbfe' }]}
                            onPress={() => setEditingUserRole(u)}
                          >
                            <Text style={[styles.webUserDismissTxt, { color: '#1d4ed8' }]}>Rol</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.webUserDismissBtn, { backgroundColor: '#f8fafc', borderColor: '#cbd5e1' }]}
                            onPress={() => { setUserAction({ type: 'profile', user: u }); setUserActionName(u.name || ''); setUserActionEmail(u.email || ''); }}
                          >
                            <Text style={[styles.webUserDismissTxt, { color: '#334155' }]}>Bilgiler</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.webUserDismissBtn, { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}
                            onPress={() => { setUserAction({ type: 'password', user: u }); setUserActionPassword(''); }}
                          >
                            <Text style={[styles.webUserDismissTxt, { color: '#b45309' }]}>Şifre</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[styles.webUserDismissBtn, { backgroundColor: u.active === false ? '#ecfdf5' : '#f1f5f9', borderColor: u.active === false ? '#a7f3d0' : '#cbd5e1' }]}
                            onPress={async () => {
                              const res = await apiSetUserActive(u.id, u.active === false);
                              if (res && res.success) {
                                showToast(u.active === false ? `✓ ${u.name} hesabı aktif edildi` : `⏸ ${u.name} hesabı pasife alındı; oturumu kapatıldı`);
                                refreshAllData();
                              }
                            }}
                          >
                            <Text style={[styles.webUserDismissTxt, { color: u.active === false ? '#047857' : '#475569' }]}>{u.active === false ? 'Aktif et' : 'Pasif yap'}</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={styles.webUserDismissBtn}
                            onPress={() => {
                              setItemToDelete({
                                type: 'user',
                                id: u.id,
                                name: u.name,
                                details: `"${u.name}" (@${u.username}) arşivlenecek; oturumu sonlanır ve tekrar giriş yapamaz. Geçici ayrılıklar için "Pasif yap" yeterlidir.`,
                              });
                            }}
                          >
                            <Text style={styles.webUserDismissTxt}>Arşivle</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              );
            }), renderMore('users', filteredUsers)]}
          </View>
        )}

        {/* 7. EKRAN: KASA & MUHASEBE (Cashier - Web /cashier ile Birebir) */}
        {(currentScreen === 'cashier' || (currentScreen === 'accounting' && !isAdvisorUser)) && canViewCashier && (
          <View>
            {/* Roller arası operasyon onayları: Kasiyer iptal / ikram / indirim, Depo sayım farkı (web Onaylar ekranıyla aynı) */}
            {(can('POS_CANCEL_APPROVE') || can('POS_DISCOUNT_APPROVE') || can('INVENTORY_ADJUST_APPROVE')) && (
              <ApprovalsList scope="inbox" title="İptal · İkram · İndirim · Sayım Onayları" showToast={notify} onChanged={refreshAllData} />
            )}
            <View style={styles.acctHead}>
              <Text style={styles.acctTitle} numberOfLines={1}>
                {can('EXPENSE_CREATE') ? 'Muhasebe' : can('EXPENSE_APPROVE') ? 'Harcama Onayları' : 'Muhasebe'}
              </Text>
              {!can('EXPENSE_CREATE') && !can('EXPENSE_APPROVE') && (
                <View style={styles.acctReadOnly}><Text style={styles.acctReadOnlyTxt}>Salt okunur</Text></View>
              )}
            </View>

            {/* Rolün özet şeridi (3 kısa gösterge) */}
            <View style={styles.acctStrip}>
              {acctStats.map((c, i) => (
                <React.Fragment key={c.k}>
                  {i > 0 && <View style={styles.acctStripDiv} />}
                  <View style={styles.acctStripCell}>
                    <Text style={styles.acctStripLabel} numberOfLines={2}>{c.label}</Text>
                    <Text style={[styles.acctStripValue, c.color && { color: c.color }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
                      {c.value}
                    </Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            {/* Muhasebe: tek satır işlem düğmeleri */}
            {can('EXPENSE_CREATE') && (
              <View style={styles.acctActions}>
                <TouchableOpacity style={[styles.acctBtn, styles.acctBtnPrimary]} onPress={() => setShowAddExpenseModal(true)} activeOpacity={0.8}>
                  <Text style={styles.acctBtnPrimaryTxt} numberOfLines={1}>+ Yeni Gider</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acctBtn} onPress={() => setShowCashAllocationModal(true)} activeOpacity={0.8}>
                  <Text style={styles.acctBtnTxt} numberOfLines={1}>Kasa Girişi</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.acctBtn, styles.acctBtnIcon]} onPress={() => setShowExportRow((v) => !v)} activeOpacity={0.8}>
                  <Text style={styles.acctBtnTxt}>⤓</Text>
                </TouchableOpacity>
              </View>
            )}
            {!can('EXPENSE_CREATE') && can('JOURNAL_VIEW') && (
              <TouchableOpacity style={styles.acctExportLink} onPress={() => setShowExportRow((v) => !v)} activeOpacity={0.8}>
                <Text style={styles.acctExportLinkTxt}>⤓ Dışa aktar</Text>
              </TouchableOpacity>
            )}
            {showExportRow && (
              <View style={styles.acctActions}>
                <TouchableOpacity style={styles.acctBtn} onPress={() => { setShowExportRow(false); handleExportExcelMobile(); }} activeOpacity={0.8}>
                  <Text style={styles.acctBtnTxt} numberOfLines={1}>Excel (.xlsx)</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.acctBtn} onPress={() => { setShowExportRow(false); handleExportCSVMobile(); }} activeOpacity={0.8}>
                  <Text style={styles.acctBtnTxt} numberOfLines={1}>CSV</Text>
                </TouchableOpacity>
              </View>
            )}

            {/* Giderler | Kasa (kasa sayımı mutabakatı ve kasa raporu) */}
            {hasCashSection && (
              <View style={styles.segment}>
                {[['expenses', 'Giderler'], ['cash', can('CASH_CLOSING_REVIEW') ? 'Kasa Mutabakatı' : 'Kasa']].map(([id, label]) => (
                  <TouchableOpacity key={id} style={[styles.segmentItem, acctSection === id && styles.segmentItemActive]} onPress={() => setAcctSection(id)} activeOpacity={0.8}>
                    <Text style={[styles.segmentTxt, acctSection === id && styles.segmentTxtActive]} numberOfLines={1}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {acctSection === 'cash' && <CashControlPanel can={can} showToast={notify} />}
            {acctSection !== 'cash' && (
            <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
              {expenseFilters.map(([id, label, count]) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.catFilterChip, { marginRight: 6 }, expenseTab === id && styles.catFilterChipActive]}
                  onPress={() => setExpenseTab(id)}
                >
                  <Text style={[styles.catFilterTxt, expenseTab === id && styles.catFilterTxtActive]} numberOfLines={1}>
                    {label} · {count}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.webFilterBar}>
              <TextInput
                style={styles.webSearchInput}
                placeholder={t.searchExpensePlaceholder || 'Gider, kurum veya fatura no ara'}
                placeholderTextColor={THEME.colors.textLight}
                value={expenseSearch}
                onChangeText={setExpenseSearch}
              />
            </View>
            {expenseTab !== 'daily_sales' && renderExpenseFilters('expenses', expenses)}

            {/* Günlük Satışlar Listesi (Eğer 'daily_sales' sekmesi seçiliyse) */}
            {expenseTab === 'daily_sales' ? (
              <View style={{ gap: 8, marginBottom: 12 }}>
                <View style={{ backgroundColor: '#ecfdf5', padding: 12, borderRadius: 12, borderWidth: 1, borderColor: '#a7f3d0' }}>
                  <Text style={{ fontSize: 13, fontWeight: '900', color: '#065f46' }}>
                    {t.todaySalesSummaryTitle || '🍽️ Bugün Restoranda Ne Satıldı? (Kasa Dökümü)'}
                  </Text>
                  <Text style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                    Ciro {totalRevenue.toLocaleString('tr-TR')} ₺ · Net kâr (KDV hariç) {(salesSummary.netProfit || 0).toLocaleString('tr-TR')} ₺
                  </Text>
                </View>
                {[...pageOf('sales', salesItemsToProcess).map((item, idx) => {
                  const itemName = item.name || item.recipeName || `Ürün #${item.id || idx + 1}`;
                  const itemQty = item.quantity || item.qty || 1;
                  const fig = saleFigures(item);
                  const itemRev = fig.gross;
                  const itemCost = fig.cost;
                  const fcPercent = fig.fc.toFixed(1);

                  return (
                    <View key={item.id || idx} style={[styles.webUserCard, { borderLeftWidth: 4, borderLeftColor: '#059669' }]}>
                      <View style={styles.webUserTopRow}>
                        <View style={[styles.webUserAvatar, { backgroundColor: '#dcfce7', borderRadius: 8 }]}>
                          <Text style={{ fontSize: 16 }}>🍽️</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.webUserName}>{getRecipeName(itemName, currentLang)}</Text>
                          <Text style={styles.webUserEmail}>
                            {t.quantityPcs || 'Adet'}: <Text style={{ fontWeight: '800', color: '#0f172a' }}>{itemQty} {getUnitLabel('porsiyon', currentLang)}</Text> • {t.rawMaterialCost || 'Hammadde'}: {itemCost.toLocaleString('tr-TR')} ₺
                          </Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: 15, fontWeight: '900', color: '#166534' }}>
                            +{itemRev.toLocaleString('tr-TR')} ₺
                          </Text>
                          <View style={[styles.webRolePill, { backgroundColor: '#dcfce7', borderColor: '#86efac', marginTop: 4 }]}>
                            <Text style={[styles.webRolePillTxt, { color: '#15803d', fontWeight: '800' }]}>
                              %{fcPercent} Food Cost
                            </Text>
                          </View>
                        </View>
                      </View>
                    </View>
                  );
                }), renderMore('sales', salesItemsToProcess)]}
              </View>
            ) : filteredExpenses.length === 0 ? (
              <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14 }}>
                <Text style={{ fontSize: 28, marginBottom: 6 }}>📑</Text>
                <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.colors.textDark }}>{t.noMatchingExpense || 'Eşleşen gider kaydı bulunamadı'}</Text>
                <Text style={{ fontSize: 12, color: THEME.colors.textLight, marginTop: 4 }}>{t.changeSearchFilterHint || 'Arama terimini veya filtre sekmesini değiştirebilirsiniz.'}</Text>
              </View>
            ) : (
              [renderSortChips('expenses'), ...pageOf('expenses', sortedOf('expenses', filteredExpenses)).map((exp) => {
                const isFixed = exp.category === 'FIXED';
                const pillColor = isFixed ? '#2563eb' : '#d97706';
                const pillBg = isFixed ? '#eff6ff' : '#fffbeb';
                const pillBorder = isFixed ? '#bfdbfe' : '#fde68a';

                const isPaid = exp.paymentStatus === 'PAID' || (exp.paidByCashier && exp.paymentStatus !== 'UNPAID');
                const isPartial = exp.paymentStatus === 'PARTIAL';
                const isUnpaid = !isPaid && !isPartial;
                const isNeedsCorrection = exp.status === 'NEEDS_CORRECTION' || exp.status === 'REJECTED';
                const isFinalized = exp.status === 'FINALIZED' || Boolean(exp.recordedInLedger);
                const flow = expenseFlow(exp);
                const canDeleteExp = can('EXPENSE_DELETE') && ['PENDING_APPROVAL', 'REJECTED', 'NEEDS_CORRECTION'].includes(exp.status) && !(parseFloat(exp.paidAmount) > 0);
                const hasActions = ((isUnpaid || isPartial) && can('EXPENSE_PAY') && ['APPROVED', 'FINALIZED'].includes(exp.status))
                  || (['PENDING_APPROVAL', 'APPROVED'].includes(exp.status) && !exp.sentToAdvisor && can('EXPENSE_APPROVE'))
                  || (exp.status === 'APPROVED' && !exp.sentToAdvisor && can('EXPENSE_SUBMIT'))
                  || (isNeedsCorrection && can('EXPENSE_EDIT'))
                  || canDeleteExp;

                return (
                  <View
                    key={exp.id}
                    style={[
                      styles.webExpenseCard,
                      isNeedsCorrection && styles.webExpenseCardNeedsCorrection,
                      isFinalized && styles.webExpenseCardFinalized,
                    ]}
                  >
                    {/* Kompakt gider kartı: başlık + tutar, tek satır bilgi, iş akışı ve ödeme rozeti */}
                    <View style={styles.expCardHeaderRow}>
                      <View style={{ flex: 1, paddingRight: 8 }}>
                        <Text style={styles.expCardTitle} numberOfLines={2}>{getExpenseTitle(exp.title, currentLang)}</Text>
                        <Text style={styles.expCardMetaTxt} numberOfLines={1}>
                          {[
                            exp.expenseDate,
                            getSupplierLabel(exp.counterparty, currentLang),
                            getExpenseTypeLabel(exp.subType, currentLang) || (isFixed ? 'Sabit' : 'Değişken'),
                          ].filter(Boolean).join(' · ')}
                        </Text>
                      </View>
                      <Text style={styles.expCardAmountTxt} numberOfLines={1}>
                        {exp.isOwnedProperty ? (t.ownedPropertyFree || '0 ₺') : `${Math.round(parseFloat(exp.amount || 0)).toLocaleString('tr-TR')} ₺`}
                      </Text>
                    </View>
                    <View style={styles.expChipRow}>
                      <View style={[styles.expChip, { backgroundColor: flow.bg, borderColor: flow.border }]}>
                        <Text style={[styles.expChipTxt, { color: flow.color }]} numberOfLines={1}>{flow.label}</Text>
                      </View>
                      <View style={[styles.expChip, isPaid ? styles.expChipOk : isPartial ? styles.expChipWarn : styles.expChipMuted]}>
                        <Text style={[styles.expChipTxt, { color: isPaid ? '#047857' : isPartial ? '#b45309' : '#475569' }]} numberOfLines={1}>
                          {isPaid ? (exp.status === 'PENDING_APPROVAL' ? 'Peşin ödendi' : 'Ödendi') : isPartial ? 'Kısmi ödendi' : 'Ödenmedi'}
                        </Text>
                      </View>
                      {exp.dueDate && !isPaid ? (
                        <Text style={styles.expDueTxt} numberOfLines={1}>Vade {exp.dueDate}</Text>
                      ) : null}
                    </View>
                    {isNeedsCorrection && exp.rejectionReason ? (
                      <View style={styles.expRejectBox}>
                        <Text style={styles.expRejectTxt} numberOfLines={3}>
                          Ret gerekçesi{exp.rejectedBy ? ` (${exp.rejectedBy})` : ''}: {exp.rejectionReason}
                        </Text>
                      </View>
                    ) : null}

                    {/* İşlem satırı: yalnızca bu rolün yapabileceği işlem varsa */}
                    {hasActions && (
                    <View style={styles.expActionRow}>
                      <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                        {/* Borç / Kalan Tutar Ödeme Butonu */}
                        {(isUnpaid || isPartial) && can('EXPENSE_PAY') && ['APPROVED', 'FINALIZED'].includes(exp.status) && (
                          <TouchableOpacity
                            style={[styles.webBtnPayDebt, isPartial && { backgroundColor: '#fffbeb', borderColor: '#fde68a' }]}
                            onPress={() => {
                              const remaining = Number(exp.remainingAmount) > 0 ? Number(exp.remainingAmount) : Number(exp.amount) - Number(exp.paidAmount || 0);
                              setPayTarget(exp); setPayAmount(String(Math.round(remaining * 100) / 100)); setPayMethod('BANK_TRANSFER'); setPayNote('');
                            }}
                            activeOpacity={0.8}
                          >
                            <Text style={[styles.webBtnPayDebtTxt, isPartial && { color: '#b45309' }]}>
                              {isPartial ? 'Kalanı öde' : 'Öde'}
                            </Text>
                          </TouchableOpacity>
                        )}

                        {/* İş akışı: harcama onayı → ödeme → faturalandır & müşavire gönder → müşavir kararı */}
                        {exp.status === 'PENDING_APPROVAL' && can('EXPENSE_APPROVE') && (
                          <TouchableOpacity style={styles.webBtnSendAdvisor} onPress={() => handleSendToAdvisorMobile(exp)} activeOpacity={0.8}>
                            <Text style={styles.webBtnSendAdvisorTxt}>✓ Onayla</Text>
                          </TouchableOpacity>
                        )}
                        {['PENDING_APPROVAL', 'APPROVED'].includes(exp.status) && !exp.sentToAdvisor && can('EXPENSE_APPROVE') && (
                          <TouchableOpacity style={styles.webBtnReject} onPress={() => handleOpenRejectModal(exp)} activeOpacity={0.8}>
                            <Text style={styles.webBtnRejectTxt}>✕ Reddet</Text>
                          </TouchableOpacity>
                        )}
                        {exp.status === 'APPROVED' && !exp.sentToAdvisor && can('EXPENSE_SUBMIT') && (
                          <TouchableOpacity style={styles.webBtnSendAdvisor} onPress={() => handleSendToAdvisorMobile(exp)} activeOpacity={0.8}>
                            <Text style={styles.webBtnSendAdvisorTxt}>Müşavire Gönder</Text>
                          </TouchableOpacity>
                        )}
                        {isNeedsCorrection && can('EXPENSE_EDIT') && (
                          <TouchableOpacity style={styles.webBtnSendAdvisor} onPress={() => handleSendToAdvisorMobile(exp)} activeOpacity={0.8}>
                            <Text style={styles.webBtnSendAdvisorTxt}>↺ Tekrar Onaya Sun</Text>
                          </TouchableOpacity>
                        )}
                      </View>

                      {/* Silme: Muhasebe; onaylanmamış ve ödemesi olmayan taslak kayıt (sunucu kuralı) */}
                      {can('EXPENSE_DELETE') && ['PENDING_APPROVAL', 'REJECTED', 'NEEDS_CORRECTION'].includes(exp.status) && !(parseFloat(exp.paidAmount) > 0) && (
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
              }), renderMore('expenses', filteredExpenses)]
            )}
            </>
            )}
          </View>
        )}

        {/* 8. EKRAN: MALİ MÜŞAVİR DEFTERİ & SMMM KONTROL PANELİ (Advisor - Web /advisor-ledger ile Birebir) */}
        {(currentScreen === 'advisor' || (currentScreen === 'accounting' && isAdvisorUser)) && canViewAdvisor && (
          <View>
            <View style={styles.acctHead}>
              <Text style={styles.acctTitle} numberOfLines={1}>Mali Müşavir Defteri</Text>
            </View>

            <View style={styles.acctStrip}>
              {[
                { k: 'q', label: 'İnceleme', value: String(advisorQueueCount), color: '#b45309' },
                { k: 'l', label: 'Deftere işlenen', value: String(totalApprovedLedgerCount), color: '#047857' },
                { k: 'r', label: 'Düzeltmede', value: String(totalRejectedCount), color: '#b91c1c' },
              ].map((c, i) => (
                <React.Fragment key={c.k}>
                  {i > 0 && <View style={styles.acctStripDiv} />}
                  <View style={styles.acctStripCell}>
                    <Text style={styles.acctStripLabel} numberOfLines={2}>{c.label}</Text>
                    <Text style={[styles.acctStripValue, { color: c.color }]} numberOfLines={1}>{c.value}</Text>
                  </View>
                </React.Fragment>
              ))}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 10 }}>
              {[
                ['pending_approval', `İnceleme · ${advisorQueueCount}`],
                ['ledger', `Defter · ${totalApprovedLedgerCount}`],
                ['rejected', `Düzeltme · ${totalRejectedCount}`],
                (can('CASH_CLOSING_VIEW') || can('CASH_REPORT_VIEW')) && ['cash', 'Kasa'],
                (can('VAT_REPORT_VIEW') || can('PERIOD_VIEW')) && ['tax_reports', 'KDV & Dönem'],
                ['all', `Tümü · ${expenses.length}`],
              ].filter(Boolean).map(([id, label]) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.catFilterChip, { marginRight: 6 }, advisorTab === id && styles.catFilterChipActive]}
                  onPress={() => setAdvisorTab(id)}
                >
                  <Text style={[styles.catFilterTxt, advisorTab === id && styles.catFilterTxtActive]} numberOfLines={1}>{label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            {advisorTab === 'cash' ? (
              <CashControlPanel can={can} showToast={notify} />
            ) : null}
            {/* TDHP HESAP PLANI GÖRÜNÜMÜ */}
            {advisorTab === 'cash' ? null : advisorTab === 'tax_reports' ? (
              /* Gerçek sunucu verisi: KDV ön izleme + dönem kapama (sahte oran / sahte dışa aktarım yok) */
              <View>
                {can('VAT_REPORT_VIEW') && <VatSummary showToast={notify} />}
                {can('PERIOD_VIEW') && <PeriodPanel can={can} showToast={notify} />}
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
                {renderExpenseFilters('advisorExpenses', expenses)}

                {filteredAdvisorExpenses.length === 0 ? (
                  <View style={{ padding: 24, alignItems: 'center', backgroundColor: '#ffffff', borderRadius: 14 }}>
                    <Text style={{ fontSize: 28, marginBottom: 6 }}>📖</Text>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: THEME.colors.textDark }}>
                      Bu sekmede kayıt yok
                    </Text>
                  </View>
                ) : (
                  [renderSortChips('advisorExpenses'), ...pageOf('advisorExpenses', sortedOf('advisorExpenses', filteredAdvisorExpenses)).map((exp) => {
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
                        <View style={styles.expCardHeaderRow}>
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <Text style={styles.expCardTitle} numberOfLines={2}>{getExpenseTitle(exp.title, currentLang)}</Text>
                            <Text style={styles.expCardMetaTxt} numberOfLines={1}>
                              {[
                                exp.expenseDate,
                                getSupplierLabel(exp.counterparty, currentLang),
                                exp.invoiceNumber ? `Fatura ${exp.invoiceNumber}` : 'Faturasız',
                              ].filter(Boolean).join(' · ')}
                            </Text>
                          </View>
                          <Text style={styles.expCardAmountTxt} numberOfLines={1}>
                            {`${Math.round(parseFloat(exp.amount || 0)).toLocaleString('tr-TR')} ₺`}
                          </Text>
                        </View>
                        <View style={styles.expChipRow}>
                          {(() => { const f = expenseFlow(exp); return (
                            <View style={[styles.expChip, { backgroundColor: f.bg, borderColor: f.border }]}>
                              <Text style={[styles.expChipTxt, { color: f.color }]} numberOfLines={1}>{f.label}</Text>
                            </View>
                          ); })()}
                          <View style={[styles.expChip, isPaid ? styles.expChipOk : styles.expChipMuted]}>
                            <Text style={[styles.expChipTxt, { color: isPaid ? '#047857' : '#475569' }]} numberOfLines={1}>
                              {isPaid ? 'Ödendi' : isPartial ? 'Kısmi ödendi' : 'Ödenmedi'}
                            </Text>
                          </View>
                          <Text style={styles.expDueTxt2} numberOfLines={1}>{getExpenseTypeLabel(exp.subType, currentLang) || (isFixed ? 'Sabit' : 'Değişken')}</Text>
                        </View>
                        <Text style={styles.advMetaTxt} numberOfLines={1}>
                          {[
                            exp.period ? `Dönem ${exp.period}` : null,
                            exp.vatRate != null ? `KDV %${Number(exp.vatRate)}` : null,
                            isPartial && exp.paidAmount != null ? `Ödenen ${Math.round(parseFloat(exp.paidAmount)).toLocaleString('tr-TR')} ₺` : null,
                            isUnpaid && exp.dueDate ? `Vade ${exp.dueDate}` : null,
                            exp.submittedBy ? `Gönderen ${exp.submittedBy}` : null,
                          ].filter(Boolean).join(' · ')}
                        </Text>
                        {exp.note ? (
                          <Text style={styles.advNoteTxt} numberOfLines={2}>{`Muhasebe notu: ${exp.note}`}</Text>
                        ) : null}
                        {isNeedsCorrection && exp.rejectionReason ? (
                          <View style={styles.expRejectBox}>
                            <Text style={styles.expRejectTxt} numberOfLines={3}>
                              Ret gerekçesi{exp.rejectedBy ? ` (${exp.rejectedBy})` : ''}: {exp.rejectionReason}
                            </Text>
                          </View>
                        ) : null}

                        {/* Müşavir kararı: yalnızca Muhasebenin gönderdiği kayıtta */}
                        {exp.status === 'APPROVED' && exp.sentToAdvisor && !isFinalized && can('LEDGER_DECIDE') && (
                        <View style={styles.expActionRow}>
                          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center', flexWrap: 'wrap', flex: 1 }}>
                            <>
                                <TouchableOpacity
                                  style={styles.webBtnApprove}
                                  onPress={() => handleApproveExpenseLedger(exp)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.webBtnApproveTxt}>✓ Deftere İşle</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                  style={styles.webBtnReject}
                                  onPress={() => handleOpenRejectModal(exp)}
                                  activeOpacity={0.8}
                                >
                                  <Text style={styles.webBtnRejectTxt}>✕ Reddet</Text>
                                </TouchableOpacity>
                              </>
                          </View>

                          {/* Mali Müşavir kayıt silmez; silme Muhasebenin taslak kayıtlarına özgüdür */}
                          {can('EXPENSE_DELETE') && ['PENDING_APPROVAL', 'REJECTED', 'NEEDS_CORRECTION'].includes(exp.status) && !(parseFloat(exp.paidAmount) > 0) && (
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
                  }), renderMore('advisorExpenses', filteredAdvisorExpenses)]
                )}
              </>
            )}
          </View>
        )}

        {/* KASA KONTROLÜ: kasiyer sayımlarının mutabakatı ve günlük / aylık / yıllık kasa raporu */}
        {false && (
          <View style={{ marginTop: 16 }}>
            <Text style={{ fontSize: 16, fontWeight: '900', color: '#0f172a', marginBottom: 8 }}>
              {can('CASH_CLOSING_REVIEW') ? '🧾 Kasa Mutabakatı & Kasa Raporu' : '🧾 Kasa Sayımları & Kasa Raporu'}
            </Text>
            <CashControlPanel can={can} showToast={notify} />
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
      <Modal visible={showAddRecipeModal} animationType="slide" transparent onRequestClose={() => { setShowAddRecipeModal(false); setEditingRecipe(null); }}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxHeight: '92%' }]}>
            <View style={styles.webModalHeader}>
              <Text style={[styles.modalTitle, { flex: 1 }]} numberOfLines={1}>
                {editingRecipe ? 'Reçeteyi düzenle' : 'Yeni reçete'}
              </Text>
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

            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 6 }}>
              <Text style={styles.webModalLabel}>Yemek adı *</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Örn. Mercimek Çorbası"
                placeholderTextColor={THEME.colors.textLight}
                value={newRecipe.name}
                onChangeText={(tVal) => setNewRecipe({ ...newRecipe, name: tVal })}
              />

              <Text style={styles.webModalLabel}>Kategori</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" style={{ marginBottom: 12, flexGrow: 0 }}>
                {['Ana Yemek', 'Başlangıç', 'Çorba', 'Salata', 'Makarna', 'Pizza', 'Burger', 'Kahvaltı', 'Tatlı', 'İçecek'].map((cat) => (
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

              {/* Fiyat: Müdür belirler; Şef yeni reçetede öneri girer, mevcut reçetede fiyatı değiştiremez */}
              {(() => {
                const priceLocked = Boolean(editingRecipe) && !can('MENU_PRICE_SET');
                const sale = parseFloat(String(newRecipe.salePrice || '').replace(',', '.')) || 0;
                const vat = Number(editingRecipe?.vatRate ?? 10) || 0;
                const net = sale / (1 + vat / 100);
                const fc = net > 0 ? (recipeDraftCost / net) * 100 : 0;
                return (
                  <View style={{ marginBottom: 4 }}>
                    <Text style={styles.webModalLabel}>
                      {can('MENU_PRICE_SET') ? 'Satış fiyatı (₺, KDV dahil) *' : priceLocked ? 'Satış fiyatı' : 'Önerilen fiyat (₺) *'}
                    </Text>
                    {priceLocked ? (
                      <Text style={{ fontSize: 15, fontWeight: '800', color: '#0f172a', marginBottom: 8 }}>
                        {sale.toFixed(2)} ₺ <Text style={{ fontSize: 11.5, fontWeight: '600', color: '#64748b' }}>· değişikliği Müdür yapar</Text>
                      </Text>
                    ) : (
                      <TextInput
                        style={styles.modalInput}
                        placeholder="0.00"
                        placeholderTextColor={THEME.colors.textLight}
                        value={String(newRecipe.salePrice)}
                        onChangeText={(tVal) => setNewRecipe({ ...newRecipe, salePrice: tVal })}
                        keyboardType="decimal-pad"
                      />
                    )}
                    <Text style={{ fontSize: 12, fontWeight: '700', color: fc >= 30 ? '#b91c1c' : '#047857', marginBottom: 6 }}>
                      Porsiyon maliyeti {recipeDraftCost.toFixed(2)} ₺{sale > 0 ? ` · food cost %${fc.toFixed(1)}` : ''}
                    </Text>
                    {!can('MENU_PRICE_SET') && !editingRecipe && (
                      <Text style={{ fontSize: 11.5, color: '#92400e', marginBottom: 6 }}>Müdür fiyatı onaylayınca kasada satışa açılır.</Text>
                    )}
                  </View>
                );
              })()}

              {/* Malzemeler: stoktan seçilir, miktar kartın biriminde girilir */}
              <View style={{ marginTop: 4, marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={[styles.webModalLabel, { marginBottom: 0 }]}>Malzemeler (1 porsiyon)</Text>
                  <TouchableOpacity
                    style={styles.webAddIngredientBtn}
                    onPress={() => {
                      setNewRecipe({
                        ...newRecipe,
                        ingredients: [...(newRecipe.ingredients || []), { itemId: null, name: '', quantity: '', unit: '' }],
                      });
                      setIngFocusIdx((newRecipe.ingredients || []).length);
                    }}
                  >
                    <Text style={styles.webAddIngredientBtnTxt}>+ Ekle</Text>
                  </TouchableOpacity>
                </View>

                {(newRecipe.ingredients || []).map((ing, idx) => {
                  const linked = ingredientItem(ing);
                  const q = String(ing.name || '').trim().toLowerCase();
                  const suggestions = ingFocusIdx === idx && q.length >= 2 && !(linked && linked.name.toLowerCase() === q)
                    ? items.filter((i) => i.name.toLowerCase().includes(q)).slice(0, 4)
                    : [];
                  const setRow = (patch) => {
                    const next = [...newRecipe.ingredients];
                    next[idx] = { ...next[idx], ...patch };
                    setNewRecipe({ ...newRecipe, ingredients: next });
                  };
                  return (
                    <View key={idx} style={{ marginBottom: 8 }}>
                      <View style={styles.webIngInputRow}>
                        <TextInput
                          style={[styles.modalInput, { flex: 2, marginBottom: 0 }, ing.name && !linked && { borderColor: '#fca5a5' }]}
                          placeholder="Stoktan malzeme ara"
                          placeholderTextColor={THEME.colors.textLight}
                          value={ing.name}
                          onFocus={() => setIngFocusIdx(idx)}
                          onChangeText={(tVal) => setRow({ name: tVal, itemId: null, unit: '' })}
                        />
                        <TextInput
                          style={[styles.modalInput, { flex: 1, marginBottom: 0 }]}
                          placeholder={linked ? linked.unit : 'miktar'}
                          placeholderTextColor={THEME.colors.textLight}
                          keyboardType="decimal-pad"
                          value={String(ing.quantity ?? '')}
                          onChangeText={(tVal) => setRow({ quantity: tVal })}
                        />
                        <Text style={{ width: 34, fontSize: 12, fontWeight: '700', color: '#475569' }} numberOfLines={1}>
                          {linked ? getUnitLabel(linked.unit, currentLang) : ''}
                        </Text>
                        {newRecipe.ingredients.length > 1 && (
                          <TouchableOpacity
                            style={styles.webRemoveIngBtn}
                            onPress={() => {
                              const next = newRecipe.ingredients.filter((_, i) => i !== idx);
                              setNewRecipe({ ...newRecipe, ingredients: next });
                              setIngFocusIdx(null);
                            }}
                          >
                            <Text style={styles.webRemoveIngTxt}>✕</Text>
                          </TouchableOpacity>
                        )}
                      </View>
                      {suggestions.map((it) => (
                        <TouchableOpacity
                          key={it.id}
                          onPress={() => { setRow({ itemId: it.id, name: it.name, unit: it.unit }); setIngFocusIdx(null); }}
                          style={{ flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 10, backgroundColor: '#f8fafc', borderBottomWidth: 1, borderBottomColor: '#eef2f0' }}
                          activeOpacity={0.7}
                        >
                          <Text style={{ flex: 1, fontSize: 13, fontWeight: '700', color: '#0f172a' }} numberOfLines={1}>{getItemName(it.name, currentLang)}</Text>
                          <Text style={{ fontSize: 12, color: '#64748b' }}>{Number(it.price).toFixed(2)} ₺/{getUnitLabel(it.unit, currentLang)}</Text>
                        </TouchableOpacity>
                      ))}
                      {ing.name && !linked && suggestions.length === 0 && ingFocusIdx === idx && q.length >= 2 && (
                        <Text style={{ fontSize: 11.5, color: '#b91c1c', marginTop: 4 }}>Stokta bu adla ürün yok — Depo'dan stok kartı açtırın.</Text>
                      )}
                    </View>
                  );
                })}
              </View>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={styles.modalSubmitBtn} onPress={handleSaveRecipe}>
                <Text style={styles.modalSubmitTxt}>{editingRecipe ? 'Kaydet' : (can('MENU_PRICE_SET') ? 'Ekle' : 'Onaya gönder')}</Text>
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
              {/* Seçilen rolün görev tanımı (web personel ekranıyla aynı metin, sunucudaki yetki tablosundan) */}
              {(roleCatalog[newUser.role]?.description || ROLE_MODULES[newUser.role]) ? (
                <View style={{ backgroundColor: '#eff6ff', borderColor: '#bfdbfe', borderWidth: 1, borderRadius: 8, padding: 10, marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, color: '#1e3a8a', lineHeight: 17 }}>
                    <Text style={{ fontWeight: '800' }}>{getRoleLabel(newUser.role, currentLang)}: </Text>
                    {roleCatalog[newUser.role]?.description || ROLE_MODULES[newUser.role]}
                  </Text>
                  {Array.isArray(roleCatalog[newUser.role]?.permissions) ? (
                    <Text style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>
                      {roleCatalog[newUser.role].permissions.length} yetki tanımlı
                    </Text>
                  ) : null}
                </View>
              ) : null}
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
                  await apiMarkAllNotificationsRead();
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
                [...pageOf('notifications', mobileNotifications).map((notif) => {
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
                        // Yalnızca rolün açabildiği ekrana gidilir (bildirim bağlantısı yanlış güvenlik uyarısı üretmez)
                        if (notif.route) {
                          setShowNotifModal(false);
                          const r = notif.route;
                          if (r.includes('chat')) {
                            setShowTeamChatModal(true);
                          } else {
                            const target = r.includes('pricing') ? (allowedScreens.includes('dashboard') ? 'dashboard' : 'recipes')
                              : screenForRoute(r);
                            if (target && allowedScreens.includes(target)) navigateTo(target);
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
                }), renderMore('notifications', mobileNotifications)]
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
      {/* Müdür: menü fiyatı onayı / gerekçeli değişiklik */}
      <Modal visible={!!priceTarget} animationType="fade" transparent onRequestClose={() => setPriceTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {priceTarget && (() => {
              const p = parseFloat(String(priceInput).replace(',', '.')) || 0;
              const net = p / (1 + (Number(priceTarget.vatRate) || 0) / 100);
              const fc = net > 0 ? (priceTarget.cost / net) * 100 : 0;
              const pending = priceTarget.priceApproved === false;
              return (
                <View>
                  <View style={styles.webModalHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.modalTitle} numberOfLines={1}>{pending ? 'Fiyatı Onayla' : 'Fiyatı Değiştir'}</Text>
                      <Text style={styles.webModalSub} numberOfLines={1}>{priceTarget.name}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setPriceTarget(null)}>
                      <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
                    Porsiyon maliyeti {priceTarget.cost.toFixed(2)} ₺ · KDV %{Number(priceTarget.vatRate) || 0}
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    keyboardType="decimal-pad"
                    placeholder="Satış fiyatı (₺, KDV dahil)"
                    placeholderTextColor={THEME.colors.textLight}
                    value={priceInput}
                    onChangeText={setPriceInput}
                  />
                  <Text style={{ fontSize: 12, fontWeight: '800', marginBottom: 8, color: fc >= 30 ? '#b91c1c' : '#047857' }}>
                    Food cost ≈ %{fc.toFixed(1)}{fc >= 30 ? ' (hedef %30 üstü)' : ''}
                  </Text>
                  <TextInput
                    style={styles.modalInput}
                    placeholder="Gerekçe (isteğe bağlı)"
                    placeholderTextColor={THEME.colors.textLight}
                    maxLength={300}
                    value={priceReason}
                    onChangeText={setPriceReason}
                  />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                    <TouchableOpacity
                      style={styles.modalSubmitBtn}
                      onPress={async () => {
                        if (!(p > 0)) { showToast('⚠️ Geçerli bir fiyat girin'); return; }
                        const target = priceTarget;
                        setPriceTarget(null);
                        const res = await apiSetRecipePrice(target.id, p, priceReason.trim() || undefined);
                        if (res && res.success) {
                          showToast(pending ? `✅ "${target.name}" menüye alındı` : `✅ "${target.name}" fiyatı güncellendi`);
                          refreshAllData();
                        }
                      }}
                    >
                      <Text style={styles.modalSubmitTxt}>{pending ? 'Onayla' : 'Kaydet'}</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPriceTarget(null)}>
                      <Text style={styles.modalCancelTxt}>Vazgeç</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Stok: ürün işlem penceresi (yalnızca rolün izinli olduğu işlemler görünür) */}
      <Modal
        visible={currentScreen === 'inventory' && !!selectedItem}
        animationType="slide"
        transparent
        onRequestClose={() => { setSelectedItem(null); setItemSheetMode(null); }}
      >
        <View style={[styles.modalOverlay, { justifyContent: 'flex-end' }]}>
          <View style={[styles.modalCard, { borderBottomLeftRadius: 0, borderBottomRightRadius: 0 }]}>
            {selectedItem && (() => {
              const it = selectedItem;
              const unit = getUnitLabel(it.unit, currentLang);
              const close = () => { setSelectedItem(null); setItemSheetMode(null); setItemSheetQty(''); setItemSheetReason(''); };
              const actions = [
                can('INVENTORY_WASTE') && ['waste', 'Fire kaydı', '#dc2626'],
                can('INVENTORY_RECEIVE') && ['receive', 'Mal kabul', '#059669'],
                can('INVENTORY_COUNT') && ['count', 'Sayım', '#0f766e'],
                can('INVENTORY_COST_EDIT') && ['cost', 'Birim maliyet', '#4338ca'],
                can('INVENTORY_ITEM_MANAGE') && ['edit', 'Kartı düzenle', '#334155'],
                can('PURCHASE_REQUEST') && ['request', 'Tedarik talebi', '#047857'],
              ].filter(Boolean);
              const submit = async () => {
                const v = parseFloat(String(itemSheetQty).replace(',', '.'));
                let res;
                if (itemSheetMode === 'waste') {
                  if (!(v > 0)) { showToast('⚠️ Fire miktarını girin'); return; }
                  if (itemSheetReason.trim().length < 3) { showToast('⚠️ Fire nedenini seçin veya yazın'); return; }
                  res = await apiRecordWaste(it.id, v, itemSheetReason.trim());
                } else if (itemSheetMode === 'receive') {
                  if (!(v > 0)) { showToast('⚠️ Teslim alınan miktarı girin'); return; }
                  res = await apiReceiveStock(it.id, v);
                } else if (itemSheetMode === 'count') {
                  if (!(v >= 0)) { showToast('⚠️ Rafta sayılan miktarı girin'); return; }
                  if (itemSheetReason.trim().length < 3) { showToast('⚠️ Sayım gerekçesi girin'); return; }
                  res = await apiAdjustStock(it.id, v, itemSheetReason.trim());
                } else if (itemSheetMode === 'cost') {
                  if (!(v > 0)) { showToast('⚠️ Yeni birim maliyeti girin'); return; }
                  res = await apiUpdateInventoryItem(it.id, { ...it, price: v });
                }
                if (res && res.success) {
                  showToast(res.data && res.data.approvalRequired
                    ? '⏳ Sayım farkı eşiği aştı; İşletme Müdürü onayına gönderildi'
                    : '✓ İşlem kaydedildi');
                  close();
                  refreshAllData();
                }
              };
              return (
                <View>
                  <View style={styles.webModalHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.modalTitle} numberOfLines={1}>{getItemName(it.name, currentLang)}</Text>
                      <Text style={styles.webModalSub} numberOfLines={1}>
                        Stok {it.stock} {unit} · Min {it.min} {unit} · {Number(it.price).toFixed(2)} ₺/{unit}
                      </Text>
                    </View>
                    <TouchableOpacity onPress={close}>
                      <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  {!itemSheetMode ? (
                    actions.length === 0 ? (
                      <Text style={{ fontSize: 12.5, color: '#64748b', paddingVertical: 8 }}>Bu ürün için rolünüzde işlem yetkisi yok (salt okunur).</Text>
                    ) : (
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingVertical: 4 }}>
                        {actions.map(([id, label, color]) => (
                          <TouchableOpacity
                            key={id}
                            style={{ paddingHorizontal: 14, paddingVertical: 11, borderRadius: 10, backgroundColor: color, minWidth: '47%', flexGrow: 1, alignItems: 'center' }}
                            activeOpacity={0.85}
                            onPress={() => {
                              if (id === 'edit') {
                                close();
                                setEditingStockItem(it);
                                setNewStockItem({ name: it.name, cat: it.cat, unit: it.unit, stock: String(it.stock), min: String(it.min), price: String(it.price), supplier: it.supplier || '', barcode: it.barcode || '' });
                                setShowAddStockModal(true);
                              } else if (id === 'request') {
                                close();
                                setOrderModalItem(it); setOrderQuantity('15'); setOrderNote(''); setOrderUrgent(it.stock <= it.min);
                              } else {
                                setItemSheetMode(id); setItemSheetQty(id === 'cost' ? String(it.price) : ''); setItemSheetReason(id === 'count' ? 'Periyodik sayım' : '');
                              }
                            }}
                          >
                            <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>{label}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    )
                  ) : (
                    <View>
                      <TextInput
                        style={styles.modalInput}
                        keyboardType="decimal-pad"
                        placeholder={itemSheetMode === 'cost' ? 'Yeni birim maliyet (₺)' : itemSheetMode === 'count' ? `Rafta sayılan miktar (${unit})` : `Miktar (${unit})`}
                        placeholderTextColor={THEME.colors.textLight}
                        value={itemSheetQty}
                        onChangeText={setItemSheetQty}
                      />
                      {itemSheetMode === 'waste' && (
                        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                          {['Bozulma', 'SKT geçti', 'Hazırlık firesi', 'Döküldü / kırıldı', 'İade edilen tabak'].map((r) => (
                            <TouchableOpacity key={r} onPress={() => setItemSheetReason(r)}
                              style={[styles.webChipBtn, itemSheetReason === r && styles.webChipBtnActive]}>
                              <Text style={[styles.webChipTxt, itemSheetReason === r && styles.webChipTxtActive]}>{r}</Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}
                      {(itemSheetMode === 'waste' || itemSheetMode === 'count') && (
                        <TextInput style={styles.modalInput} placeholder={itemSheetMode === 'waste' ? 'Fire nedeni' : 'Sayım gerekçesi'}
                          placeholderTextColor={THEME.colors.textLight} value={itemSheetReason} onChangeText={setItemSheetReason} maxLength={300} />
                      )}
                      {itemSheetMode === 'cost' && (
                        <Text style={{ fontSize: 12, color: '#475569', marginBottom: 8 }}>
                          Maliyet değişikliği reçete maliyetlerini ve food cost oranlarını etkiler; denetim izine yazılır.
                        </Text>
                      )}
                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity style={styles.modalSubmitBtn} onPress={submit}>
                          <Text style={styles.modalSubmitTxt}>Kaydet</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setItemSheetMode(null)}>
                          <Text style={styles.modalCancelTxt}>Geri</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  )}
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Muhasebe: ödeme kaydı (kısmi ödeme ve ödeme yöntemi) */}
      <Modal visible={!!payTarget} animationType="fade" transparent onRequestClose={() => setPayTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {payTarget && (() => {
              const remaining = Number(payTarget.remainingAmount) > 0 ? Number(payTarget.remainingAmount) : Number(payTarget.amount) - Number(payTarget.paidAmount || 0);
              return (
                <View>
                  <View style={styles.webModalHeader}>
                    <View style={{ flex: 1, paddingRight: 8 }}>
                      <Text style={styles.modalTitle} numberOfLines={1}>Ödeme kaydı</Text>
                      <Text style={styles.webModalSub} numberOfLines={1}>{payTarget.title}</Text>
                    </View>
                    <TouchableOpacity onPress={() => setPayTarget(null)}>
                      <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
                    </TouchableOpacity>
                  </View>
                  <Text style={{ fontSize: 12.5, color: '#475569', marginBottom: 6 }}>
                    Toplam {Number(payTarget.amount).toLocaleString('tr-TR')} ₺ · Kalan {remaining.toLocaleString('tr-TR')} ₺
                  </Text>
                  <TextInput style={styles.modalInput} keyboardType="decimal-pad" placeholder="Ödenen tutar (₺)"
                    placeholderTextColor={THEME.colors.textLight} value={payAmount} onChangeText={setPayAmount} />
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                    {[['BANK_TRANSFER', 'Banka / Havale'], ['CASH', 'Kasadan nakit'], ['CREDIT_CARD', 'Şirket kartı']].map(([id, label]) => (
                      <TouchableOpacity key={id} onPress={() => setPayMethod(id)}
                        style={[styles.webChipBtn, payMethod === id && styles.webChipBtnActive]}>
                        <Text style={[styles.webChipTxt, payMethod === id && styles.webChipTxtActive]}>{label}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <TextInput style={styles.modalInput} placeholder="Açıklama / dekont no (isteğe bağlı)"
                    placeholderTextColor={THEME.colors.textLight} value={payNote} onChangeText={setPayNote} maxLength={300} />
                  <View style={{ flexDirection: 'row', gap: 10, marginTop: 4 }}>
                    <TouchableOpacity
                      style={styles.modalSubmitBtn}
                      onPress={async () => {
                        const amount = parseFloat(String(payAmount).replace(',', '.'));
                        if (!(amount > 0)) { showToast('⚠️ Ödenen tutarı girin'); return; }
                        if (amount - remaining > 0.005) { showToast('⚠️ Tutar kalan borçtan büyük olamaz'); return; }
                        const target = payTarget;
                        setPayTarget(null);
                        const res = await apiUpdateExpense(target.id, {
                          paymentStatus: amount + 0.005 >= remaining ? 'PAID' : 'PARTIAL',
                          paymentAmount: amount, paymentMethod: payMethod, paymentNote: payNote.trim() || undefined,
                        });
                        if (res && res.success) { showToast(`✓ "${target.title}" için ${amount.toLocaleString('tr-TR')} ₺ ödeme kaydedildi`); refreshAllData(); }
                      }}
                    >
                      <Text style={styles.modalSubmitTxt}>Ödemeyi kaydet</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setPayTarget(null)}>
                      <Text style={styles.modalCancelTxt}>Vazgeç</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Yönetici: personel bilgisi / geçici şifre */}
      <Modal visible={!!userAction} animationType="fade" transparent onRequestClose={() => setUserAction(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {userAction && (
              <View>
                <View style={styles.webModalHeader}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={styles.modalTitle} numberOfLines={1}>{userAction.type === 'profile' ? 'Personel bilgileri' : 'Geçici şifre ver'}</Text>
                    <Text style={styles.webModalSub} numberOfLines={1}>@{userAction.user.username}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setUserAction(null)}>
                    <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
                  </TouchableOpacity>
                </View>
                {userAction.type === 'profile' ? (
                  <View>
                    <TextInput style={styles.modalInput} placeholder="Ad soyad" placeholderTextColor={THEME.colors.textLight}
                      value={userActionName} onChangeText={setUserActionName} maxLength={100} />
                    <TextInput style={styles.modalInput} placeholder="E-posta (isteğe bağlı)" placeholderTextColor={THEME.colors.textLight}
                      value={userActionEmail} onChangeText={setUserActionEmail} keyboardType="email-address" autoCapitalize="none" />
                  </View>
                ) : (
                  <View>
                    <Text style={{ fontSize: 12, color: '#475569', marginBottom: 6 }}>
                      Personel ilk girişte bu şifreyi değiştirmek zorunda kalır; açık oturumları kapatılır.
                    </Text>
                    <TextInput style={styles.modalInput} placeholder="Geçici şifre (en az 8 karakter, harf + rakam)" placeholderTextColor={THEME.colors.textLight}
                      value={userActionPassword} onChangeText={setUserActionPassword} autoCapitalize="none" />
                  </View>
                )}
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  <TouchableOpacity
                    style={styles.modalSubmitBtn}
                    onPress={async () => {
                      const { type, user: target } = userAction;
                      const res = type === 'profile'
                        ? await apiUpdateUserProfile(target.id, { name: userActionName.trim(), email: userActionEmail.trim() || null })
                        : await apiResetUserPassword(target.id, userActionPassword);
                      if (res && res.success) {
                        showToast(type === 'profile' ? '✓ Personel bilgileri güncellendi' : `✓ ${target.name} için geçici şifre belirlendi`);
                        setUserAction(null);
                        refreshAllData();
                      }
                    }}
                  >
                    <Text style={styles.modalSubmitTxt}>Kaydet</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setUserAction(null)}>
                    <Text style={styles.modalCancelTxt}>Vazgeç</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

      {/* Müdür: gerekçeli satış iptali (stok geri alınır; Muhasebe ve Yönetici bilgilendirilir) */}
      <Modal visible={!!voidTarget} animationType="fade" transparent onRequestClose={() => setVoidTarget(null)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: '#fca5a5', borderWidth: 2 }]}>
            {voidTarget && (
              <View>
                <Text style={[styles.modalTitle, { color: '#991b1b' }]}>Satışı iptal et</Text>
                <Text style={{ fontSize: 13, color: '#334155', marginVertical: 6 }} numberOfLines={2}>
                  {voidTarget.time} · {voidTarget.recipeName || voidTarget.productName} × {voidTarget.quantity} · {Number(voidTarget.totalRevenue || 0).toLocaleString('tr-TR')} ₺
                </Text>
                <TextInput style={[styles.modalInput, { height: 70, textAlignVertical: 'top' }]} multiline
                  placeholder="İptal gerekçesi (zorunlu, en az 5 karakter)" placeholderTextColor={THEME.colors.textLight}
                  value={voidReason} onChangeText={setVoidReason} maxLength={300} />
                <View style={{ flexDirection: 'row', gap: 10, marginTop: 6 }}>
                  <TouchableOpacity
                    style={[styles.modalSubmitBtn, { backgroundColor: '#dc2626' }]}
                    onPress={async () => {
                      if (voidReason.trim().length < 5) { showToast('⚠️ Gerekçe en az 5 karakter olmalı'); return; }
                      const target = voidTarget;
                      setVoidTarget(null);
                      const res = await apiVoidSale(target.id, voidReason.trim());
                      if (res && res.success) { showToast('✓ Satış iptal edildi; stok geri alındı'); refreshAllData(); }
                    }}
                  >
                    <Text style={styles.modalSubmitTxt}>İptal et</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setVoidTarget(null)}>
                    <Text style={styles.modalCancelTxt}>Vazgeç</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>
        </View>
      </Modal>

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


      {/* Muhasebe: Faturalandır ve Mali Müşavire Gönder */}
      <Modal visible={!!submitTargetMobile} animationType="fade" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { borderColor: '#a7f3d0', borderWidth: 2 }]}>
            <View style={styles.webModalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.modalTitle, { color: '#065f46' }]}>🚀 Faturalandır & Müşavire Gönder</Text>
                <Text style={styles.webModalSub}>Belge bilgisi tamamlanır; tutar değiştirilemez</Text>
              </View>
              <TouchableOpacity onPress={() => setSubmitTargetMobile(null)}>
                <Text style={{ fontSize: 20, color: THEME.colors.textLight }}>✕</Text>
              </TouchableOpacity>
            </View>
            {submitTargetMobile && (
              <View style={{ backgroundColor: '#ecfdf5', padding: 10, borderRadius: 8, marginBottom: 12 }}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: '#065f46' }}>{submitTargetMobile.title}</Text>
                <Text style={{ fontSize: 11, color: '#047857', marginTop: 2 }}>
                  {parseFloat(submitTargetMobile.amount || 0).toLocaleString('tr-TR')} ₺ •{' '}
                  {parseFloat(submitTargetMobile.remainingAmount || 0) > 0
                    ? `Kalan borç ${parseFloat(submitTargetMobile.remainingAmount).toLocaleString('tr-TR')} ₺ (vadeli fatura da gönderilebilir)`
                    : 'Tamamı ödendi'}
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 6 }}>Fatura / fiş numarası (zorunlu):</Text>
            <TextInput style={styles.modalInput} value={submitInvoiceNo} onChangeText={setSubmitInvoiceNo}
              placeholder="Örn: ABC2026000123" placeholderTextColor={THEME.colors.textLight} maxLength={100} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 6 }}>Karşı taraf / tedarikçi (zorunlu):</Text>
            <TextInput style={styles.modalInput} value={submitCounterparty} onChangeText={setSubmitCounterparty}
              placeholder="Örn: Enerjisa" placeholderTextColor={THEME.colors.textLight} maxLength={200} />
            <Text style={{ fontSize: 11, fontWeight: '700', color: THEME.colors.textMuted, marginBottom: 6 }}>Müşavire not (isteğe bağlı):</Text>
            <TextInput style={styles.modalInput} value={submitNote} onChangeText={setSubmitNote}
              placeholder="Örn: Dekont ekte" placeholderTextColor={THEME.colors.textLight} maxLength={500} />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
              <TouchableOpacity style={[styles.modalSubmitBtn, { backgroundColor: '#059669' }]} onPress={handleConfirmSubmitMobile}>
                <Text style={styles.modalSubmitTxt}>🚀 Müşavire Gönder</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalCancelBtn} onPress={() => setSubmitTargetMobile(null)}>
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
                  { id: 'management', label: '🏛️ Yönetim', color: '#0f766e' },
                ].filter((ch) => (CHAT_CHANNEL_ROLES[ch.id] || []).includes(currentRole)).map((ch) => (
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
                      {ch.label}{chatUnread[ch.id] > 0 && activeChatChannel !== ch.id ? ` (${chatUnread[ch.id] > 99 ? '99+' : chatUnread[ch.id]})` : ''}
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

      {/* Alt menü: sabit, en fazla 5 sekme; fazlası "Daha" sayfasında. Tek ekranlı rollerde gizlenir. */}
      {showBottomNav && (
        <View style={[styles.bottomNavAndroid, { paddingBottom: androidBottomPadding, height: 60 + androidBottomPadding }]}>
          {navPrimary.map((id) => {
            const active = currentScreen === id || (id === 'cashier' && currentScreen === 'accounting');
            const badge = navBadge(id);
            return (
              <TouchableOpacity key={id} style={styles.navTab} onPress={() => navigateTo(id)} activeOpacity={0.75}>
                <View style={[styles.navPill, active && styles.navPillActive]}>
                  <Text style={styles.navIcon}>{NAV_ICONS[id]}</Text>
                  {badge > 0 && (
                    <View style={styles.navBadge}><Text style={styles.navBadgeTxt}>{badge > 99 ? '99+' : badge}</Text></View>
                  )}
                </View>
                <Text style={[styles.navLabel, active && styles.navLabelActive]} numberOfLines={1}>{navLabel(id)}</Text>
              </TouchableOpacity>
            );
          })}
          {navOverflow.length > 0 && (
            <TouchableOpacity style={styles.navTab} onPress={() => setShowMoreNav(true)} activeOpacity={0.75}>
              <View style={[styles.navPill, navOverflow.includes(currentScreen) && styles.navPillActive]}>
                <Text style={[styles.navIcon, { color: '#d1fae5' }]}>☰</Text>
              </View>
              <Text style={[styles.navLabel, navOverflow.includes(currentScreen) && styles.navLabelActive]} numberOfLines={1}>
                {navOverflow.includes(currentScreen) ? navLabel(currentScreen) : navLabels.more}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      <Modal visible={showMoreNav} transparent animationType="fade" onRequestClose={() => setShowMoreNav(false)}>
        <TouchableOpacity style={styles.moreOverlay} activeOpacity={1} onPress={() => setShowMoreNav(false)}>
          <View style={[styles.moreSheet, { paddingBottom: 12 + androidBottomPadding }]}>
            {navOverflow.map((id) => (
              <TouchableOpacity
                key={id}
                style={[styles.moreRow, currentScreen === id && styles.moreRowActive]}
                onPress={() => { setShowMoreNav(false); navigateTo(id); }}
                activeOpacity={0.75}
              >
                <Text style={styles.moreIcon}>{NAV_ICONS[id]}</Text>
                <Text style={styles.moreLabel} numberOfLines={1}>{navLabel(id)}</Text>
                <Text style={styles.dashChevron}>›</Text>
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
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
    position: 'absolute',
    left: 12,
    right: 12,
    zIndex: 100,
    backgroundColor: '#0a1f11',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
  snackText: {
    color: '#ecfdf5',
    fontSize: 13,
    fontWeight: '700',
  },
  content: {
    padding: 16,
  },
  // Sabit liste çubuğu: tam opak, kenar boşluklarını da kaplar (arkadaki kartlar görünmez)
  stickyBar: {
    backgroundColor: THEME.colors.background,
    marginHorizontal: -16,
    marginTop: -16,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#dbe7df',
    elevation: 3,
    shadowColor: '#0a1f11',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
  },
  stickyRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stickyCount: {
    fontSize: 11.5,
    fontWeight: '800',
    color: '#475569',
    marginLeft: 8,
    marginBottom: 8,
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
  navTab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 6,
    minWidth: 0,
  },
  navPill: {
    width: 48,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  navPillActive: {
    backgroundColor: 'rgba(16, 185, 129, 0.28)',
  },
  navIcon: {
    fontSize: 17,
  },
  navLabel: {
    fontSize: 11,
    color: '#96be9f',
    fontWeight: '700',
    marginTop: 2,
    maxWidth: '96%',
  },
  navLabelActive: {
    color: '#34d399',
    fontWeight: '800',
  },
  navBadge: {
    position: 'absolute',
    top: -4,
    right: 2,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 3,
    borderRadius: 8,
    backgroundColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  navBadgeTxt: {
    color: '#fff',
    fontSize: 9,
    fontWeight: '900',
  },
  moreOverlay: {
    flex: 1,
    backgroundColor: 'rgba(7, 25, 14, 0.45)',
    justifyContent: 'flex-end',
  },
  moreSheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 18,
    borderTopRightRadius: 18,
    paddingTop: 10,
    paddingHorizontal: 12,
  },
  moreRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  moreRowActive: {
    backgroundColor: '#ecfdf5',
  },
  moreIcon: {
    fontSize: 20,
    width: 34,
  },
  moreLabel: {
    flex: 1,
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  expChipRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  expChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    borderWidth: 1,
  },
  expChipOk: {
    backgroundColor: '#ecfdf5',
    borderColor: '#a7f3d0',
  },
  expChipWarn: {
    backgroundColor: '#fffbeb',
    borderColor: '#fde68a',
  },
  expChipMuted: {
    backgroundColor: '#f8fafc',
    borderColor: '#e2e8f0',
  },
  expChipTxt: {
    fontSize: 11,
    fontWeight: '800',
  },
  expDueTxt2: {
    fontSize: 11,
    fontWeight: '600',
    color: '#64748b',
  },
  expDueTxt: {
    fontSize: 11,
    fontWeight: '700',
    color: '#b91c1c',
  },
  expRejectBox: {
    marginTop: 8,
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#fef2f2',
    borderWidth: 1,
    borderColor: '#fecaca',
  },
  expRejectTxt: {
    fontSize: 12,
    color: '#991b1b',
    fontWeight: '600',
  },
  acctHead: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  acctTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '900',
    color: '#0a1f11',
  },
  acctReadOnly: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
  },
  acctReadOnlyTxt: {
    fontSize: 11,
    fontWeight: '800',
    color: '#475569',
  },
  acctStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
    marginBottom: 10,
  },
  acctStripCell: {
    flex: 1,
    paddingHorizontal: 10,
    minWidth: 0,
  },
  acctStripDiv: {
    width: 1,
    alignSelf: 'stretch',
    backgroundColor: '#f1f5f9',
  },
  acctStripLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  acctStripValue: {
    fontSize: 16,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 2,
  },
  acctActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 10,
  },
  acctBtn: {
    flex: 1,
    paddingVertical: 11,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  acctBtnPrimary: {
    flex: 1.4,
    backgroundColor: '#047857',
    borderColor: '#047857',
  },
  acctBtnIcon: {
    flex: 0,
    paddingHorizontal: 16,
  },
  acctBtnTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#334155',
  },
  acctBtnPrimaryTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#ffffff',
  },
  acctExportLink: {
    alignSelf: 'flex-end',
    marginTop: -4,
    marginBottom: 8,
    paddingVertical: 4,
  },
  acctExportLinkTxt: {
    fontSize: 12,
    fontWeight: '800',
    color: '#047857',
  },
  segment: {
    flexDirection: 'row',
    backgroundColor: '#e8f2ec',
    borderRadius: 12,
    padding: 3,
    marginBottom: 10,
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 9,
    borderRadius: 10,
    alignItems: 'center',
  },
  segmentItemActive: {
    backgroundColor: '#ffffff',
    elevation: 1,
  },
  segmentTxt: {
    fontSize: 13,
    fontWeight: '700',
    color: '#475569',
  },
  segmentTxtActive: {
    color: '#047857',
    fontWeight: '800',
  },
  dashHello: {
    fontSize: 20,
    fontWeight: '900',
    color: '#0a1f11',
  },
  dashSub: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 12,
  },
  dashCard: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  dashCardHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dashCardTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#0f172a',
    marginBottom: 4,
  },
  dashCardMeta: {
    fontSize: 12,
    fontWeight: '800',
    color: '#64748b',
  },
  dashRowBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dashTaskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
  },
  dashTaskIcon: {
    fontSize: 17,
    width: 30,
  },
  dashTaskLabel: {
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    color: '#1e293b',
  },
  dashCount: {
    minWidth: 28,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
  },
  dashCountWarn: {
    backgroundColor: '#fef3c7',
  },
  dashCountTxt: {
    fontSize: 12,
    fontWeight: '900',
    color: '#334155',
  },
  dashCountTxtWarn: {
    color: '#b45309',
  },
  dashChevron: {
    fontSize: 20,
    color: '#94a3b8',
    marginLeft: 8,
  },
  dashKpiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  dashKpi: {
    width: '48.5%',
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    padding: 12,
    marginBottom: 8,
  },
  dashKpiLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: '#64748b',
  },
  dashKpiValue: {
    fontSize: 19,
    fontWeight: '900',
    color: '#0f172a',
    marginTop: 4,
  },
  dashKpiHint: {
    fontSize: 11,
    color: '#94a3b8',
    marginTop: 2,
  },
  dashAlertRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 9,
  },
  dashDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 5,
    marginRight: 10,
  },
  dashAlertTitle: {
    fontSize: 13,
    fontWeight: '800',
    color: '#0f172a',
  },
  dashAlertMsg: {
    fontSize: 12,
    color: '#64748b',
    marginTop: 2,
  },
  dashMoreBtn: {
    marginTop: 4,
    paddingVertical: 10,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  dashMoreTxt: {
    fontSize: 13,
    fontWeight: '800',
    color: '#047857',
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
  pagerRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8,
    marginTop: 6, marginBottom: 12, paddingVertical: 8, paddingHorizontal: 10,
    backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dbe7df',
  },
  pagerInfo: { fontSize: 12, fontWeight: '700', color: '#64748b' },
  pagerPage: { fontSize: 13, fontWeight: '800', color: '#0f172a', minWidth: 44, textAlign: 'center' },
  pagerBtn: {
    minWidth: 36, height: 36, borderRadius: 10, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#a7f3d0', backgroundColor: '#ecfdf5',
  },
  pagerBtnDisabled: { borderColor: '#e2e8f0', backgroundColor: '#f8fafc' },
  pagerBtnTxt: { fontSize: 16, fontWeight: '900', color: '#047857' },
  fBox: { backgroundColor: '#ffffff', borderRadius: 12, borderWidth: 1, borderColor: '#dbe7df', paddingVertical: 8, paddingHorizontal: 10, marginBottom: 10 },
  fToggle: { paddingVertical: 4 },
  fToggleTxt: { fontSize: 12.5, fontWeight: '800', color: '#334155' },
  fClear: { fontSize: 12, fontWeight: '800', color: '#b91c1c' },
  fRowTitle: { fontSize: 10.5, fontWeight: '800', color: '#94a3b8', letterSpacing: 0.6, marginBottom: 4, textTransform: 'uppercase' },
  fChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: '#dbe7df', backgroundColor: '#ffffff' },
  fChipOn: { borderColor: '#059669', backgroundColor: '#059669' },
  fChipTxt: { fontSize: 12, fontWeight: '700', color: '#334155' },
  fChipTxtOn: { color: '#ffffff' },
  advMetaTxt: { fontSize: 11.5, color: '#64748b', marginTop: 6 },
  advNoteTxt: { fontSize: 12, color: '#7c2d12', backgroundColor: '#fff7ed', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, marginTop: 6 },
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
    marginBottom: 0,
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
