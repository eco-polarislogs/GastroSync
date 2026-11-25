import axiosClient, { unwrap } from './axiosClient'

// Tüm backend uç noktaları tek yerde. Bileşenler URL üretmez.
const get = async (url, params) => unwrap(await axiosClient.get(url, { params }))
const post = async (url, body) => unwrap(await axiosClient.post(url, body))
const put = async (url, body) => unwrap(await axiosClient.put(url, body))
const del = async (url) => unwrap(await axiosClient.delete(url))

export const authApi = {
  login: (identifier, password) => post('/auth/login', { identifier, password }),
  me: () => get('/auth/me'),
  changePassword: (currentPassword, newPassword) => post('/auth/change-password', { currentPassword, newPassword }),
  demoAccounts: () => get('/auth/demo-accounts'),
  logout: (refreshToken) => post('/auth/logout', { refreshToken }),
  logoutAll: () => post('/auth/logout-all'),
  sessions: () => get('/auth/sessions'),
  requestAccountDeletion: (reason) => post('/users/me/deletion-request', { reason }),
}

export const userApi = {
  getAll: () => get('/users'),
  search: (params) => get('/users/search', params),
  roles: () => get('/auth/roles'),
  create: (data) => post('/users', data),
  updateProfile: (id, data) => put(`/users/${id}`, data),
  updateRole: (id, role) => put(`/users/${id}/role`, { role }),
  setActive: (id, active) => put(`/users/${id}/status`, { active }),
  resetPassword: (id, temporaryPassword) => post(`/users/${id}/reset-password`, { temporaryPassword }),
  revokeSessions: (id) => post(`/users/${id}/revoke-sessions`),
  delete: (id) => del(`/users/${id}`),
}

export const inventoryApi = {
  getAll: () => get('/inventory'),
  getByBarcode: (barcode) => get(`/inventory/barcode/${encodeURIComponent(barcode)}`),
  create: (item) => post('/inventory', item),
  update: (id, item) => put(`/inventory/${id}`, item),
  delete: (id) => del(`/inventory/${id}`),
  receive: (id, { quantity, unitCost, documentNo, expenseId }) =>
    post(`/inventory/${id}/receive`, { quantity, unitCost, documentNo, expenseId }),
  waste: (id, { quantity, reason }) => post(`/inventory/${id}/waste`, { quantity, reason }),
  adjust: (id, { countedQuantity, reason }) => post(`/inventory/${id}/adjust`, { countedQuantity, reason }),
  purchaseRequest: (id, { quantity, urgent, note }) => post(`/inventory/${id}/purchase-request`, { quantity, urgent, note }),
  pendingDeliveries: () => get('/inventory/pending-deliveries'),
  recentTransactions: () => get('/inventory/transactions/recent'),
  transactionsPage: (params) => get('/inventory/transactions', params),
  itemTransactions: (id) => get(`/inventory/${id}/transactions`),
  valuation: () => get('/inventory/valuation'),
}

export const recipeApi = {
  getAll: () => get('/recipes'),
  create: (r) => post('/recipes', r),
  update: (id, r) => put(`/recipes/${id}`, r),
  updatePrice: (id, salePrice, reason) => put(`/recipes/${id}/price`, { salePrice, reason }),
  delete: (id) => del(`/recipes/${id}`),
}

export const analyticsApi = {
  menuPricing: (days) => get('/analytics/menu-pricing', days ? { days } : undefined),
}

export const salesApi = {
  today: () => get('/sales/today'),
  summary: () => get('/sales/summary'),
  range: (from, to, includeVoided = true) => get('/sales', { from, to, includeVoided }),
  search: (params) => get('/sales/search', params),
  rangeSummary: (from, to) => get('/sales/range-summary', { from, to }),
  order: (payload) => post('/sales/order', payload),
  void: (id, reason) => post(`/sales/${id}/void`, { reason }),
}

export const expenseApi = {
  getAll: (period) => get('/expenses', period ? { period } : undefined),
  search: (params) => get('/expenses/search', params),
  history: (id) => get(`/expenses/${id}/history`),
  summary: () => get('/expenses/summary'),
  create: (data) => post('/expenses', data),
  update: (id, data) => put(`/expenses/${id}`, data),
  approve: (id) => put(`/expenses/${id}/approve`),
  pay: (id, { amount, method, note }) => post(`/expenses/${id}/pay`, { amount, method, note }),
  submit: (id, { invoiceNumber, counterparty, note } = {}) => put(`/expenses/${id}/submit`, { invoiceNumber, counterparty, note }),
  finalize: (id, note) => put(`/expenses/${id}/finalize`, note ? { note } : undefined),
  reject: (id, reason) => put(`/expenses/${id}/reject`, { reason }),
  delete: (id) => del(`/expenses/${id}`),
}

export const reportApi = {
  summary: (period) => get('/reports/summary', period ? { period } : undefined),
  vat: (period) => get('/reports/vat', period ? { period } : undefined),
  journal: (period) => get('/reports/journal', period ? { period } : undefined),
  zReport: (date) => get('/reports/z-report', date ? { date } : undefined),
  cashClosings: (from, to) => get('/reports/cash-closings', { from, to }),
  createCashClosing: (payload) => post('/reports/cash-closings', payload),
  reviewCashClosing: (id, decision, note) => put(`/reports/cash-closings/${id}/review`, { decision, note }),
  explainCashClosing: (id, explanation) => put(`/reports/cash-closings/${id}/explanation`, { explanation }),
  cashReport: (granularity, period) => get('/reports/cash-report', { granularity, period }),
  periods: () => get('/accounting/periods'),
  closePeriod: (period, note) => post(`/accounting/periods/${period}/close`, { note }),
  reopenPeriod: (period, reason) => post(`/accounting/periods/${period}/reopen`, { reason }),
  auditLogs: (params) => get('/audit-logs', params),
}

