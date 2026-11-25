import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import websocketService from '../services/websocketService'
import { hasPermission, useInventoryStore, useRecipeStore, useSalesStore } from '../store'

/**
 * Canlı veri senkronu (web ↔ mobil ↔ diğer kullanıcılar).
 *
 * Sunucu her iş adımından sonra ilgili konuya kısa bir sinyal yayınlar (yalnızca tür ve kimlik, veri değil).
 * Bu kanca sinyali alınca, kullanıcının yetkisi olan listeleri sunucudan yeniden çeker. Böylece mobilde
 * yapılan mal kabul / ödeme / fiyat onayı web ekranında sayfa yenilemeden görünür (ve tersi).
 *
 * Konu abonelik yetkisi sunucuda (AppRoles.canSubscribe) ayrıca denetlenir.
 */
export default function useLiveSync(user) {
  const qc = useQueryClient()

  useEffect(() => {
    if (!user?.role) return undefined
    const can = (...p) => hasPermission(user, ...p)
    const timers = {}
    // Art arda gelen sinyalleri tek yenilemede topla
    const debounce = (key, fn, ms = 400) => {
      clearTimeout(timers[key])
      timers[key] = setTimeout(fn, ms)
    }

    const refreshInventory = () => debounce('inventory', () => {
      qc.invalidateQueries({ queryKey: ['inventory'] })
      if (useInventoryStore.getState().items.length) useInventoryStore.getState().fetchItems()
      if (can('PRICING_VIEW')) qc.invalidateQueries({ queryKey: ['pricing'] })
    })
    const refreshFinance = () => debounce('finance', () => {
      qc.invalidateQueries({ queryKey: ['expenses'] })
      qc.invalidateQueries({ queryKey: ['reports'] })
      if (can('SALES_VIEW')) {
        qc.invalidateQueries({ queryKey: ['sales'] })
        useSalesStore.getState().fetchSales()
      }
    })
    const refreshRecipes = () => debounce('recipes', () => {
      if (can('RECIPE_VIEW')) useRecipeStore.getState().fetchRecipes()
      if (can('PRICING_VIEW')) qc.invalidateQueries({ queryKey: ['pricing'] })
      if (can('POS_VIEW')) qc.invalidateQueries({ queryKey: ['pos', 'menu'] })
    })
    const refreshUsers = () => debounce('users', () => qc.invalidateQueries({ queryKey: ['users'] }))

    const subs = []
    if (can('INVENTORY_VIEW', 'DELIVERY_VIEW')) subs.push(websocketService.subscribe('/topic/inventory', refreshInventory))
    if (can('EXPENSE_VIEW', 'SALES_VIEW')) subs.push(websocketService.subscribe('/topic/finance', refreshFinance))
    if (can('RECIPE_VIEW', 'POS_VIEW')) subs.push(websocketService.subscribe('/topic/recipes', refreshRecipes))
    if (can('USER_MANAGE')) subs.push(websocketService.subscribe('/topic/users', refreshUsers))
    // Bağlantı geri geldiğinde kaçırılan değişiklikleri al
    subs.push(websocketService.onStatusChange((connected) => {
      if (!connected) return
      if (can('INVENTORY_VIEW')) refreshInventory()
      if (can('EXPENSE_VIEW', 'SALES_VIEW')) refreshFinance()
      if (can('RECIPE_VIEW', 'POS_VIEW')) refreshRecipes()
    }))

    return () => {
      subs.forEach((off) => { try { off() } catch (_) { /* yoksay */ } })
      Object.values(timers).forEach(clearTimeout)
    }
  }, [user?.role, user?.permissions, qc]) // eslint-disable-line react-hooks/exhaustive-deps
}
