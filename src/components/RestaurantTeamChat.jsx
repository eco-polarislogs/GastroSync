import React, { useState, useMemo, useEffect, useRef } from 'react'
import { FiMessageSquare, FiSend, FiX, FiUsers, FiClock, FiAlertCircle, FiCheck, FiTag, FiSearch } from 'react-icons/fi'
import { useAuthStore, useNotificationStore, ROLES } from '../store'
import { TRANSLATIONS, getRoleLabel } from '../utils/translations'
import { useChatMessages, useSendChatMessage, CHAT_KEYS } from '../hooks/useChatQuery'
import { useQueryClient } from '@tanstack/react-query'
import websocketService from '../services/websocketService'

// Kanal tanımları – her kanalın hangi rollere açık olduğunu belirler
const CHANNEL_DEFS = [
  {
    id: 'general',
    nameKey: 'chGeneral',
    targetKey: 'chGeneralTarget',
    icon: '📢',
    allowedRoles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF, ROLES.WAREHOUSE, ROLES.ACCOUNTANT, ROLES.FINANCIAL_ADVISOR],
  },
  {
    id: 'kitchen',
    nameKey: 'chKitchen',
    targetKey: 'chKitchenTarget',
    icon: '🍳',
    allowedRoles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF, ROLES.WAREHOUSE],
  },
  {
    id: 'cashier',
    nameKey: 'chCashier',
    targetKey: 'chCashierTarget',
    icon: '💰',
    allowedRoles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.ACCOUNTANT, ROLES.FINANCIAL_ADVISOR],
  },
  {
    id: 'shift',
    nameKey: 'chShift',
    targetKey: 'chShiftTarget',
    icon: '📋',
    allowedRoles: [ROLES.ADMIN, ROLES.MANAGER, ROLES.CHEF, ROLES.WAREHOUSE, ROLES.ACCOUNTANT],
  },
]

