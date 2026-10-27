import axiosClient from './axiosClient'

/**
 * Enterprise Team Chat API Service.
 * Connects directly to Spring Boot `ChatController` (/api/chat).
 * Persists all messages in PostgreSQL `chat_messages` table.
 */
export const chatApi = {
  /**
   * Retrieves messages by channel ID via GET /api/chat/messages?channelId=...
   */
  getMessages: async (channelId) => {
    const params = channelId && channelId !== 'all' ? { channelId } : {}
    const res = await axiosClient.get('/chat/messages', { params })
    return Array.isArray(res) ? res : (res?.data || [])
  },

  /**
   * Sends a new chat message via POST /api/chat/messages.
   * Spring Boot automatically produces role notifications and saves to PostgreSQL.
   */
  sendMessage: async (message) => {
    const res = await axiosClient.post('/chat/messages', message)
    return res?.data || res
  }
}

export default chatApi
