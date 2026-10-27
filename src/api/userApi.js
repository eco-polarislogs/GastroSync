import axiosClient from './axiosClient'

/**
 * Enterprise User Management API Service.
 * Connects directly to Spring Boot `UserController` (/api/users).
 * Protected by Spring Security RBAC (@PreAuthorize).
 */
export const userApi = {
  /**
   * Retrieves all users via GET /api/users (ADMIN & MANAGER).
   */
  getAll: async () => {
    const res = await axiosClient.get('/users')
    return Array.isArray(res) ? res : (res?.data || [])
  },

  /**
   * Retrieves user by ID via GET /api/users/{id}.
   */
  getById: async (id) => {
    const res = await axiosClient.get(`/users/${id}`)
    return res?.data || res
  },

  /**
   * Creates a new user via POST /api/users (ADMIN only).
   */
  create: async (userData) => {
    const res = await axiosClient.post('/users', userData)
    return res?.data || res
  },

  /**
   * Updates user role via PUT /api/users/{id}/role (ADMIN only).
   */
  updateRole: async (id, role) => {
    const res = await axiosClient.put(`/users/${id}/role`, { role })
    return res?.data || res
  },

  /**
   * Deletes user via DELETE /api/users/{id} (ADMIN only).
   */
  delete: async (id) => {
    const res = await axiosClient.delete(`/users/${id}`)
    return res?.data || res
  }
}

export default userApi
