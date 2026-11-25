import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { posApi, reportApi, printApi, fiscalApi } from '../api'
import websocketService from '../services/websocketService'
import { notifySuccess, notifyError } from '../utils/notify'

export const POS_KEYS = {
  all: ['pos'],
  tables: ['pos', 'tables'],
  menu: ['pos', 'menu'],
  check: (id) => ['pos', 'check', id],
  kitchen: ['pos', 'kitchen'],
  summary: (date) => ['pos', 'summary', date || 'today'],
  closed: (params) => ['pos', 'closed', params],
}

/** Masa / mutfak değişikliklerinde (başka kasa, şef) ekranı canlı tazeler */
export function usePosLiveUpdates(enabled = true) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled) return undefined
    const refresh = () => qc.invalidateQueries({ queryKey: POS_KEYS.all })
    const offTables = websocketService.subscribe('/topic/tables', refresh)
    const offKitchen = websocketService.subscribe('/topic/kitchen', refresh)
    return () => {
      offTables?.()
      offKitchen?.()
    }
  }, [enabled, qc])
}

export const usePosTables = () => useQuery({ queryKey: POS_KEYS.tables, queryFn: posApi.tables, refetchInterval: 30_000 })
export const usePosMenu = (enabled = true) => useQuery({ queryKey: POS_KEYS.menu, queryFn: posApi.menu, enabled, staleTime: 15_000 })
export const usePosCheck = (id) => useQuery({ queryKey: POS_KEYS.check(id), queryFn: () => posApi.check(id), enabled: !!id })
export const useKitchenBoard = () => useQuery({ queryKey: POS_KEYS.kitchen, queryFn: posApi.kitchen, refetchInterval: 20_000 })
export const usePosSummary = (date, enabled = true) => useQuery({ queryKey: POS_KEYS.summary(date), queryFn: () => posApi.summary(date), enabled })
export const useClosedChecks = (params, enabled = true) => useQuery({
  queryKey: POS_KEYS.closed(params), queryFn: () => posApi.closedChecks(params), enabled, placeholderData: (prev) => prev,
})

function usePosMutation(fn, message) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: POS_KEYS.all })
      qc.invalidateQueries({ queryKey: ['reports'] })
      if (message) notifySuccess(message)
    },
    onError: (err) => notifyError(err.message, 'İşlem reddedildi'),
  })
}

export const useOpenCheck = () => usePosMutation(({ tableId, guestCount }) => posApi.openCheck(tableId, guestCount))
export const useAddItems = () => usePosMutation(({ checkId, items }) => posApi.addItems(checkId, items), 'Sipariş mutfağa iletildi.')
export const useItemStatus = () => usePosMutation(({ itemId, status }) => posApi.itemStatus(itemId, status))
export const useCancelItem = () => usePosMutation(({ itemId, reason }) => posApi.cancelItem(itemId, reason), 'Kalem iptal edildi.')
export const useTransferCheck = () => usePosMutation(({ checkId, tableId }) => posApi.transfer(checkId, tableId), 'Adisyon taşındı.')
export const usePayCheck = () => usePosMutation(({ checkId, paymentMethod, receivedAmount }) => posApi.pay(checkId, paymentMethod, receivedAmount))
export const useAddPayment = () => usePosMutation(({ checkId, ...body }) => posApi.addPayment(checkId, body))
export const useVoidPayment = () => usePosMutation(({ paymentId, reason }) => posApi.voidPayment(paymentId, reason), 'Tahsilat geri alındı.')
export const useCancelCheck = () => usePosMutation(({ checkId, reason }) => posApi.cancelCheck(checkId, reason), 'Adisyon iptal edildi.')
export const useCreateTable = () => usePosMutation((body) => posApi.createTable(body), 'Masa eklendi.')
export const useUpdateTable = () => usePosMutation(({ id, ...body }) => posApi.updateTable(id, body), 'Masa güncellendi.')

// ── Kasa sayımı mutabakatı ve kasa raporu ───────────────────────
export const useCashClosings = (from, to, enabled = true) => useQuery({
  queryKey: ['reports', 'closings', from, to], queryFn: () => reportApi.cashClosings(from, to), enabled,
})
export const useCashReport = (granularity, period, enabled = true) => useQuery({
  queryKey: ['reports', 'cash-report', granularity, period], queryFn: () => reportApi.cashReport(granularity, period), enabled,
})
export function useReviewCashClosing() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, decision, note }) => reportApi.reviewCashClosing(id, decision, note),
    onSuccess: (_, v) => {
      qc.invalidateQueries({ queryKey: ['reports'] })
      notifySuccess(v.decision === 'APPROVE' ? 'Kasa sayımı mutabık olarak onaylandı.' : 'Kasiyerden yeniden sayım istendi.')
    },
    onError: (err) => notifyError(err.message, 'İşlem reddedildi'),
  })
}

// ── Yazıcılar ve yazdırma ───────────────────────────────────────
const PRINT_KEYS = { printers: ['print', 'printers'], jobs: ['print', 'jobs'] }
export const usePrinters = (enabled = true) => useQuery({ queryKey: PRINT_KEYS.printers, queryFn: printApi.printers, enabled })
export const usePrintJobs = (enabled = true) => useQuery({ queryKey: PRINT_KEYS.jobs, queryFn: printApi.jobs, enabled, refetchInterval: 15_000 })
function usePrintMutation(fn, message) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['print'] })
      if (message) notifySuccess(message)
    },
    onError: (err) => notifyError(err.message, 'Yazdırma'),
  })
}
export const useSavePrinter = () => usePrintMutation(({ id, ...body }) => (id ? printApi.updatePrinter(id, body) : printApi.createPrinter(body)), 'Yazıcı kaydedildi.')
export const useDeletePrinter = () => usePrintMutation((id) => printApi.deletePrinter(id), 'Yazıcı silindi.')
export const useTestPrinter = () => usePrintMutation((id) => printApi.testPrinter(id), 'Test baskısı gönderildi.')
export const usePrintCheck = () => usePrintMutation(({ checkId, type }) => printApi.printCheck(checkId, type), 'Yazdırma işi gönderildi.')
export const useRetryPrint = () => usePrintMutation((id) => printApi.retry(id), 'Yeniden deneniyor.')

// ── Mali belge ─────────────────────────────────────────────────
export const useFiscalStatus = () => useQuery({ queryKey: ['fiscal', 'status'], queryFn: fiscalApi.status, staleTime: 300_000 })
export const useCheckFiscal = (checkId) => useQuery({ queryKey: ['fiscal', 'check', checkId], queryFn: () => fiscalApi.forCheck(checkId), enabled: !!checkId })
export const useFiscalSummary = (date, enabled = true) => useQuery({ queryKey: ['fiscal', 'summary', date], queryFn: () => fiscalApi.summary(date), enabled })
function useFiscalMutation(fn, message) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['fiscal'] })
      if (message) notifySuccess(message)
    },
    onError: (err) => notifyError(err.message, 'Mali belge'),
  })
}
export const useIssueEArsiv = () => useFiscalMutation(({ checkId, ...buyer }) => fiscalApi.eArsiv(checkId, buyer), 'e-Arşiv fatura oluşturuldu.')
export const useRecordOkc = () => useFiscalMutation(({ checkId, receiptNo, zNo }) => fiscalApi.okc(checkId, receiptNo, zNo), 'ÖKC fişi adisyona bağlandı.')
export const useCancelFiscal = () => useFiscalMutation(({ id, reason }) => fiscalApi.cancel(id, reason), 'Belge iptal edildi.')
