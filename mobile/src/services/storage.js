// GastroSync Mobil Kalıcı Veri & Çift Yönlü Senkronizasyon Katmanı
// Hem React Native Web (localStorage), hem mobil cihazlar için kalıcı veri saklar.
// Uygulama kapatılıp açılsa bile yapılan tüm Muhasebe & Mali Müşavir işlemleri korunur.

import { INITIAL_EXPENSES } from '../data/inventoryData';

const EXPENSES_STORAGE_KEY = 'gastrosync-expense-storage';
const NOTIFS_STORAGE_KEY = 'gastrosync-notifications-storage';

// Bellek içi yedek önbellek (Memory Cache)
let memoryExpenses = null;
let memoryNotifications = null;

// Tarayıcı / React Native Web localStorage kontrolü
export const getLocalStorage = () => {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
  } catch (_) {}
  return null;
};

// ==========================================
// 1. GİDERLER (EXPENSES) KALICI SAKLAMA
// ==========================================

export const getStoredExpenses = () => {
  if (memoryExpenses && Array.isArray(memoryExpenses) && memoryExpenses.length > 0) {
    return memoryExpenses;
  }

  const storage = getLocalStorage();
  if (storage) {
    try {
      const raw = storage.getItem(EXPENSES_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // Zustand persist formatı kontrolü ({ state: { expenses: [...] } } veya doğrudan dizi)
        const list = Array.isArray(parsed) ? parsed : parsed?.state?.expenses;
        if (Array.isArray(list) && list.length > 0) {
          memoryExpenses = list;
          return list;
        }
      }
    } catch (e) {
      console.log('[Storage] Giderler okunurken hata:', e);
    }
  }

  // Varsayılan zengin mock veri seti
  memoryExpenses = [...INITIAL_EXPENSES];
  return memoryExpenses;
};

export const saveStoredExpenses = (expensesList) => {
  if (!Array.isArray(expensesList)) return;
  memoryExpenses = [...expensesList];

  const storage = getLocalStorage();
  if (storage) {
    try {
      // Hem doğrudan dizi hem de Zustand uyumlu state olarak kaydeder
      storage.setItem(EXPENSES_STORAGE_KEY, JSON.stringify(expensesList));
    } catch (e) {
      console.log('[Storage] Giderler kaydedilirken hata:', e);
    }
  }
};

// ==========================================
// 2. BİLDİRİMLER (NOTIFICATIONS) KALICI SAKLAMA
// ==========================================

const INITIAL_NOTIFICATIONS = [
  {
    id: 101,
    title: '📋 Yeni Gider İnceleme Bekliyor (Taslak)',
    message: 'Canan Öztürk (Kasa) tarafından "Taze Sebze & Meyve Hal Alımı (16.400 ₺)" kaydı girildi. Mali Müşavir defter onayı bekleniyor.',
    targetRole: 'FINANCIAL_ADVISOR',
    senderName: 'Canan Öztürk (Kasa)',
    type: 'EXPENSE_APPROVAL',
    relatedEntityId: 15,
    isRead: false,
    createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
  },
  {
    id: 102,
    title: '⚠️ Gider Düzeltme Bekliyor (Ret)',
    message: 'SMMM Selim Aydın tarafından "Paket Servis Kurye Yakıt Masrafı (3.950 ₺)" kaydı reddedildi. Not: Taşıt tanıma fişleri ile plaka eşleşmeli.',
    targetRole: 'ACCOUNTANT',
    senderName: 'SMMM Selim Aydın',
    type: 'EXPENSE_REJECTED',
    relatedEntityId: 19,
    isRead: false,
    createdAt: new Date(Date.now() - 35 * 60000).toISOString(),
  },
  {
    id: 103,
    title: '✓ Gider Deftere İşlendi & Kesinleşti',
    message: 'SMMM Selim Aydın tarafından "Sanayi Elektrik Faturası (18.400 ₺)" resmi yevmiye defterine onaylandı (#YEV-4).',
    targetRole: 'ACCOUNTANT',
    senderName: 'SMMM Selim Aydın',
    type: 'EXPENSE_APPROVAL',
    relatedEntityId: 4,
    isRead: true,
    createdAt: new Date(Date.now() - 120 * 60000).toISOString(),
  },
];

