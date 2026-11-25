import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { userApi } from '../api'
import { notifySuccess, notifyError } from '../utils/notify'

export const USER_KEYS = { all: ['users'], list: ['users', 'list'], roles: ['users', 'roles'] }

const initials = (name) => (name ? name.split(' ').filter(Boolean).map((n) => n[0]).join('').substring(0, 2).toUpperCase() : 'GS')

export const mapUser = (u) => ({
  id: u.id,
  name: u.name,
  username: u.username,
  email: u.email || '',
  role: (u.role || '').toLowerCase(),
  roleLabel: u.roleLabel || '',
  screens: u.screens || [],
  avatar: initials(u.name),
  active: u.active !== false,
  mustChangePassword: !!u.mustChangePassword,
  lastLoginAt: u.lastLoginAt || null,
  createdAt: u.createdAt || null,
})

export function useUsers() {
  return useQuery({
    queryKey: USER_KEYS.list,
    queryFn: userApi.getAll,
    select: (data) => (Array.isArray(data) ? data.map(mapUser) : []),
    staleTime: 60_000,
  })
}

/** Sunucu tarafı personel araması: { q, role, status, sort, page, size } */
export function useUserSearch(params) {
  return useQuery({
    queryKey: ['users', 'search', params],
    queryFn: () => userApi.search(params),
    placeholderData: keepPreviousData,
    select: (d) => (d ? { ...d, content: (d.content || []).map(mapUser) } : d),
    staleTime: 15_000,
  })
}

/** Rol kataloğu: görev tanımı, ekranlar ve izinler (sunucudaki tek yetki tablosu) */
export function useRoleCatalog() {
  return useQuery({ queryKey: USER_KEYS.roles, queryFn: userApi.roles, staleTime: 10 * 60_000 })
}

function useUserMutation(fn, message) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: USER_KEYS.all })
      if (message) notifySuccess(message, 'Personel')
    },
    onError: (err) => notifyError(err.message, 'İşlem reddedildi'),
  })
}

export const useCreateUser = () => useUserMutation((data) => userApi.create(data),
  'Personel kaydedildi; verdiğiniz kullanıcı adı veya e-posta ve şifreyle yalnızca kendi rolünün ekranlarına girebilir.')
export const useUpdateUserProfile = () => useUserMutation(({ id, ...data }) => userApi.updateProfile(id, data), 'Personel bilgileri güncellendi.')
export const useUpdateUserRole = () => useUserMutation(({ id, role }) => userApi.updateRole(id, role), 'Rol güncellendi; açık oturumları yeni role anında geçti.')
export const useSetUserActive = () => useUserMutation(({ id, active }) => userApi.setActive(id, active), 'Hesap durumu güncellendi.')
export const useResetPassword = () => useUserMutation(({ id, temporaryPassword }) => userApi.resetPassword(id, temporaryPassword),
  'Geçici şifre belirlendi; kullanıcı ilk girişte değiştirecek.')
export const useDeleteUser = () => useUserMutation((id) => userApi.delete(id), 'Personel arşivlendi.')
export const useRevokeSessions = () => useUserMutation((id) => userApi.revokeSessions(id),
  'Personelin tüm cihazlardaki oturumları sonlandırıldı.')
