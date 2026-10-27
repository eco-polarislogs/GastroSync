import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiFetchChatMessages, apiSendChatMessage } from '../services/api';

export const MOBILE_CHAT_KEYS = {
  all: ['mobile_chat'],
  messages: (channelId) => [...MOBILE_CHAT_KEYS.all, 'messages', channelId || 'all'],
};

export function useMobileChat(channelId) {
  return useQuery({
    queryKey: MOBILE_CHAT_KEYS.messages(channelId),
    queryFn: () => apiFetchChatMessages(channelId),
    refetchInterval: 3000,
    staleTime: 1000 * 2,
  });
}

export function useMobileSendChatMessage() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (msgData) => apiSendChatMessage(msgData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: MOBILE_CHAT_KEYS.all });
    },
  });
}
