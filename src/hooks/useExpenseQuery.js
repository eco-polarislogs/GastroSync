import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { expenseApi, reportApi } from '../api'
import { notifySuccess, notifyError } from '../utils/notify'
import { toNumber } from '../utils/format'

export const EXPENSE_KEYS = {
  all: ['expenses'],
  list: (period) => ['expenses', 'list', period || 'all'],
  history: (id) => ['expenses', 'history', id],
}

export const REPORT_KEYS = {
  all: ['reports'],
  summary: (period) => ['reports', 'summary', period || 'current'],
  vat: (period) => ['reports', 'vat', period || 'current'],
  journal: (period) => ['reports', 'journal', period || 'current'],
  z: (date) => ['reports', 'z', date || 'today'],
  periods: ['reports', 'periods'],
  closings: ['reports', 'closings'],
}

const normalizeExpense = (e) => ({
  ...e,
  amount: toNumber(e.amount),
  vatRate: toNumber(e.vatRate),
  vatAmount: toNumber(e.vatAmount),
  netAmount: toNumber(e.netAmount),
  paidAmount: toNumber(e.paidAmount),
  remainingAmount: toNumber(e.remainingAmount),
})

export function useExpenses(period) {
  return useQuery({
    queryKey: EXPENSE_KEYS.list(period),
    queryFn: () => expenseApi.getAll(period),
    select: (data) => (Array.isArray(data) ? data.map(normalizeExpense) : []),
    staleTime: 30_000,
  })
}

/** Sayfalı gider listesi: { period, tab, q, page, size } */
export function useExpenseSearch(params) {
  return useQuery({
    queryKey: ['expenses', 'search', params],
    queryFn: () => expenseApi.search(params),
    placeholderData: keepPreviousData,
    select: (d) => (d ? { ...d, content: (d.content || []).map(normalizeExpense) } : d),
    staleTime: 15_000,
  })
}

export function useExpenseHistory(id) {
  return useQuery({
    queryKey: EXPENSE_KEYS.history(id),
    queryFn: () => expenseApi.history(id),
    enabled: !!id,
  })
}

export function useReportSummary(period) {
  return useQuery({ queryKey: REPORT_KEYS.summary(period), queryFn: () => reportApi.summary(period), staleTime: 30_000 })
}

export function useVatReport(period, enabled = true) {
  return useQuery({ queryKey: REPORT_KEYS.vat(period), queryFn: () => reportApi.vat(period), enabled })
}

export function useJournal(period, enabled = true) {
  return useQuery({ queryKey: REPORT_KEYS.journal(period), queryFn: () => reportApi.journal(period), enabled })
}

export function useZReport(date, enabled = true) {
  return useQuery({ queryKey: REPORT_KEYS.z(date), queryFn: () => reportApi.zReport(date), enabled })
}

export function usePeriods(enabled = true) {
  return useQuery({ queryKey: REPORT_KEYS.periods, queryFn: reportApi.periods, enabled })
}

/** Ortak mutasyon kalıbı: başarıda gider + rapor önbelleklerini tazeler, hatada sunucu mesajını gösterir */
function useFinanceMutation(mutationFn, successMessage) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: EXPENSE_KEYS.all })
      qc.invalidateQueries({ queryKey: REPORT_KEYS.all })
      if (successMessage) notifySuccess(successMessage)
    },
    onError: (err) => notifyError(err.message, 'İşlem reddedildi'),
  })
}

export const useCreateExpense = () => useFinanceMutation((data) => expenseApi.create(data), 'Gider kaydedildi ve onaya sunuldu.')
export const useUpdateExpense = () => useFinanceMutation(({ id, ...data }) => expenseApi.update(id, data), 'Gider güncellendi.')
export const useApproveExpense = () => useFinanceMutation((id) => expenseApi.approve(id), 'Harcama onaylandı; ödeme ve belge gönderimi için Muhasebeye iletildi.')
export const usePayExpense = () => useFinanceMutation(({ id, ...body }) => expenseApi.pay(id, body), 'Ödeme kaydedildi.')
export const useFinalizeExpense = () => useFinanceMutation((arg) => (typeof arg === 'object' ? expenseApi.finalize(arg.id, arg.note) : expenseApi.finalize(arg)),
  'Belge onaylandı ve resmi deftere işlendi.')
export const useSubmitExpense = () => useFinanceMutation(({ id, ...body }) => expenseApi.submit(id, body),
  'Gider faturalandırıldı ve Mali Müşavir incelemesine gönderildi.')
export const useRejectExpense = () => useFinanceMutation(({ id, reason }) => expenseApi.reject(id, reason), 'Gider gerekçeli olarak reddedildi.')
export const useDeleteExpense = () => useFinanceMutation((id) => expenseApi.delete(id), 'Gider kaydı arşivlendi.')
// Sonuç mesajı (fark / mutabık) çağıran ekranda gösterilir (kör sayım)
export const useCreateCashClosing = () => useFinanceMutation((payload) => reportApi.createCashClosing(payload), null)
export const useClosePeriod = () => useFinanceMutation(({ period, note }) => reportApi.closePeriod(period, note), 'Dönem kapatıldı.')
export const useReopenPeriod = () => useFinanceMutation(({ period, reason }) => reportApi.reopenPeriod(period, reason), 'Dönem yeniden açıldı.')
