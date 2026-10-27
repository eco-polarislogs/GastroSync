import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import expenseApi from '../api/expenseApi'
import { notifySuccess, notifyError } from '../utils/notify'

/**
 * Enterprise Query Key Constants for Expense domain.
 * Enforces hierarchical cache segmentation:
 * ['expenses'] -> base key
 * ['expenses', 'list'] -> list queries
 * ['expenses', 'summary'] -> aggregated KPI summaries
 * ['expenses', 'detail', id] -> individual entity records
 */
export const EXPENSE_KEYS = {
  all: ['expenses'],
  lists: () => [...EXPENSE_KEYS.all, 'list'],
  list: (filters) => [...EXPENSE_KEYS.lists(), filters],
  summary: () => [...EXPENSE_KEYS.all, 'summary'],
  details: () => [...EXPENSE_KEYS.all, 'detail'],
  detail: (id) => [...EXPENSE_KEYS.details(), id]
}

/**
 * Hook to fetch all expenses with Stale-While-Revalidate caching.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DEFENSE: STALE-WHILE-REVALIDATE (SWR)
 * ═══════════════════════════════════════════════════════════════
 * 1. Immediate UI Rendering: When the user navigates to AccountingPage,
 *    cached data is served immediately with zero latency.
 * 2. Background Revalidation: TanStack Query transparently triggers
 *    a background HTTP GET to verify state against PostgreSQL.
 * 3. Automatic Synchronization: If database state changed (e.g. from
 *    mobile app or another user), the UI seamlessly reconciles.
 */
export function useExpenses() {
  return useQuery({
    queryKey: EXPENSE_KEYS.lists(),
    queryFn: expenseApi.getAll,
    staleTime: 1000 * 60 * 2, // 2 minutes before data is marked stale
    select: (data) => {
      // Normalizes backend ExpenseResponse entity fields
      return Array.isArray(data)
        ? data.map((exp) => ({
            id: exp.id,
            title: exp.title,
            category: exp.category,
            subType: exp.subType,
            amount: parseFloat(exp.amount) || 0,
            period: exp.period,
            expenseDate: exp.expenseDate,
            dueDate: exp.dueDate,
            invoiceNumber: exp.invoiceNumber || '',
            counterparty: exp.counterparty || '',
            paymentStatus: exp.paymentStatus || 'PAID',
            note: exp.note || '',
            isOwnedProperty: exp.isOwnedProperty || false,
            paidByCashier: exp.paidByCashier !== false,
            status: exp.status || 'COMPLETED',
            recordedInLedger: exp.recordedInLedger || false,
            sentToAdvisor: exp.sentToAdvisor !== false,
            createdAt: exp.createdAt,
            createdBy: exp.createdBy,
            lastModifiedBy: exp.lastModifiedBy
          }))
        : []
    }
  })
}

/**
 * Hook to fetch aggregated expense summary metrics.
 */
export function useExpenseSummary() {
  return useQuery({
    queryKey: EXPENSE_KEYS.summary(),
    queryFn: expenseApi.getSummary,
    staleTime: 1000 * 60 * 2
  })
}

/**
 * Mutation Hook: Create New Expense
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DEFENSE: TRUE DATABASE PERSISTENCE & INVALIDATION
 * ═══════════════════════════════════════════════════════════════
 * In traditional "fake state" applications, forms mutate a local
 * Zustand array (`expenses: [...expenses, newExpense]`). This creates:
 * - Silent failures if network/DB fails.
 * - ID collisions and missing server-generated timestamps/audit fields.
 * - Drift between clients.
 *
 * TanStack Query Mutation Flow:
 * 1. POST request dispatched to Spring Boot (`/api/expenses`).
 * 2. Database transaction executes atomically in PostgreSQL with JPA Auditing.
 * 3. In `onSuccess`, we call `queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all })`.
 * 4. This marks the cache stale and immediately triggers a background refetch.
 * 5. The UI re-renders with authoritative data straight from PostgreSQL!
 */
export function useCreateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (newExpense) => expenseApi.create(newExpense),

    onSuccess: (response) => {
      // Core mechanism of True Database Persistence:
      // Purge cached state and pull fresh PostgreSQL state with server-generated ID & audit fields
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all })
      notifySuccess('Gider kaydı PostgreSQL veritabanına başarıyla kaydedildi!', 'Muhasebe')
    },

    onError: (error) => {
      notifyError(error.message || 'Gider kaydı oluşturulamadı.', 'Hata')
    }
  })
}

/**
 * Mutation Hook: Update Existing Expense
 */
export function useUpdateExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, ...expenseData }) => expenseApi.update(id, expenseData),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all })
      notifySuccess('Gider kaydı güncellendi.', 'Muhasebe')
    },

    onError: (error) => {
      notifyError(error.message || 'Güncelleme başarısız.', 'Hata')
    }
  })
}

/**
 * Mutation Hook: Soft-Delete Expense
 *
 * Executes DELETE /api/expenses/{id} which activates Hibernate @SQLDelete
 * soft-deletion. Cache invalidation forces immediate re-query where
 * Hibernate @SQLRestriction("is_deleted = false") filters it out.
 */
export function useDeleteExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id) => expenseApi.delete(id),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all })
      notifySuccess('Gider kaydı güvenle arşivlendi (Soft Delete).', 'Muhasebe')
    },

    onError: (error) => {
      notifyError(error.message || 'Silme işlemi başarısız.', 'Hata')
    }
  })
}

/**
 * Mutation Hook: Approve Expense (Manager / Accountant -> APPROVED)
 */
export function useApproveExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id) => expenseApi.approve(id),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all })
      notifySuccess('Gider onaylandı ve ödeme yapıldı.', 'Onay')
    },

    onError: (error) => {
      notifyError(error.message || 'Onaylama işlemi başarısız.', 'Hata')
    }
  })
}

/**
 * Mutation Hook: Finalize Expense in Ledger (SMMM Advisor -> FINALIZED)
 */
export function useFinalizeExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id) => expenseApi.finalize(id),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all })
      notifySuccess('Gider resmi deftere işlendi ve kesinleştirildi.', 'Mali Müşavir')
    },

    onError: (error) => {
      notifyError(error.message || 'Deftere işleme başarısız.', 'Hata')
    }
  })
}

/**
 * Mutation Hook: Reject Expense
 */
export function useRejectExpense() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, reason }) => expenseApi.reject(id, reason),

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: EXPENSE_KEYS.all })
      notifySuccess('Gider kaydı gerekçeli olarak reddedildi.', 'Muhasebe')
    },

    onError: (error) => {
      notifyError(error.message || 'Reddetme başarısız.', 'Hata')
    }
  })
}
