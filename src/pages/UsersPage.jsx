import React, { useState, useEffect, useMemo } from 'react'
import { ROLES, ROLE_LABELS, ROLE_COLORS, useAuthStore } from '../store'
import { FiShield, FiMail, FiUserPlus, FiTrash2, FiEdit2, FiCheck, FiX, FiRefreshCw, FiSearch, FiFilter } from 'react-icons/fi'
import { notifySuccess, notifyError } from '../utils/notify'
import '../styles/pages.css'

const ROLE_MODULES = {
  [ROLES.ADMIN]: 'Tüm Sayfalar, Kullanıcı Yönetimi, Rol Atama, Sistem Logları',
  [ROLES.MANAGER]: 'Dashboard, Finansal Raporlar, Satış Analizleri, Tüm Reçeteler',
  [ROLES.CHEF]: 'Reçete Yönetimi, Üretim Planlama, Menü Tasarımı, Stok (Görüntüleme)',
  [ROLES.WAREHOUSE]: 'Mobil Mal Kabul (Barkod), Zayiat Bildirimi, Sayım Ekranı',
}

export default function UsersPage() {
  const currentUser = useAuthStore((s) => s.user)
  const isSuperAdmin = currentUser?.role === ROLES.ADMIN

  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [showAddModal, setShowAddModal] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  // New user form state
  const [newUser, setNewUser] = useState({
    name: '',
    username: '',
    email: '',
    role: ROLES.MANAGER,
    password: '123456',
  })

  // Role editing state
  const [editingUserId, setEditingUserId] = useState(null)
  const [selectedRole, setSelectedRole] = useState('')

  // Search & Filter state
  const [searchQuery, setSearchQuery] = useState('')
  const [filterRole, setFilterRole] = useState('all')

  // Filtered users based on search and role filter
  const filteredUsers = useMemo(() => {
    let result = users
    if (filterRole !== 'all') {
      result = result.filter((u) => u.role === filterRole)
    }
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      result = result.filter(
        (u) =>
          u.name.toLowerCase().includes(q) ||
          u.email.toLowerCase().includes(q) ||
          u.username.toLowerCase().includes(q)
      )
    }
    return result
  }, [users, searchQuery, filterRole])

  const fetchUsers = async () => {
    setLoading(true)
    try {
      const res = await fetch('http://localhost:8080/api/users')
      if (res.ok) {
        const data = await res.json()
        const formatted = data.map((u) => {
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
            lastLogin: 'Bugün, Aktif',
          }
        })
        setUsers(formatted)
      } else {
        notifyError('Kullanıcı listesi alınamadı')
      }
    } catch (err) {
      console.warn('Backend erişim hatası, yerel veriler kullanılıyor:', err)
      // Fallback local list
      setUsers([
        { id: 1, name: 'Ahmet Yılmaz', username: 'admin', email: 'admin@gastrosync.com', role: ROLES.ADMIN, avatar: 'AY', lastLogin: 'Bugün, 09:15' },
        { id: 2, name: 'Zeynep Kaya', username: 'manager', email: 'manager@gastrosync.com', role: ROLES.MANAGER, avatar: 'ZK', lastLogin: 'Bugün, 08:30' },
        { id: 3, name: 'Mehmet Şef', username: 'chef', email: 'chef@gastrosync.com', role: ROLES.CHEF, avatar: 'MŞ', lastLogin: 'Dün, 17:45' },
        { id: 4, name: 'Ali Depocu', username: 'warehouse', email: 'warehouse@gastrosync.com', role: ROLES.WAREHOUSE, avatar: 'AD', lastLogin: 'Bugün, 14:00' },
      ])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleCreateUser = async (e) => {
    e.preventDefault()
    if (!newUser.name || !newUser.username) {
      notifyError('Lütfen ad soyad ve kullanıcı adı alanlarını doldurun')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('http://localhost:8080/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newUser.name.trim(),
          username: newUser.username.trim().toLowerCase(),
          email: newUser.email.trim() || `${newUser.username.trim().toLowerCase()}@gastrosync.com`,
          role: newUser.role.toUpperCase(),
          password: newUser.password || '123456',
        }),
      })

      if (res.ok) {
        notifySuccess(`${newUser.name} sisteme başarıyla kaydedildi!`, 'Kullanıcı Eklendi')
        setShowAddModal(false)
        setNewUser({ name: '', username: '', email: '', role: ROLES.MANAGER, password: '123456' })
        fetchUsers()
      } else {
        const errData = await res.json()
        notifyError(errData.message || 'Kullanıcı eklenemedi')
      }
    } catch (err) {
      notifyError('Sunucuya bağlanırken bir sorun oluştu')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUpdateRole = async (userId) => {
    if (!selectedRole) return
    try {
      const res = await fetch(`http://localhost:8080/api/users/${userId}/role`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: selectedRole.toUpperCase() }),
      })

      if (res.ok) {
        notifySuccess(`Kullanıcı rolü ${ROLE_LABELS[selectedRole]} olarak güncellendi!`, 'Rol Güncellendi')
        setEditingUserId(null)
        setUsers((prev) =>
          prev.map((u) => (u.id === userId ? { ...u, role: selectedRole } : u))
        )
      } else {
        const errData = await res.json()
        notifyError(errData.message || 'Rol güncellenemedi')
      }
    } catch (err) {
      notifyError('Bağlantı hatası oluştu')
    }
  }

  const handleDeleteUser = async (user) => {
    if (user.role === ROLES.ADMIN || user.username === 'admin') {
      notifyError('Ana yönetici hesabı sistemden silinemez!')
      return
    }

    const confirmed = window.confirm(`${user.name} (${user.username}) kullanıcısını sistemden çıkarmak / görevden almak istediğinize emin misiniz?`)
    if (!confirmed) return

    try {
      const res = await fetch(`http://localhost:8080/api/users/${user.id}`, {
        method: 'DELETE',
      })

      if (res.ok) {
        notifySuccess(`${user.name} sistemden çıkarıldı.`, 'Görevden Alındı')
        setUsers((prev) => prev.filter((u) => u.id !== user.id))
      } else {
        const errData = await res.json()
        notifyError(errData.message || 'Kullanıcı silinemedi')
      }
    } catch (err) {
      notifyError('Bağlantı hatası oluştu')
    }
  }

  return (
    <div className="page-container">
      {/* Action Buttons Row */}
      <div className="page-header-row" style={{ justifyContent: 'flex-end', marginBottom: '-8px' }}>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <button
            className="action-btn action-btn--secondary"
            onClick={fetchUsers}
            title="Yenile"
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <FiRefreshCw className={loading ? 'animate-spin' : ''} /> Listeyi Yenile
          </button>

          {isSuperAdmin && (
            <button
              className="action-btn action-btn--primary"
              onClick={() => setShowAddModal(true)}
              style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
            >
              <FiUserPlus size={16} /> Yeni Kullanıcı / Rol Ata
            </button>
          )}
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="users-toolbar">
        <div className="users-search-wrapper">
          <FiSearch className="users-search-icon" />
          <input
            type="text"
            className="users-search-input"
            placeholder="Personel adı, e-posta veya kullanıcı adı ara..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        <div className="users-filter-group">
          <FiFilter className="users-filter-icon" size={15} />
          <select
            className="users-filter-select"
            value={filterRole}
            onChange={(e) => setFilterRole(e.target.value)}
          >
            <option value="all">Tüm Roller</option>
            <option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option>
            <option value={ROLES.MANAGER}>{ROLE_LABELS[ROLES.MANAGER]}</option>
            <option value={ROLES.CHEF}>{ROLE_LABELS[ROLES.CHEF]}</option>
            <option value={ROLES.WAREHOUSE}>{ROLE_LABELS[ROLES.WAREHOUSE]}</option>
          </select>
        </div>

        <span className="users-result-count">
          <strong>{filteredUsers.length}</strong> / {users.length} personel
        </span>
      </div>

      {/* Users Grid */}
      <div className="users-grid">
        {filteredUsers.map((user) => (
          <div key={user.id} className="user-card animate-fade-in">
            <div className="user-card-top">
              <div
                className="user-card-avatar"
                style={{ backgroundColor: ROLE_COLORS[user.role] }}
              >
                {user.avatar}
              </div>
              <div className="user-card-info">
                <h3 className="user-card-name">{user.name}</h3>
                <span className="user-card-email">
                  <FiMail size={12} /> {user.email}
                </span>
                <span className="user-card-uname" style={{ fontSize: '0.75rem', color: '#64748b' }}>
                  Kullanıcı Adı: <strong>{user.username}</strong>
                </span>
              </div>
            </div>

            {/* Role Box & Inline Assignment */}
            <div className="user-card-role" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <FiShield size={15} style={{ color: ROLE_COLORS[user.role] }} />
                {editingUserId === user.id ? (
                  <select
                    className="role-select-inline"
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value)}
                  >
                    <option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option>
                    <option value={ROLES.MANAGER}>{ROLE_LABELS[ROLES.MANAGER]}</option>
                    <option value={ROLES.CHEF}>{ROLE_LABELS[ROLES.CHEF]}</option>
                    <option value={ROLES.WAREHOUSE}>{ROLE_LABELS[ROLES.WAREHOUSE]}</option>
                  </select>
                ) : (
                  <span style={{ color: ROLE_COLORS[user.role], fontWeight: 700, fontSize: '0.9rem' }}>
                    {ROLE_LABELS[user.role]}
                  </span>
                )}
              </div>

              {isSuperAdmin && user.username !== 'admin' && (
                <div style={{ display: 'flex', gap: '6px' }}>
                  {editingUserId === user.id ? (
                    <>
                      <button
                        className="role-action-btn role-action-btn--confirm"
                        onClick={() => handleUpdateRole(user.id)}
                        title="Rolü Kaydet"
                      >
                        <FiCheck size={14} />
                      </button>
                      <button
                        className="role-action-btn role-action-btn--cancel"
                        onClick={() => setEditingUserId(null)}
                        title="İptal"
                      >
                        <FiX size={14} />
                      </button>
                    </>
                  ) : (
                    <button
                      className="role-action-btn"
                      onClick={() => {
                        setEditingUserId(user.id)
                        setSelectedRole(user.role)
                      }}
                      title="Görevi Değiştir / Rol Ata"
                    >
                      <FiEdit2 size={13} /> Rol Ata
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="user-card-modules">
              <span className="user-card-modules-label">Erişim Modülleri:</span>
              <span className="user-card-modules-text">{ROLE_MODULES[user.role]}</span>
            </div>

            <div className="user-card-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="user-card-login">Durum: {user.lastLogin}</span>

              {isSuperAdmin && user.username !== 'admin' && (
                <button
                  className="user-dismiss-btn"
                  onClick={() => handleDeleteUser(user)}
                  title="Kullanıcıyı Görevden Al / Sil"
                >
                  <FiTrash2 size={13} /> Görevden Al
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* RBAC Reference Table */}
      <div className="table-card">
        <div className="table-card-header">
          <h3>Rol Tabanlı Yetki & Erişim Matrisi (Backend Doğrulamalı)</h3>
        </div>
        <div className="table-wrapper">
          <table className="data-table-main">
            <thead>
              <tr>
                <th>Rol</th>
                <th>Erişim Sağlayabildiği Modüller</th>
                <th>Temel Yetkiler & Sorumluluk</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <span className="role-tag" style={{ backgroundColor: ROLE_COLORS[ROLES.ADMIN] }}>
                    {ROLE_LABELS[ROLES.ADMIN]}
                  </span>
                </td>
                <td>Tüm Sayfalar, Kullanıcı Yönetimi, Rol Atama, Sistem Logları</td>
                <td>Ana yönetici: Personel ekleme, görevden alma, rol ve yetki hiyerarşisi belirleme</td>
              </tr>
              <tr>
                <td>
                  <span className="role-tag" style={{ backgroundColor: ROLE_COLORS[ROLES.MANAGER] }}>
                    {ROLE_LABELS[ROLES.MANAGER]}
                  </span>
                </td>
                <td>Dashboard, Finansal Raporlar, Satış Analizleri, Reçeteler</td>
                <td>Kârlılık analizi, food cost raporları, maliyet zekası ve ciro takibi</td>
              </tr>
              <tr>
                <td>
                  <span className="role-tag" style={{ backgroundColor: ROLE_COLORS[ROLES.CHEF] }}>
                    {ROLE_LABELS[ROLES.CHEF]}
                  </span>
                </td>
                <td>Reçete Yönetimi, Üretim Planlama, Stok (Görüntüleme)</td>
                <td>Reçete oluşturma, hammadde gramajı düzenleme, porsiyon maliyeti planlama</td>
              </tr>
              <tr>
                <td>
                  <span className="role-tag" style={{ backgroundColor: ROLE_COLORS[ROLES.WAREHOUSE] }}>
                    {ROLE_LABELS[ROLES.WAREHOUSE]}
                  </span>
                </td>
                <td>Mobil Mal Kabul (Barkod), Zayiat Bildirimi, Sayım Ekranı</td>
                <td>Depo terminali: Barkod okuma ile mal kabulü, fire ve zayiat düşümü</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="modal-overlay animate-fade-in" onClick={() => setShowAddModal(false)}>
          <div className="modal-card animate-scale-up" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-header" style={{
              background: 'linear-gradient(135deg, #081c0f 0%, #0a1f11 30%, #153d24 70%, #1b4d30 100%)',
              borderBottom: '3px solid #10b981',
              padding: '24px 28px',
              position: 'relative',
              overflow: 'hidden'
            }}>
              <div style={{ position: 'absolute', top: '-20px', right: '-20px', width: '100px', height: '100px', background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)', borderRadius: '50%' }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', zIndex: 1, position: 'relative' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiUserPlus size={18} style={{ color: '#34d399' }} />
                </div>
                <div>
                  <h3 style={{ color: '#ffffff', margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Yeni Kullanıcı Ekle & Rol Ata</h3>
                  <span style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.75rem', marginTop: '2px', display: 'block' }}>Personel bilgilerini girin ve görev rolü atayın</span>
                </div>
              </div>
              <button className="modal-close-btn" onClick={() => setShowAddModal(false)} style={{
                zIndex: 1, position: 'relative',
                background: 'rgba(255,255,255,0.1)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'rgba(255,255,255,0.7)',
                borderRadius: '8px',
                width: '34px', height: '34px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer'
              }}>
                <FiX size={16} />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="modal-form">
              <div className="modal-field">
                <label>Personel Adı Soyadı *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: Selin Aydın"
                  value={newUser.name}
                  onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
                />
              </div>

              <div className="modal-field">
                <label>Kullanıcı Adı (Sisteme Giriş İçin) *</label>
                <input
                  type="text"
                  required
                  placeholder="Örn: selin.aydin"
                  value={newUser.username}
                  onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                />
              </div>

              <div className="modal-field">
                <label>E-posta Adresi</label>
                <input
                  type="email"
                  placeholder="selin@gastrosync.com"
                  value={newUser.email}
                  onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                />
              </div>

              <div className="modal-field">
                <label>Atanacak Görev Rolü *</label>
                <select
                  value={newUser.role}
                  onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                >
                  <option value={ROLES.MANAGER}>{ROLE_LABELS[ROLES.MANAGER]}</option>
                  <option value={ROLES.CHEF}>{ROLE_LABELS[ROLES.CHEF]}</option>
                  <option value={ROLES.WAREHOUSE}>{ROLE_LABELS[ROLES.WAREHOUSE]}</option>
                  <option value={ROLES.ADMIN}>{ROLE_LABELS[ROLES.ADMIN]}</option>
                </select>
              </div>

              <div className="modal-field">
                <label>Başlangıç Şifresi</label>
                <input
                  type="password"
                  placeholder="Varsayılan: 123456"
                  value={newUser.password}
                  onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                />
                <span style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '4px' }}>
                  Personel sisteme bu şifre ile giriş yapacaktır.
                </span>
              </div>

              <div className="modal-actions" style={{ marginTop: '20px' }}>
                <button
                  type="button"
                  className="action-btn action-btn--secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  İptal
                </button>
                <button
                  type="submit"
                  className="action-btn action-btn--primary"
                  disabled={submitting}
                >
                  {submitting ? 'Kaydediliyor...' : 'Kullanıcıyı Kaydet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
