// Çevrimdışı çalışma: internet kesildiğinde masa siparişi, tahsilat ve servis işaretleri cihazda sıraya alınır,
// bağlantı gelince aynı Idempotency-Key ile sırayla gönderilir. İstek sunucuya ulaşıp yanıt cihaza
// ulaşmadıysa tekrar gönderim işlemi ikinci kez yapmaz (sunucu ilk yanıtı aynen döndürür).
// Okuma tarafında masa / menü / adisyon ekranlarının son başarılı yanıtı saklanır; bağlantı yokken gösterilir.

let AsyncStorage = null;
try { AsyncStorage = require('@react-native-async-storage/async-storage').default; } catch (_) { AsyncStorage = null; }

const QUEUE_KEY = 'gs.offlineQueue.v1';
const CACHE_KEY = 'gs.offlineCache.v1';
const MAX_QUEUE = 200;
const MAX_CACHE = 60;

/** Bağlantı yokken sıraya alınabilecek yazma işlemleri (yeniden göndermesi güvenli, sunucuda idempotent) */
const QUEUEABLE = [
  ['POST', /^\/pos\/checks\/\d+\/items$/],
  ['POST', /^\/pos\/checks\/\d+\/payments$/],
  ['POST', /^\/pos\/checks\/\d+\/pay$/],
  ['PUT', /^\/pos\/items\/\d+\/status$/],
  ['POST', /^\/print\/checks\/\d+/],
  ['POST', /^\/fiscal\/checks\/\d+\/okc$/],
];
/** Çevrimdışıyken son hali gösterilebilecek okumalar */
const CACHEABLE = [/^\/pos\/tables$/, /^\/pos\/menu$/, /^\/pos\/summary$/, /^\/pos\/checks\/\d+$/, /^\/pos\/kitchen$/];

let queue = [];
let cache = {};
let loaded = false;
let online = true;
let flushing = false;
let owner = null;
const listeners = new Set();

export const newIdempotencyKey = () =>
  `m-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;

export const isQueueable = (method, path) => QUEUEABLE.some(([m, re]) => m === method && re.test(path));
export const isCacheable = (path) => CACHEABLE.some((re) => re.test(path));

const emit = () => {
  const state = getOfflineState();
  listeners.forEach((fn) => { try { fn(state); } catch (_) { /* yoksay */ } });
};

export const getOfflineState = () => ({
  online,
  pending: queue.filter((q) => !owner || q.owner === owner).length,
  flushing,
});

export const subscribeOffline = (fn) => {
  listeners.add(fn);
  fn(getOfflineState());
  return () => listeners.delete(fn);
};

const persistQueue = async () => {
  if (!AsyncStorage) return;
  try { await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue)); } catch (_) { /* yoksay */ }
};
let cacheTimer = null;
const persistCache = () => {
  if (!AsyncStorage) return;
  clearTimeout(cacheTimer);
  cacheTimer = setTimeout(async () => {
    try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache)); } catch (_) { /* yoksay */ }
  }, 800);
};

export const loadOfflineStore = async () => {
  if (loaded || !AsyncStorage) { loaded = true; return; }
  try {
    const [q, c] = await Promise.all([AsyncStorage.getItem(QUEUE_KEY), AsyncStorage.getItem(CACHE_KEY)]);
    const parsedQ = q ? JSON.parse(q) : [];
    // Bellekte oturum açılmadan önce sıraya giren işlem varsa onları koru
    queue = [...(Array.isArray(parsedQ) ? parsedQ : []), ...queue];
    cache = { ...(c ? JSON.parse(c) : {}), ...cache };
  } catch (_) { /* bozuk kayıt: yok say */ }
  loaded = true;
  emit();
};

/** Kuyruk kullanıcıya bağlıdır: başka bir kullanıcının bekleyen işlemi onun oturumuyla gönderilir */
export const setOfflineOwner = (username) => {
  owner = username || null;
  emit();
};

export const setOnline = (value) => {
  if (online === value) return;
  online = value;
  emit();
};

export const enqueue = async ({ method, path, body, key }) => {
  if (!loaded) await loadOfflineStore();
  if (queue.some((q) => q.key === key)) return;
  if (queue.length >= MAX_QUEUE) throw new Error('Çevrimdışı kuyruk dolu');
  queue.push({ method, path, body, key, owner, at: new Date().toISOString() });
  await persistQueue();
  emit();
};

export const cachePut = (userKey, path, data) => {
  const k = `${userKey || ''}|${path}`;
  cache[k] = { data, at: Date.now() };
  const keys = Object.keys(cache);
  if (keys.length > MAX_CACHE) {
    keys.sort((a, b) => cache[a].at - cache[b].at).slice(0, keys.length - MAX_CACHE).forEach((x) => delete cache[x]);
  }
  persistCache();
};

export const cacheGet = (userKey, path) => cache[`${userKey || ''}|${path}`] || null;

/**
 * Sıradaki işlemleri sırayla gönderir. send({method,path,body,key}) => {ok,status,message}
 * Ağ hatasında durur (sıra korunur); 4xx kalıcı redde işlem sıradan çıkar ve onReject ile bildirilir.
 */
export const flushQueue = async (send, onReject) => {
  if (flushing) return;
  if (!loaded) await loadOfflineStore();
  const mine = queue.filter((q) => !owner || q.owner === owner);
  if (!mine.length) return;
  flushing = true;
  emit();
  let sent = 0;
  try {
    for (const op of mine) {
      const res = await send(op);
      if (res.status === 0 || res.status >= 500 || res.status === 401) { setOnline(res.status !== 0); break; }
      queue = queue.filter((q) => q.key !== op.key);
      await persistQueue();
      if (res.ok) sent += 1;
      else if (onReject) onReject(op, res.message);
    }
  } finally {
    flushing = false;
    emit();
  }
  return sent;
};

/** Testler ve "kuyruğu temizle" için */
export const describeQueue = () => queue.filter((q) => !owner || q.owner === owner).map((q) => ({ ...q }));
