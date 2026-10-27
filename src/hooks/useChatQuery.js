import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import chatApi from '../api/chatApi'

export const CHAT_KEYS = {
  all: ['chat'],
  messages: (channelId) => [...CHAT_KEYS.all, 'messages', channelId || 'all']
}

export function useChatMessages(channelId) {
  return useQuery({
    queryKey: CHAT_KEYS.messages(channelId),
    queryFn: () => chatApi.getMessages(channelId),
    refetchInterval: 3000, // 3-second live background synchronization
    staleTime: 1000 * 2
  })
}

export function useSendChatMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (message) => chatApi.sendMessage(message),
    onSuccess: (saved) => {
      // Invalidate all channels so other tabs/views get immediate authoritative update
      queryClient.invalidateQueries({ queryKey: CHAT_KEYS.all })
    }
  })
}