export default function RestaurantTeamChat() {
  const currentLanguage = useAuthStore((s) => s.currentLanguage) || 'tr'
  const t = TRANSLATIONS[currentLanguage] || TRANSLATIONS.tr
  const user = useAuthStore((s) => s.user)
  const queryClient = useQueryClient()
  const messagesEndRef = useRef(null)

  const [isOpen, setIsOpen] = useState(false)
  const [activeChannel, setActiveChannel] = useState('general')
  const [inputMsg, setInputMsg] = useState('')
  const [isUrgent, setIsUrgent] = useState(false)
  const [chatSearch, setChatSearch] = useState('')

  // ── TANSTACK QUERY: PostgreSQL Persisted Team Chat ─────────────
  const { data: messages = [], isLoading: isChatLoading } = useChatMessages(activeChannel)
  const sendMessageMutation = useSendChatMessage()

  // Kullanıcının rolüne göre erişebildiği kanalları filtrele
  const accessibleChannels = useMemo(() => {
    const userRole = user?.role || ROLES.ADMIN
    return CHANNEL_DEFS.filter(ch => ch.allowedRoles.includes(userRole))
  }, [user?.role])

  // Aktif kanal kullanıcının erişimine kapalıysa ilk erişebildiği kanala geçir
  useEffect(() => {
    if (accessibleChannels.length > 0 && !accessibleChannels.some(ch => ch.id === activeChannel)) {
      setActiveChannel(accessibleChannels[0].id)
    }
  }, [accessibleChannels, activeChannel])

  // ── WEBSOCKET / STOMP REAL-TIME SUBSCRIPTION ──────────────────
  useEffect(() => {
    if (!activeChannel) return

    const handleIncomingMessage = (incomingMsg) => {
      if (!incomingMsg || !incomingMsg.id) return

      queryClient.setQueryData(CHAT_KEYS.messages(activeChannel), (old = []) => {
        const exists = old.some(m => m.id === incomingMsg.id)
        if (exists) return old
        return [...old, incomingMsg]
      })

      // Bildirim listesini güncelle
      if (useNotificationStore?.getState()?.fetchNotifications && user?.role) {
        useNotificationStore.getState().fetchNotifications(user.role)
      }
    }

    const unsubChannel = websocketService.subscribe(`/topic/chat/${activeChannel}`, handleIncomingMessage)
    const unsubAll = websocketService.subscribe('/topic/chat/all', handleIncomingMessage)

    return () => {
      unsubChannel()
      unsubAll()
    }
  }, [activeChannel, queryClient, user?.role])

  // Yeni mesaj geldiğinde veya chat açıldığında otomatik aşağı kaydır
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isOpen, activeChannel])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!inputMsg.trim()) return

    const newMsg = {
      channelId: activeChannel,
      sender: user?.name || 'Personel',
      role: user?.role || 'admin',
      text: inputMsg.trim(),
      time: new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
      avatar: user?.avatar || 'GS',
      priority: isUrgent ? 'urgent' : 'normal'
    }

    setInputMsg('')
    setIsUrgent(false)

    // STOMP üzerinden de doğrudan gönder
    try {
      websocketService.send('/app/chat.sendMessage', newMsg)
    } catch (_) {}

    // Send to PostgreSQL via Spring Boot ChatController
    sendMessageMutation.mutate(newMsg, {
      onSuccess: () => {
        if (useNotificationStore?.getState()?.fetchNotifications) {
          useNotificationStore.getState().fetchNotifications(user?.role)
        }
      }
    })
  }

  const currentChannelMessages = useMemo(() => {
    return messages
      .filter(m => m.channelId === activeChannel)
      .filter(m => !chatSearch.trim() || m.text.toLowerCase().includes(chatSearch.toLowerCase()) || m.sender.toLowerCase().includes(chatSearch.toLowerCase()))
  }, [messages, activeChannel, chatSearch])

  const currentChannelDef = CHANNEL_DEFS.find(ch => ch.id === activeChannel)

  return (
    <>
      {/* Floating Chat Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          backgroundColor: '#059669',
          color: '#ffffff',
          borderRadius: '50px',
          padding: '12px 20px',
          border: 'none',
          boxShadow: '0 10px 25px -5px rgba(5, 150, 105, 0.5)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          cursor: 'pointer',
          zIndex: 9999,
          fontWeight: 800,
          fontSize: '0.9rem',
          transition: 'transform 0.2s, background-color 0.2s',
        }}
        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.04)'}
        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
      >
        <FiMessageSquare size={18} />
        <span>{t.teamChat}</span>
        <span style={{ backgroundColor: '#ffffff', color: '#059669', borderRadius: '12px', padding: '2px 7px', fontSize: '11px', fontWeight: 900 }}>
          {messages.length}
        </span>
      </button>

      {/* Chat Window Modal */}
      {isOpen && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            right: '24px',
            width: '450px',
            maxWidth: 'calc(100vw - 32px)',
            height: '600px',
            backgroundColor: '#ffffff',
            borderRadius: '20px',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            border: '1.5px solid #e2e8f0',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: '14px 18px',
              backgroundColor: '#064e3b',
              color: '#ffffff',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.2rem' }}>📻</span>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800 }}>{t.internalRadio}</h3>
                <span style={{ fontSize: '0.7rem', backgroundColor: '#047857', padding: '2px 6px', borderRadius: '6px', border: '1px solid #059669' }}>
                  {getRoleLabel(user?.role, currentLanguage)}
                </span>
              </div>
              <span style={{ fontSize: '0.72rem', color: '#a7f3d0' }}>
                {t.interDeptComm}
              </span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <FiX size={18} />
            </button>
          </div>

          {/* Channel Tabs - Rol bazlı filtrelenmiş */}
          <div
            style={{
              display: 'flex',
              overflowX: 'auto',
              gap: '6px',
              padding: '10px 12px',
              backgroundColor: '#f8fafc',
              borderBottom: '1px solid #e2e8f0',
            }}
          >
            {accessibleChannels.map(ch => (
              <button
                key={ch.id}
                onClick={() => {
                  setActiveChannel(ch.id)
                  setChatSearch('')
                }}
                style={{
                  padding: '6px 12px',
                  borderRadius: '12px',
                  border: activeChannel === ch.id ? 'none' : '1px solid #cbd5e1',
                  fontSize: '0.75rem',
                  fontWeight: activeChannel === ch.id ? 800 : 600,
                  backgroundColor: activeChannel === ch.id ? '#059669' : '#ffffff',
                  color: activeChannel === ch.id ? '#ffffff' : '#475569',
                  boxShadow: activeChannel === ch.id ? '0 2px 4px rgba(5,150,105,0.2)' : 'none',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                {ch.icon} {t[ch.nameKey] || ch.nameKey}
              </button>
            ))}
          </div>

          {/* Search Bar in Active Channel */}
          <div style={{ padding: '8px 12px', backgroundColor: '#ffffff', borderBottom: '1px solid #f1f5f9', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FiSearch size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder={`# ${currentChannelDef ? (t[currentChannelDef.nameKey] || currentChannelDef.nameKey) : ''} kanalında mesaj ara...`}
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              style={{
                flex: 1,
                border: 'none',
                outline: 'none',
                fontSize: '0.78rem',
                color: '#334155'
              }}
            />
            {chatSearch && (
              <button onClick={() => setChatSearch('')} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}>
                <FiX size={14} />
              </button>
            )}
          </div>

          {/* Messages Stream */}
          <div
            style={{
              flex: 1,
              padding: '16px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              backgroundColor: '#fafbfc',
            }}
          >
            {currentChannelMessages.length === 0 ? (
              <div style={{ textAlign: 'center', color: '#94a3b8', margin: 'auto', fontSize: '0.85rem' }}>
                {t.noMessagesYet}
              </div>
            ) : (
              currentChannelMessages.map(m => {
                const isMe = m.sender === (user?.name || 'Ahmet Yılmaz')
                const roleLabel = getRoleLabel(m.role, currentLanguage)
                const isUrgentMsg = m.priority === 'urgent'
                return (
                  <div
                    key={m.id}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: isMe ? 'flex-end' : 'flex-start',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '3px' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#334155' }}>{m.sender}</span>
                      <span style={{ fontSize: '0.68rem', color: '#64748b', backgroundColor: '#f1f5f9', padding: '1px 5px', borderRadius: '4px' }}>
                        {roleLabel}
                      </span>
                      {isUrgentMsg && (
                        <span style={{ fontSize: '0.65rem', backgroundColor: '#fee2e2', color: '#dc2626', fontWeight: 800, padding: '1px 6px', borderRadius: '4px' }}>
                          ⚡ ACİL
                        </span>
                      )}
                      <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>{m.time}</span>
                    </div>
                    <div
                      style={{
                        maxWidth: '85%',
                        padding: '10px 14px',
                        borderRadius: isMe ? '16px 4px 16px 16px' : '4px 16px 16px 16px',
                        backgroundColor: isUrgentMsg ? (isMe ? '#b91c1c' : '#fef2f2') : (isMe ? '#059669' : '#ffffff'),
                        color: isUrgentMsg ? (isMe ? '#ffffff' : '#991b1b') : (isMe ? '#ffffff' : '#0f172a'),
                        fontSize: '0.85rem',
                        lineHeight: '1.4',
                        boxShadow: '0 2px 6px rgba(0,0,0,0.05)',
                        border: isUrgentMsg ? '1.5px solid #f87171' : (isMe ? 'none' : '1px solid #e2e8f0'),
                      }}
                    >
                      {m.text}
                    </div>
                  </div>
                )
              })
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Box & Priority Toggle */}
          <div style={{ backgroundColor: '#ffffff', borderTop: '1px solid #e2e8f0', padding: '10px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.72rem', fontWeight: 700, color: isUrgent ? '#dc2626' : '#64748b', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={isUrgent}
                  onChange={(e) => setIsUrgent(e.target.checked)}
                />
                <span>⚡ Acil / Öncelikli Bildirim Olarak İşaretle</span>
              </label>
            </div>
            <form
              onSubmit={handleSend}
              style={{
                display: 'flex',
                gap: '8px',
              }}
            >
              <input
                type="text"
                placeholder={`${t.writeMessage} (# ${currentChannelDef ? (t[currentChannelDef.nameKey] || currentChannelDef.nameKey) : ''})...`}
                value={inputMsg}
                onChange={(e) => setInputMsg(e.target.value)}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  borderRadius: '12px',
                  border: isUrgent ? '1.5px solid #f87171' : '1.5px solid #cbd5e1',
                  fontSize: '0.85rem',
                  outline: 'none',
                }}
              />
              <button
                type="submit"
                style={{
                  backgroundColor: isUrgent ? '#dc2626' : '#059669',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '12px',
                  padding: '0 16px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <FiSend size={16} />
              </button>
            </form>
          </div>
        </div>
      )}
    </>
  )
}
