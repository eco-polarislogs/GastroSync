import { useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { approvalApi, posApi } from '../api'
import websocketService from '../services/websocketService'
import { notifySuccess, notifyError } from '../utils/notify'

export const APPROVAL_KEYS = {
  all: ['approvals'],
  list: (params) => ['approvals', 'list', params],
  summary: ['approvals', 'summary'],
}

export const APPROVAL_TYPE = {
  ITEM_VOID: { label: 'Kalem iptali', tone: 'danger' },
  CHECK_VOID: { label: 'Adisyon iptali', tone: 'danger' },
  COMP: { label: 'İkram', tone: 'info' },
  DISCOUNT: { label: 'İndirim', tone: 'warning' },
  STOCK_ADJUST: { label: 'Sayım farkı', tone: 'neutral' },
}

export const APPROVAL_STATUS = {
  PENDING: { label: 'Onay bekliyor', tone: 'warning' },
  APPROVED: { label: 'Onaylandı', tone: 'success' },
  REJECTED: { label: 'Reddedildi', tone: 'danger' },
  WITHDRAWN: { label: 'Geri çekildi', tone: 'neutral' },
  EXPIRED: { label: 'Geçersiz', tone: 'neutral' },
}

/** Talep açıldığında / karar verildiğinde ilgili ekranlar (onay listesi, masalar, stok) canlı tazelenir */
export function useApprovalLiveUpdates(enabled = true) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled) return undefined
    const refresh = () => {
      qc.invalidateQueries({ queryKey: APPROVAL_KEYS.all })
      qc.invalidateQueries({ queryKey: ['pos'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
    }
    const offTopic = websocketService.subscribe('/topic/approvals', refresh)
    const offUser = websocketService.subscribe('/user/queue/notifications', (p) => {
      if (p && p.type === 'APPROVAL_DECIDED') refresh()
    })
    return () => {
      offTopic?.()
      offUser?.()
    }
  }, [enabled, qc])
}

export const useApprovals = (params, enabled = true) => useQuery({
  queryKey: APPROVAL_KEYS.list(params),
  queryFn: () => approvalApi.list(params),
  enabled,
  placeholderData: (prev) => prev,
  refetchInterval: 60_000,
})

export const useApprovalSummary = (enabled = true) => useQuery({
  queryKey: APPROVAL_KEYS.summary,
  queryFn: approvalApi.summary,
  enabled,
  refetchInterval: 60_000,
})

function useApprovalMutation(fn, successMessage) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: (res, vars) => {
      qc.invalidateQueries({ queryKey: APPROVAL_KEYS.all })
      qc.invalidateQueries({ queryKey: ['pos'] })
      qc.invalidateQueries({ queryKey: ['inventory'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      const msg = typeof successMessage === 'function' ? successMessage(res, vars) : successMessage
      if (msg) notifySuccess(msg)
    },
    onError: (err) => notifyError(err.message, 'İşlem reddedildi'),
  })
}

/** Kasiyer / Depo: Müdür onayına talep gönderir */
export const useRequestApproval = () => useApprovalMutation((payload) => approvalApi.request(payload),
  (res) => (res?.approvalRequired === false ? 'İşlem uygulandı.' : 'Talep İşletme Müdürü onayına gönderildi. Karar verilince bildirim alacaksınız.'))

/** Müdür: onay / gerekçeli ret */
export const useDecideApproval = () => useApprovalMutation(({ id, decision, note }) => approvalApi.decide(id, decision, note),
  (res) => (res?.status === 'APPROVED' ? 'Onaylandı; işlem uygulandı ve talep sahibine bildirildi.'
    : res?.status === 'REJECTED' ? 'Reddedildi; talep sahibine gerekçesiyle bildirildi.'
      : `Uygulanamadı: ${res?.decisionNote || 'kayıt değişmiş'}`))

export const useWithdrawApproval = () => useApprovalMutation((id) => approvalApi.withdraw(id), 'Talep geri çekildi.')

/** Müdür: ikram / indirim doğrudan */
export const useCompItem = () => useApprovalMutation(({ itemId, reason }) => posApi.compItem(itemId, reason), 'Kalem ikram edildi.')
export const useSetDiscount = () => useApprovalMutation(({ checkId, ...body }) => posApi.setDiscount(checkId, body), 'İndirim uygulandı.')
export const useRemoveDiscount = () => useApprovalMutation((checkId) => posApi.removeDiscount(checkId), 'İndirim kaldırıldı.')
