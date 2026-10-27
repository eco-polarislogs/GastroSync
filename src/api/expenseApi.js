import axiosClient from './axiosClient'

/**
 * Enterprise Expense API Service Layer.
 *
 * ═══════════════════════════════════════════════════════════════
 * ARCHITECTURAL DESIGN (Thesis Defense Note)
 * ═══════════════════════════════════════════════════════════════
 *
 * 1. SERVICE LAYER ABSTRACTION (Separation of Concerns):
 *    All network communication with the Spring Boot `/api/expenses`
 *    controller is encapsulated here. UI components and TanStack Query
 *    hooks never make raw HTTP calls or construct URL strings directly.
 *
 * 2. STANDARDIZED API RESPONSE UNWRAPPING:
 *    The Spring Boot backend wraps payloads inside `ApiResponse<T>`:
 *    `{ success: true, message: "...", data: T, timestamp: "..." }`.
 *    Our Axios response interceptor unwraps `response.data`, and this
 *    service guarantees predictable domain payloads to consumers.
 *
 * 3. STRICT CONTRACT CONFORMANCE:
 *    All mutations (create, update) send payloads conforming to
 *    `ExpenseCreateRequest` and receive `ExpenseResponse` with full
 *    JPA audit metadata (`createdAt`, `createdBy`, `lastModifiedBy`).
 */

export const expenseApi = {
  /**
   * Retrieves all non-deleted expenses via GET /api/expenses.
   * Filtered at database level by Hibernate @SQLRestriction("is_deleted = false").
   */
  getAll: async () => {
    const res = await axiosClient.get('/expenses')
    return Array.isArray(res) ? res : (res?.data || [])
  },

  /**
   * Retrieves a single expense by ID via GET /api/expenses/{id}.
   */
  getById: async (id) => {
    const res = await axiosClient.get(`/expenses/${id}`)
    return res?.data || res
  },

  /**
   * Retrieves aggregated financial summary via GET /api/expenses/summary.
   * Returns: { totalExpenses, fixedTotal, variableTotal, count }
   */
  getSummary: async () => {
    const res = await axiosClient.get('/expenses/summary')
    return res?.data || res
  },

  /**
   * Retrieves expenses filtered by category (FIXED or VARIABLE).
   */
  getByCategory: async (category) => {
    const res = await axiosClient.get(`/expenses/category/${category}`)
    return Array.isArray(res) ? res : (res?.data || [])
  },

  /**
   * Creates a new Expense record in PostgreSQL via POST /api/expenses.
   * Validated by backend Jakarta Validation (@Valid).
   * Automatically populates JPA audit columns (@CreatedBy, @CreatedDate).
   */
  create: async (expenseData) => {
    const res = await axiosClient.post('/expenses', expenseData)
    return res?.data || res
  },

  /**
   * Updates an existing Expense record via PUT /api/expenses/{id}.
   * Automatically updates @LastModifiedBy and @LastModifiedDate.
   */
  update: async (id, expenseData) => {
    const res = await axiosClient.put(`/expenses/${id}`, expenseData)
    return res?.data || res
  },

  /**
   * Soft-deletes an Expense record via DELETE /api/expenses/{id}.
   * Triggers Hibernate @SQLDelete:
   * UPDATE expenses SET is_deleted = true, deleted_at = CURRENT_TIMESTAMP WHERE id = ?
   */
  delete: async (id) => {
    const res = await axiosClient.delete(`/expenses/${id}`)
    return res?.data || res
  },

  /**
   * Approves an Expense (Manager / Accountant -> APPROVED).
   */
  approve: async (id) => {
    const res = await axiosClient.put(`/expenses/${id}/approve`)
    return res?.data || res
  },

  /**
   * Finalizes an Expense in official ledger (SMMM Financial Advisor -> FINALIZED).
   */
  finalize: async (id) => {
    const res = await axiosClient.put(`/expenses/${id}/finalize`)
    return res?.data || res
  },

  /**
   * Rejects an Expense with reason.
   */
  reject: async (id, reason) => {
    const res = await axiosClient.put(`/expenses/${id}/reject`, { reason })
    return res?.data || res
  }
}

export default expenseApi
