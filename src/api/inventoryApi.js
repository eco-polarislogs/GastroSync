import axiosClient from './axiosClient'

/**
 * Inventory API Service Layer.
 *
 * Communicates directly with backend Spring Boot `InventoryController`.
 * Strictly typed request/response contracts ensuring true database persistence.
 */

export const inventoryApi = {
  /**
   * Retrieves all inventory items from PostgreSQL via GET /api/inventory.
   */
  getAll: async () => {
    const res = await axiosClient.get('/inventory')
    // res is unwrapped by response interceptor: { success, message, data }
    return Array.isArray(res) ? res : (res?.data || [])
  },

  /**
   * Retrieves a single inventory item by ID via GET /api/inventory/{id}.
   */
  getById: async (id) => {
    const res = await axiosClient.get(`/inventory/${id}`)
    return res?.data || res
  },

  /**
   * Searches an item by barcode via GET /api/inventory/barcode/{barcode}.
   */
  getByBarcode: async (barcode) => {
    const res = await axiosClient.get(`/inventory/barcode/${barcode}`)
    return res?.data || res
  },

  /**
   * Creates a new inventory item via POST /api/inventory.
   */
  create: async (item) => {
    const res = await axiosClient.post('/inventory', item)
    return res?.data || res
  },

  /**
   * Updates an existing inventory item via PUT /api/inventory/{id}.
   */
  update: async (id, item) => {
    const res = await axiosClient.put(`/inventory/${id}`, item)
    return res?.data || res
  },

  /**
   * Submits stock receipt (Mal Kabul) via POST /api/inventory/{id}/receive.
   * Atomically updates PostgreSQL inventory and creates an immutable StockTransaction record.
   */
  receiveStock: async (id, { quantity, recordedBy }) => {
    const res = await axiosClient.post(`/inventory/${id}/receive`, {
      quantity: parseFloat(quantity),
      recordedBy: recordedBy || 'Depo Sorumlusu'
    })
    return res?.data || res
  },

  /**
   * Submits waste/spoilage (Zayiat/Fire) via POST /api/inventory/{id}/waste.
   * Atomically decrements stock and logs transaction in PostgreSQL.
   */
  recordWaste: async (id, { quantity, reason, recordedBy }) => {
    const res = await axiosClient.post(`/inventory/${id}/waste`, {
      quantity: parseFloat(quantity),
      reason: reason || 'Genel Zayiat',
      recordedBy: recordedBy || 'Depo Sorumlusu'
    })
    return res?.data || res
  },

  /**
   * Retrieves recent audit transactions via GET /api/inventory/transactions/recent.
   */
  getRecentTransactions: async () => {
    const res = await axiosClient.get('/inventory/transactions/recent')
    return Array.isArray(res) ? res : (res?.data || [])
  }
}

export default inventoryApi