export const getStoredNotifications = () => {
  if (memoryNotifications && Array.isArray(memoryNotifications)) {
    return memoryNotifications;
  }

  const storage = getLocalStorage();
  if (storage) {
    try {
      const raw = storage.getItem(NOTIFS_STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          memoryNotifications = list;
          return list;
        }
      }
    } catch (e) {
      console.log('[Storage] Bildirimler okunurken hata:', e);
    }
  }

  memoryNotifications = [...INITIAL_NOTIFICATIONS];
  return memoryNotifications;
};

export const saveStoredNotifications = (notificationsList) => {
  if (!Array.isArray(notificationsList)) return;
  memoryNotifications = [...notificationsList];

  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.setItem(NOTIFS_STORAGE_KEY, JSON.stringify(notificationsList));
    } catch (e) {
      console.log('[Storage] Bildirimler kaydedilirken hata:', e);
    }
  }
};

// ==========================================
// 3. EKİP MESAJLAŞMA (TEAM CHAT) KALICI SAKLAMA
// ==========================================
const CHAT_STORAGE_KEY = 'gastrosync_team_chat';
let memoryChat = null;

const INITIAL_CHAT_MESSAGES = [
  { id: 1, channelId: 'kitchen', sender: 'Mehmet Şef', role: 'chef', text: 'Depoda pancar son 2 kg kaldı! Akşamki kış menüsü ve pancarlı meze servisi için acil 15 kg takviye gerekiyor.', time: '10:15', avatar: 'MŞ', priority: 'urgent' },
  { id: 2, channelId: 'cashier', sender: 'Canan Kasa', role: 'accountant', text: 'Şefin pancar talebi üzerine toptancıya 1.500 TL nakit kasa çıkışı yapıldı ve fiilen ödendi. Onay masasına iletildi.', time: '10:45', avatar: 'CK', priority: 'normal' },
  { id: 3, channelId: 'kitchen', sender: 'Ali Depocu', role: 'warehouse', text: 'Halden 15 kg taze pancar geldi, tartıp mal kabul terminalinden barkodla stoğa işledim şefim.', time: '11:30', avatar: 'AD', priority: 'normal' },
  { id: 4, channelId: 'cashier', sender: 'SMMM Selim', role: 'financial_advisor', text: 'Pancar alım faturası ile elektrik faturası dekontunu inceledim ve resmi yevmiye defterine onayladım.', time: '12:00', avatar: 'SS', priority: 'normal' },
  { id: 5, channelId: 'shift', sender: 'Zeynep Müdür', role: 'manager', text: 'Akşam 20:00 için 8 kişilik VIP rezervasyon var (Masa 4-5 birleştirilecek). Tatlı porsiyonları kontrol edilsin.', time: '09:00', avatar: 'ZM', priority: 'urgent' },
];

export const getStoredChatMessages = () => {
  if (memoryChat && Array.isArray(memoryChat) && memoryChat.length > 0) {
    return memoryChat;
  }
  const storage = getLocalStorage();
  if (storage) {
    try {
      const raw = storage.getItem(CHAT_STORAGE_KEY);
      if (raw) {
        const list = JSON.parse(raw);
        if (Array.isArray(list) && list.length > 0) {
          memoryChat = list;
          return list;
        }
      }
    } catch (_) {}
  }
  memoryChat = [...INITIAL_CHAT_MESSAGES];
  return memoryChat;
};

export const saveStoredChatMessages = (messagesList) => {
  if (!Array.isArray(messagesList)) return;
  memoryChat = [...messagesList];
  const storage = getLocalStorage();
  if (storage) {
    try {
      storage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messagesList));
    } catch (_) {}
  }
};