/** Masa & adisyon (Kasiyer), mutfak ekranı (Şef), masa düzeni ve iptal onayı (Müdür) */
export const posApi = {
  tables: () => get('/pos/tables'),
  createTable: (body) => post('/pos/tables', body),
  updateTable: (id, body) => put(`/pos/tables/${id}`, body),
  menu: () => get('/pos/menu'),
  openCheck: (tableId, guestCount) => post(`/pos/tables/${tableId}/open`, guestCount ? { guestCount } : {}),
  check: (id) => get(`/pos/checks/${id}`),
  addItems: (checkId, items) => post(`/pos/checks/${checkId}/items`, { items }),
  itemStatus: (itemId, status) => put(`/pos/items/${itemId}/status`, { status }),
  cancelItem: (itemId, reason) => put(`/pos/items/${itemId}/cancel`, { reason }),
  transfer: (checkId, tableId) => put(`/pos/checks/${checkId}/transfer`, { tableId }),
  pay: (checkId, paymentMethod, receivedAmount) => post(`/pos/checks/${checkId}/pay`, { paymentMethod, receivedAmount }),
  /** Parçalı ödeme / hesap bölme: amount boşsa kalanın tamamı; itemIds verilirse seçili kalemler */
  addPayment: (checkId, body) => post(`/pos/checks/${checkId}/payments`, body),
  voidPayment: (paymentId, reason) => put(`/pos/payments/${paymentId}/void`, { reason }),
  cancelCheck: (checkId, reason) => put(`/pos/checks/${checkId}/cancel`, { reason }),
  compItem: (itemId, reason) => put(`/pos/items/${itemId}/comp`, { reason }),
  setDiscount: (checkId, { percent, amount, reason }) => put(`/pos/checks/${checkId}/discount`, { percent, amount, reason }),
  removeDiscount: (checkId) => del(`/pos/checks/${checkId}/discount`),
  kitchen: () => get('/pos/kitchen'),
  summary: (date) => get('/pos/summary', date ? { date } : undefined),
  closedChecks: (params) => get('/pos/checks', params),
}

/** Fiş yazıcıları (mutfak / bar / kasa), yazdırma işleri */
export const printApi = {
  printers: () => get('/print/printers'),
  createPrinter: (body) => post('/print/printers', body),
  updatePrinter: (id, body) => put(`/print/printers/${id}`, body),
  deletePrinter: (id) => del(`/print/printers/${id}`),
  testPrinter: (id) => post(`/print/printers/${id}/test`),
  printCheck: (checkId, type = 'BILL') => post(`/print/checks/${checkId}?type=${type}`),
  jobs: () => get('/print/jobs'),
  retry: (id) => post(`/print/jobs/${id}/retry`),
}

/** Mali belge: e-Arşiv fatura, ÖKC fiş bağlama, gün sonu belge mutabakatı */
export const fiscalApi = {
  status: () => get('/fiscal/status'),
  forCheck: (checkId) => get(`/fiscal/checks/${checkId}`),
  eArsiv: (checkId, buyer) => post(`/fiscal/checks/${checkId}/e-arsiv`, buyer || {}),
  okc: (checkId, receiptNo, zNo) => post(`/fiscal/checks/${checkId}/okc`, { receiptNo, zNo }),
  summary: (date) => get('/fiscal/summary', date ? { date } : undefined),
  cancel: (id, reason) => put(`/fiscal/documents/${id}/cancel`, { reason }),
  /** UBL-TR XML'i indirir (entegratör paneline yüklemek için) */
  downloadXml: async (id, fileName) => {
    const res = await axiosClient.get(`/fiscal/documents/${id}/xml`, { responseType: 'blob' })
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName || id}.xml`
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  },
}

/**
 * Roller arası onay talepleri: Kasiyer (kalem / adisyon iptali, ikram, indirim) ve Depo (eşiği aşan sayım farkı)
 * talep açar; İşletme Müdürü onaylar veya gerekçeyle reddeder.
 */
export const approvalApi = {
  list: (params) => get('/approvals', params),
  summary: () => get('/approvals/summary'),
  request: (payload) => post('/approvals', payload),
  decide: (id, decision, note) => put(`/approvals/${id}/decide`, { decision, note }),
  withdraw: (id) => put(`/approvals/${id}/withdraw`),
}

export const notificationApi = {
  getAll: () => get('/notifications'),
  markRead: (id) => put(`/notifications/${id}/read`),
  markAllRead: () => put('/notifications/mark-all-read'),
  announce: (payload) => post('/notifications', payload),
  securityAlert: (screen, action) => post('/notifications/security-alert', { screen, action }),
}

export const chatApi = {
  channels: () => get('/chat/channels'),
  messages: (channelId) => get('/chat/messages', channelId && channelId !== 'all' ? { channelId } : undefined),
  send: (channelId, text, priority) => post('/chat/messages', { channelId, text, priority }),
  unread: () => get('/chat/unread'),
  markRead: (channelId, lastMessageId) => put(`/chat/channels/${channelId}/read`, lastMessageId ? { lastMessageId } : undefined),
}
