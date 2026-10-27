import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import inventoryApi from '../api/inventoryApi'
import { notifySuccess, notifyError } from '../utils/notify'

/**
 * Enterprise Query Key Constants for Inventory domain.
 * Enforces hierarchical cache segmentation.
 */
export const INVENTORY_KEYS = {
  all: ['inventory'],
  lists: () => [...INVENTORY_KEYS.all, 'list'],
  list: (filters) => [...INVENTORY_KEYS.lists(), filters],
  details: () => [...INVENTORY_KEYS.all, 'detail'],
  detail: (id) => [...INVENTORY_KEYS.details(), id],
  transactions: () => [...INVENTORY_KEYS.all, 'transactions']
}

/**
 * Hook to fetch all inventory items with automatic caching and background revalidation.
 */
export function useInventoryItems() {
  return useQuery({
    queryKey: INVENTORY_KEYS.lists(),
    queryFn: inventoryApi.getAll,
    staleTime: 1000 * 60 * 3, // Cache remains fresh for 3 minutes
    select: (data) => {
      // Normalizes backend entity fields to frontend representation if needed
      return data.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        stock: parseFloat(item.currentStock ?? item.stock ?? 0) || 0,
        minStock: parseFloat(item.minStock ?? item.min ?? 5) || 5,
        unit: item.unit || 'kg',
        price: parseFloat(item.unitCost ?? item.price ?? 0) || 0,
        supplier: item.supplier || '',
        barcode: item.barcode || '',
        lastUpdated: item.lastUpdated || 'Bugün'
      }))
    }
  })
}

/**
 * Hook to fetch recent inventory audit transactions.
 */
export function useRecentTransactions() {
  return useQuery({
    queryKey: INVENTORY_KEYS.transactions(),
    queryFn: inventoryApi.getRecentTransactions,
    staleTime: 1000 * 30 // 30 seconds
  })
}

/**
 * Mutation hook for Mal Kabul (Stock Receipt).
 * Performs TRUE database mutation, then invalidates inventory cache.
 */
export function useReceiveStock() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, quantity, recordedBy }) =>
      inventoryApi.receiveStock(id, { quantity, recordedBy }),

    onSuccess: (response, variables) => {
      // Invalidate queries so TanStack Query immediately re-fetches authoritative DB state
      queryClient.invalidateQueries({ queryKey: INVENTORY_KEYS.all })
      notifySuccess(`+${variables.quantity} stok girişi veritabanına başarıyla kaydedildi!`, 'Depo Yönetimi')
    },

    onError: (error) => {
      notifyError(error.message || 'Stok girişi başarısız oldu', 'Hata')
    }
  })
}

/**
 * Mutation hook for Zayiat/Fire (Stock Waste).
 * Performs atomic reduction in PostgreSQL, creates audit record, and invalidates cache.
 */
export function useRecordWaste() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, quantity, reason, recordedBy }) =>
      inventoryApi.recordWaste(id, { quantity, reason, recordedBy }),

    onSuccess: (response, variables) => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_KEYS.all })
      notifySuccess(`-${variables.quantity} zayiat kaydı veritabanına işlendi.`, 'Zayiat Takibi')
    },

    onError: (error) => {
      notifyError(error.message || 'Zayiat kaydı oluşturulamadı', 'Hata')
    }
  })
}

/**
 * Mutation hook for creating new inventory item.
 */
export function useCreateInventoryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (newItem) => inventoryApi.create(newItem),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_KEYS.all })
      notifySuccess('Yeni hammadde stoğa başarıyla eklendi.', 'Envanter')
    },
    onError: (error) => {
      notifyError(error.message || 'Ürün ekleme başarısız', 'Hata')
    }
  })
}

/**
 * Mutation hook for updating existing inventory item.
 */
export function useUpdateInventoryItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...itemData }) => inventoryApi.update(id, itemData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: INVENTORY_KEYS.all })
      notifySuccess('Stok bilgileri güncellendi.', 'Envanter')
    },
    onError: (error) => {
      notifyError(error.message || 'Güncelleme başarısız', 'Hata')
    }
  })
}
