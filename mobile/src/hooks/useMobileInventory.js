import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetchInventory, apiReceiveStock, apiRecordWaste } from '../services/api';

export const MOBILE_INVENTORY_KEYS = {
  all: ['mobile_inventory'],
  lists: () => [...MOBILE_INVENTORY_KEYS.all, 'list'],
};

export function useMobileInventory() {
  return useQuery({
    queryKey: MOBILE_INVENTORY_KEYS.lists(),
    queryFn: apiFetchInventory,
    staleTime: 1000 * 60 * 2,
  });
}

export function useMobileReceiveStock() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, quantity, recordedBy }) =>
      apiReceiveStock(itemId, quantity, recordedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOBILE_INVENTORY_KEYS.all });
    },
  });
}

export function useMobileRecordWaste() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ itemId, quantity, reason, recordedBy }) =>
      apiRecordWaste(itemId, quantity, reason, recordedBy),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOBILE_INVENTORY_KEYS.all });
    },
  });
}
