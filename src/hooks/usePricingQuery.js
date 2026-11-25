import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { analyticsApi, recipeApi } from '../api'
import { notifySuccess, notifyError } from '../utils/notify'
import { useRecipeStore } from '../store'

export const PRICING_KEYS = { all: ['pricing'], analysis: (days) => ['pricing', 'analysis', days] }

/** Menü mühendisliği, önerilen fiyatlar ve malzeme fiyat dalgalanması (sunucuda hesaplanır) */
export function useMenuPricing(days = 30, enabled = true) {
  return useQuery({
    queryKey: PRICING_KEYS.analysis(days),
    queryFn: () => analyticsApi.menuPricing(days),
    enabled,
    staleTime: 60_000,
    refetchInterval: 120_000,
  })
}

/** Yönetici / Müdür: gerekçeli menü fiyatı güncellemesi (POS fiyatı sunucudan geldiği için anında geçerli) */
export function useUpdateMenuPrice() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, salePrice, reason }) => recipeApi.updatePrice(id, salePrice, reason),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: PRICING_KEYS.all })
      useRecipeStore.getState().fetchRecipes?.()
      notifySuccess(`${saved?.name || 'Reçete'} fiyatı güncellendi; tüm kasalarda geçerli.`, 'Menü fiyatı')
    },
    onError: (err) => notifyError(err.message, 'Fiyat güncellenemedi'),
  })
}

export const MENU_CLASS = {
  STAR: { label: 'Yıldız', tone: 'success', hint: 'Çok satıyor, kârlı' },
  PLOWHORSE: { label: 'İş Atı', tone: 'warning', hint: 'Çok satıyor, katkı payı düşük' },
  PUZZLE: { label: 'Bulmaca', tone: 'info', hint: 'Kârlı, az satıyor' },
  DOG: { label: 'Zayıf', tone: 'danger', hint: 'Az satıyor, katkı payı düşük' },
  NO_DATA: { label: 'Satış yok', tone: 'neutral', hint: 'Dönemde satış verisi yok' },
}

export const PRICE_ACTION = {
  LOSS: { label: 'Zarar ediyor', tone: 'danger' },
  RAISE: { label: 'Fiyat artırılmalı', tone: 'warning' },
  WATCH: { label: 'Maliyet artıyor', tone: 'info' },
  OK: { label: 'Uygun', tone: 'success' },
}
