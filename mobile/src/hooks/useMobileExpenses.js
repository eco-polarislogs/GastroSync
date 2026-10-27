import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetchExpenses, apiCreateExpense, apiUpdateExpense, apiDeleteExpense } from '../services/api';

export const MOBILE_EXPENSE_KEYS = {
  all: ['mobile_expenses'],
  lists: () => [...MOBILE_EXPENSE_KEYS.all, 'list'],
};

export function useMobileExpenses() {
  return useQuery({
    queryKey: MOBILE_EXPENSE_KEYS.lists(),
    queryFn: apiFetchExpenses,
    staleTime: 1000 * 60 * 2,
  });
}

export function useMobileCreateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload) => apiCreateExpense(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOBILE_EXPENSE_KEYS.all });
    },
  });
}

export function useMobileUpdateExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, ...payload }) => apiUpdateExpense(id, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOBILE_EXPENSE_KEYS.all });
    },
  });
}

export function useMobileDeleteExpense() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id) => apiDeleteExpense(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOBILE_EXPENSE_KEYS.all });
    },
  });
}
