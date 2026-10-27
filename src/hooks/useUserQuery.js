import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import userApi from '../api/userApi'
import { notifySuccess, notifyError } from '../utils/notify'

export const USER_KEYS = {
  all: ['users'],
  lists: () => [...USER_KEYS.all, 'list'],
  details: () => [...USER_KEYS.all, 'detail'],
  detail: (id) => [...USER_KEYS.details(), id]
}

export function useUsers() {
  return useQuery({
    queryKey: USER_KEYS.lists(),
    queryFn: userApi.getAll,
    staleTime: 1000 * 60 * 3, // 3 minutes
    select: (data) => {
      return Array.isArray(data)
        ? data.map((u) => {
            const roleKey = (u.role || 'manager').toLowerCase()
            const initials = u.name
              ? u.name.split(' ').map((n) => n[0]).join('').substring(0, 2).toUpperCase()
              : 'GS'
            return {
              id: u.id,
              name: u.name,
              username: u.username,
              email: u.email || `${u.username}@gastrosync.com`,
              role: roleKey,
              avatar: initials,
              lastLogin: 'Bugün, Aktif'
            }
          })
        : []
    }
  })
}

export function useCreateUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userData) => userApi.create(userData),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.all })
      notifySuccess(`Kullanıcı (${data?.username || 'yeni'}) başarıyla oluşturuldu!`, 'Kullanıcı Yönetimi')
    },
    onError: (error) => {
      notifyError(error.message || 'Kullanıcı oluşturulamadı', 'Hata')
    }
  })
}

export function useUpdateUserRole() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, role }) => userApi.updateRole(id, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.all })
      notifySuccess('Kullanıcı rolü ve erişim yetkileri güncellendi.', 'Yetkilendirme (RBAC)')
    },
    onError: (error) => {
      notifyError(error.message || 'Rol güncelleme başarısız', 'Hata')
    }
  })
}

export function useDeleteUser() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id) => userApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: USER_KEYS.all })
      notifySuccess('Kullanıcı hesabı başarıyla silindi.', 'Kullanıcı Yönetimi')
    },
    onError: (error) => {
      notifyError(error.message || 'Kullanıcı silinemedi', 'Hata')
    }
  })
}
