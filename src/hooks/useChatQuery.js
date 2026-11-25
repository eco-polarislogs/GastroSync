import { useAuthStore } from '../store'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { chatApi } from '../api'

export const CHAT_KEYS = {
  all: ['chat'],
  channels: ['chat', 'channels'],
  messages: (channelId) => ['chat', 'messages', channelId || 'all'],
}

/** Rolün erişebildiği kanallar (sunucu belirler); rol değişince anahtar değiştiği için yeniden çekilir */
export function useChatChannels(enabled = true) {
  const role = useAuthStore((s) => s.user?.role)
  return useQuery({ queryKey: [...CHAT_KEYS.channels, role], queryFn: chatApi.channels, enabled: enabled && !!role, staleTime: 300_000 })
}

/** Canlı akış WebSocket ile gelir; periyodik yenileme yalnızca bağlantı koparsa yedektir */
export function useChatMessages(channelId, enabled = true) {
  return useQuery({
    queryKey: CHAT_KEYS.messages(channelId),
    queryFn: () => chatApi.messages(channelId),
    enabled: enabled && !!channelId,
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
}

export function useSendChatMessage() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ channelId, text, priority }) => chatApi.send(channelId, text, priority),
    onSuccess: (saved) => {
      if (saved?.channelId) {
        qc.setQueryData(CHAT_KEYS.messages(saved.channelId), (old = []) =>
          (old.some((m) => m.id === saved.id) ? old : [...old, saved]))
      }
    },
  })
}
