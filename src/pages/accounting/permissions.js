import { hasPermission } from '../../store'

/**
 * Gider işlemleri için düğme görünürlüğü. İzin listesi sunucudan gelir (user.permissions);
 * durum kuralları backend ExpenseService ile aynıdır. Nihai karar her zaman sunucudadır.
 *
 * Görev dağılımı:
 *   Muhasebe      kayıt, düzeltme, ödeme, faturalandırıp Mali Müşavire gönderme, kasa mutabakatı
 *   Müdür         harcama onayı / onay aşamasında gerekçeli ret
 *   Mali Müşavir  gönderilen belgeyi deftere işleme / gerekçeli ret, dönem kapama
 *   Yönetici      salt okunur izleme
 */
const isCreator = (user, e) => !!user && !!e?.createdBy && e.createdBy.toLowerCase() === user.username?.toLowerCase()
const isApprover = (user, e) => !!user?.name && !!e?.approvedBy && e.approvedBy.toLowerCase() === user.name.toLowerCase()
const underReview = (e) => e.status === 'APPROVED' && !!e.sentToAdvisor

export const can = {
  create: (user) => hasPermission(user, 'EXPENSE_CREATE'),

  edit: (user, e) => ['PENDING_APPROVAL', 'REJECTED'].includes(e.status) && hasPermission(user, 'EXPENSE_EDIT'),

  approve: (user, e) => e.status === 'PENDING_APPROVAL' && hasPermission(user, 'EXPENSE_APPROVE') && !isCreator(user, e),

  /** Neden onaylayamadığını açıklamak için */
  approveBlockedBySegregation: (user, e) => e.status === 'PENDING_APPROVAL'
    && hasPermission(user, 'EXPENSE_APPROVE') && isCreator(user, e),

  pay: (user, e) => ['APPROVED', 'FINALIZED'].includes(e.status) && e.remainingAmount > 0 && hasPermission(user, 'EXPENSE_PAY'),

  /** Muhasebe: onaylanan gideri faturalandırıp (belge no / karşı taraf) Mali Müşavire gönderir */
  submit: (user, e) => e.status === 'APPROVED' && !e.sentToAdvisor && hasPermission(user, 'EXPENSE_SUBMIT'),

  /** Mali Müşavir: gönderilen belgeyi deftere işler. Dört göz: kaydeden / onaylayan işleyemez */
  finalize: (user, e) => underReview(e) && hasPermission(user, 'LEDGER_DECIDE') && !isCreator(user, e) && !isApprover(user, e),

  /** Müşavir incelemesindeki kaydı yalnızca Mali Müşavir; onay aşamasındakini yalnızca Müdür reddeder */
  reject: (user, e) => {
    if (underReview(e)) return hasPermission(user, 'LEDGER_DECIDE')
    if (!['PENDING_APPROVAL', 'APPROVED'].includes(e.status)) return false
    return hasPermission(user, 'EXPENSE_APPROVE')
  },

  remove: (user, e) => ['PENDING_APPROVAL', 'REJECTED'].includes(e.status) && !(e.paidAmount > 0)
    && hasPermission(user, 'EXPENSE_DELETE'),

  cashClosing: (user) => hasPermission(user, 'CASH_CLOSING_CREATE'),
  reviewCashClosing: (user) => hasPermission(user, 'CASH_CLOSING_REVIEW'),
  managePeriods: (user) => hasPermission(user, 'PERIOD_MANAGE'),
  journal: (user) => hasPermission(user, 'JOURNAL_VIEW'),
  vat: (user) => hasPermission(user, 'VAT_REPORT_VIEW'),
  cashReport: (user) => hasPermission(user, 'CASH_REPORT_VIEW'),
  summary: (user) => hasPermission(user, 'FINANCE_SUMMARY_VIEW'),
  /** Hiçbir işlem düğmesi olmayan gözetim görünümü (Yönetici) */
  readOnly: (user) => !hasPermission(user, 'EXPENSE_CREATE', 'EXPENSE_APPROVE', 'EXPENSE_PAY', 'EXPENSE_SUBMIT', 'LEDGER_DECIDE'),
}
