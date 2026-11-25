import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { inventoryApi } from '../api'
import { mapInventoryItem, mapTransaction, useInventoryStore } from '../store'
import { notifySuccess, notifyError } from '../utils/notify'

export const INVENTORY_KEYS = {
  all: ['inventory'],
  list: ['inventory', 'list'],
  transactions: ['inventory', 'transactions'],
  valuation: ['inventory', 'valuation'],
}

export function useInventoryItems() {
  return useQuery({
    queryKey: INVENTORY_KEYS.list,
    queryFn: inventoryApi.getAll,
    select: (data) => (Array.isArray(data) ? data.map(mapInventoryItem) : []),
    staleTime: 30_000,
  })
}

export function useRecentTransactions() {
  return useQuery({
    queryKey: INVENTORY_KEYS.transactions,
    queryFn: inventoryApi.recentTransactions,
    select: (data) => (Array.isArray(data) ? data.map(mapTransaction) : []),
    staleTime: 15_000,
  })
}

export function useInventoryValuation(enabled = true) {
  return useQuery({ queryKey: INVENTORY_KEYS.valuation, queryFn: inventoryApi.valuation, enabled })
}

function useInventoryMutation(fn, message) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: INVENTORY_KEYS.all })
      useInventoryStore.getState().refresh()
      if (message) notifySuccess(message)
    },
    onError: (err) => notifyError(err.message, 'İşlem reddedildi'),
  })
}

export const useCreateInventoryItem = () => useInventoryMutation((item) => inventoryApi.create(item), 'Stok kartı oluşturuldu.')
export const useUpdateInventoryItem = () => useInventoryMutation(({ id, ...item }) => inventoryApi.update(id, item), 'Stok kartı güncellendi.')
export const useDeleteInventoryItem = () => useInventoryMutation((id) => inventoryApi.delete(id), 'Stok kartı arşivlendi.')
export const useReceiveStock = () => useInventoryMutation(({ id, ...body }) => inventoryApi.receive(id, body), 'Mal kabul kaydedildi.')
export const useRecordWaste = () => useInventoryMutation(({ id, ...body }) => inventoryApi.waste(id, body), 'Fire / zayiat kaydedildi.')
export const useAdjustStock = () => useInventoryMutation(({ id, ...body }) => inventoryApi.adjust(id, body), null)
export const usePurchaseRequest = () => useInventoryMutation(({ id, ...body }) => inventoryApi.purchaseRequest(id, body),
  'Tedarik talebi muhasebe onayına iletildi.')
