import React, { useEffect, useMemo, useState } from 'react'
import { FiUserPlus, FiSearch, FiEdit2, FiTrash2, FiKey, FiShield, FiCheck, FiSlash, FiSmartphone } from 'react-icons/fi'
import { ROLES, ROLE_ORDER, ROLE_LABELS, ROLE_COLORS, useAuthStore } from '../store'
import {
  useUserSearch, useRoleCatalog, useCreateUser, useUpdateUserRole, useDeleteUser, useSetUserActive, useResetPassword, useRevokeSessions,
  useUpdateUserProfile,
} from '../hooks/useUserQuery'
import {
  PageHeader, Card, Button, Modal, Field, Notice, Badge, DataTable, Pagination, serverPager, sortParam, Loading,
  ErrorState, EmptyState, StatGrid, Stat,
} from '../components/ui'
import { SCREENS } from '../utils/routes'
import { formatDateTime } from '../utils/format'

const passwordProblems = (p) => {
  const e = []
  if ((p || '').length < 8) e.push('en az 8 karakter')
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(p || '')) e.push('en az bir harf')
  if (!/\d/.test(p || '')) e.push('en az bir rakam')
  return e
}

const EMPTY_FORM = { name: '', username: '', email: '', role: ROLES.CASHIER, password: '', requirePasswordChange: false }

function RoleBadge({ role }) {
  return (
    <span className="gs-badge" style={{ background: `${ROLE_COLORS[role]}1a`, color: ROLE_COLORS[role], borderColor: `${ROLE_COLORS[role]}55` }}>
      {ROLE_LABELS[role] || role}
    </span>
  )
}

/** Seçilen rolün görev tanımı, göreceği ekranlar ve izinleri (sunucudaki yetki tablosundan) */
function RoleScope({ catalog, role }) {
  const entry = (catalog || []).find((r) => r.role.toLowerCase() === role)
  if (!entry) return null
  return (
    <div className="gs-notice gs-notice--info" style={{ display: 'block' }}>
      <strong>{ROLE_LABELS[role]}</strong>: {entry.description}
      <div style={{ marginTop: 6 }}>
        <span className="gs-muted">Göreceği ekranlar: </span>
        {entry.screens.map((s) => SCREENS[s]?.label || s).join(', ')}
      </div>
      <details style={{ marginTop: 6 }}>
        <summary style={{ cursor: 'pointer' }}>Yetkiler ({entry.permissions.length})</summary>
        <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
          {entry.permissions.map((p) => <li key={p.code}>{p.label}</li>)}
        </ul>
      </details>
    </div>
  )
}

/**
 * Personel yönetimi (yalnızca Yönetici). Yöneticinin kaydettiği kişi, verilen kullanıcı adı / e-posta
 * ve şifreyle giriş yapar; menüsü ve yetkileri sunucudaki rol tablosundan gelir.
 */
export default function UsersPage() {
  const me = useAuthStore((s) => s.user)
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  const [role, setRole] = useState('all')
  const [status, setStatus] = useState('all')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [page, setPage] = useState(0)
  const [size, setSize] = useState(20)

  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])
  useEffect(() => { setPage(0) }, [q, role, status, sort, size])

  const params = { q: q || undefined, role: role === 'all' ? undefined : role.toUpperCase(), status, sort: sortParam(sort), page, size }
  const { data, isLoading, error, refetch } = useUserSearch(params)
  const { data: catalog } = useRoleCatalog()
  const meta = data?.meta || {}

  const createM = useCreateUser()
  const roleM = useUpdateUserRole()
  const activeM = useSetUserActive()
  const resetM = useResetPassword()
  const revokeM = useRevokeSessions()
  const profileM = useUpdateUserProfile()
  const deleteM = useDeleteUser()

  const [form, setForm] = useState(EMPTY_FORM)
  const [createOpen, setCreateOpen] = useState(false)
  const [roleTarget, setRoleTarget] = useState(null)
  const [resetTarget, setResetTarget] = useState(null)
  const [editTarget, setEditTarget] = useState(null)
  const [deleteTarget, setDeleteTarget] = useState(null)

  const pwErrors = passwordProblems(form.password)
  const usernameOk = /^[a-zA-Z0-9._-]{3,50}$/.test(form.username)
  const canSubmit = form.name.trim().length >= 2 && usernameOk && !pwErrors.length

  const submitCreate = (e) => {
    e?.preventDefault()
    if (!canSubmit) return
    createM.mutate({
      name: form.name.trim(),
      username: form.username.trim().toLowerCase(),
      email: form.email.trim() || undefined,
      role: form.role.toUpperCase(),
      password: form.password,
      requirePasswordChange: !!form.requirePasswordChange,
    }, { onSuccess: () => { setCreateOpen(false); setForm(EMPTY_FORM) } })
  }

  const columns = useMemo(() => [
    {
      key: 'name', sortKey: 'name', title: 'Personel',
      render: (u) => (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="gs-avatar" style={{ background: ROLE_COLORS[u.role] }}>{u.avatar}</span>
          <div>
            <div className="gs-cell-title">{u.name}{u.id === me?.id && <span className="gs-muted"> (siz)</span>}</div>
            <div className="gs-cell-sub">@{u.username}{u.email ? ` · ${u.email}` : ''}</div>
          </div>
        </div>
      ),
    },
    { key: 'role', sortKey: 'role', title: 'Rol', render: (u) => <RoleBadge role={u.role} /> },
    {
      key: 'active', sortKey: 'active', title: 'Durum',
      render: (u) => (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
          <Badge tone={u.active ? 'success' : 'neutral'}>{u.active ? 'Aktif' : 'Pasif'}</Badge>
          {u.mustChangePassword && <Badge tone="warning">İlk girişte şifre değiştirecek</Badge>}
        </div>
      ),
    },
    { key: 'lastLoginAt', sortKey: 'lastLoginAt', title: 'Son giriş', render: (u) => (u.lastLoginAt ? formatDateTime(u.lastLoginAt) : <span className="gs-muted">Henüz yok</span>) },
    {
      key: 'actions', title: '', align: 'right',
      render: (u) => (
        <div className="gs-actions">
          <Button size="sm" variant="ghost" title="Bilgileri düzenle" onClick={() => setEditTarget({ id: u.id, name: u.name, email: u.email })}><FiEdit2 /></Button>
          <Button size="sm" variant="ghost" title="Rol değiştir" onClick={() => setRoleTarget({ id: u.id, name: u.name, role: u.role })}><FiShield /></Button>
          <Button size="sm" variant="ghost" title="Geçici şifre belirle" onClick={() => setResetTarget({ id: u.id, name: u.name, password: '' })}><FiKey /></Button>
          {u.id !== me?.id && (
            <>
              <Button size="sm" variant="ghost" title={u.active ? 'Pasife al' : 'Aktifleştir'} loading={activeM.isPending}
                onClick={() => activeM.mutate({ id: u.id, active: !u.active })}>
                {u.active ? <FiSlash /> : <FiCheck />}
              </Button>
              <Button size="sm" variant="ghost" title="Tüm cihaz oturumlarını sonlandır (kayıp telefon / işten ayrılma)" loading={revokeM.isPending && revokeM.variables === u.id}
                onClick={() => revokeM.mutate(u.id)}><FiSmartphone /></Button>
              <Button size="sm" variant="ghost" title="Arşivle" onClick={() => setDeleteTarget(u)}><FiTrash2 /></Button>
            </>
          )}
        </div>
      ),
    },
  ], [me?.id, activeM])

  return (
    <div className="gs-page animate-fade-in">
      <PageHeader actions={<Button onClick={() => setCreateOpen(true)}><FiUserPlus /> Personel Ekle</Button>} />

      <StatGrid>
        <Stat label="Toplam personel" value={meta.total ?? '…'} hint={`${meta.activeCount ?? 0} aktif`} />
        {ROLE_ORDER.filter((r) => r !== ROLES.ADMIN).slice(0, 5).map((r) => (
          <Stat key={r} label={ROLE_LABELS[r]} value={meta.roleCounts?.[r.toUpperCase()] ?? 0} />
        ))}
      </StatGrid>

      <Card padded>
        <div className="gs-filterbar">
          <div className="gs-search">
            <FiSearch />
            <input className="gs-input" placeholder="Ad, kullanıcı adı veya e-posta ara…" value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <select className="gs-select" value={role} onChange={(e) => setRole(e.target.value)} aria-label="Rol" style={{ maxWidth: 210 }}>
            <option value="all">Tüm roller</option>
            {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
          </select>
          <select className="gs-select" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Durum" style={{ maxWidth: 160 }}>
            <option value="all">Tüm durumlar</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
        </div>
        {isLoading ? <Loading /> : error ? <ErrorState message={error.message} onRetry={refetch} /> : (
          <>
            <DataTable
              rows={data?.content || []}
              columns={columns}
              sort={sort}
              onSortChange={(s) => setSort(s || { key: 'name', dir: 'asc' })}
              empty={<EmptyState title="Personel bulunamadı" description="Arama veya filtreyi değiştirin." />}
            />
            <Pagination {...serverPager(data, setPage, setSize)} />
          </>
        )}
      </Card>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Yeni Personel"
        width={620}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Vazgeç</Button>
            <Button loading={createM.isPending} disabled={!canSubmit} onClick={submitCreate}>Kaydet</Button>
          </>
        )}
      >
        <form className="gs-form" onSubmit={submitCreate}>
          <div className="gs-form-row">
            <Field label="Ad soyad" required>
              <input className="gs-input" value={form.name} maxLength={100} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Rol" required>
              <select className="gs-select" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>
          </div>
          <RoleScope catalog={catalog} role={form.role} />
          <div className="gs-form-row">
            <Field label="Kullanıcı adı" required hint={form.username && !usernameOk ? '3-50 karakter; harf, rakam, nokta, tire, alt çizgi' : 'Girişte kullanılır'}>
              <input className="gs-input" value={form.username} maxLength={50} autoComplete="off"
                onChange={(e) => setForm({ ...form, username: e.target.value.replace(/\s/g, '') })} />
            </Field>
            <Field label="E-posta" hint="İsteğe bağlı; girişte kullanıcı adı yerine kullanılabilir">
              <input className="gs-input" type="email" value={form.email} maxLength={120} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </Field>
          </div>
          <Field label="Şifre" required hint={form.password && pwErrors.length ? `Eksik: ${pwErrors.join(', ')}` : 'En az 8 karakter, harf ve rakam'}>
            <input className="gs-input" type="text" value={form.password} maxLength={100} autoComplete="new-password"
              onChange={(e) => setForm({ ...form, password: e.target.value })} />
          </Field>
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <input type="checkbox" checked={form.requirePasswordChange} onChange={(e) => setForm({ ...form, requirePasswordChange: e.target.checked })} />
            İlk girişte kendi şifresini belirlesin
          </label>
          <Notice tone="info">Kaydedilen kişi bu bilgilerle hemen giriş yapar ve yalnızca seçtiğiniz rolün ekranlarını görür.</Notice>
        </form>
      </Modal>

      <Modal
        open={!!roleTarget}
        onClose={() => setRoleTarget(null)}
        title={`Rol değiştir · ${roleTarget?.name || ''}`}
        width={600}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setRoleTarget(null)}>Vazgeç</Button>
            <Button loading={roleM.isPending} onClick={() => roleM.mutate({ id: roleTarget.id, role: roleTarget.role.toUpperCase() }, { onSuccess: () => setRoleTarget(null) })}>Rolü Kaydet</Button>
          </>
        )}
      >
        {roleTarget && (
          <div className="gs-form">
            <Field label="Yeni rol">
              <select className="gs-select" value={roleTarget.role} onChange={(e) => setRoleTarget({ ...roleTarget, role: e.target.value })}>
                {ROLE_ORDER.map((r) => <option key={r} value={r}>{ROLE_LABELS[r]}</option>)}
              </select>
            </Field>
            <RoleScope catalog={catalog} role={roleTarget.role} />
            <Notice tone="warning">Değişiklik anında geçerlidir: kişinin açık oturumları (web ve mobil) yeni rolün ekranına taşınır.</Notice>
          </div>
        )}
      </Modal>

      <Modal
        open={!!resetTarget}
        onClose={() => setResetTarget(null)}
        title={`Geçici şifre · ${resetTarget?.name || ''}`}
        footer={(
          <>
            <Button variant="secondary" onClick={() => setResetTarget(null)}>Vazgeç</Button>
            <Button loading={resetM.isPending} disabled={!!passwordProblems(resetTarget?.password).length}
              onClick={() => resetM.mutate({ id: resetTarget.id, temporaryPassword: resetTarget.password }, { onSuccess: () => setResetTarget(null) })}>
              Şifreyi Belirle
            </Button>
          </>
        )}
      >
        {resetTarget && (
          <div className="gs-form">
            <Field label="Geçici şifre" hint="En az 8 karakter, harf ve rakam">
              <input className="gs-input" value={resetTarget.password} onChange={(e) => setResetTarget({ ...resetTarget, password: e.target.value })} />
            </Field>
            <Notice tone="info">Kişinin açık oturumları kapanır; ilk girişte kendi şifresini belirler.</Notice>
          </div>
        )}
      </Modal>

      <Modal
        open={!!editTarget}
        onClose={() => setEditTarget(null)}
        title="Personel bilgileri"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setEditTarget(null)}>Vazgeç</Button>
            <Button loading={profileM.isPending} disabled={(editTarget?.name || '').trim().length < 2}
              onClick={() => profileM.mutate({ id: editTarget.id, name: editTarget.name.trim(), email: editTarget.email.trim() }, { onSuccess: () => setEditTarget(null) })}>
              Kaydet
            </Button>
          </>
        )}
      >
        {editTarget && (
          <div className="gs-form">
            <Field label="Ad soyad"><input className="gs-input" value={editTarget.name} onChange={(e) => setEditTarget({ ...editTarget, name: e.target.value })} /></Field>
            <Field label="E-posta"><input className="gs-input" type="email" value={editTarget.email} onChange={(e) => setEditTarget({ ...editTarget, email: e.target.value })} /></Field>
          </div>
        )}
      </Modal>

      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Personeli arşivle"
        footer={(
          <>
            <Button variant="secondary" onClick={() => setDeleteTarget(null)}>Vazgeç</Button>
            <Button variant="danger" loading={deleteM.isPending} onClick={() => deleteM.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) })}>Arşivle</Button>
          </>
        )}
      >
        {deleteTarget && (
          <Notice tone="warning">
            <strong>{deleteTarget.name}</strong> (@{deleteTarget.username}) arşivlenir ve giriş yapamaz. Geçmiş kayıtları ve denetim izi korunur; kullanıcı adı tekrar verilmez.
          </Notice>
        )}
      </Modal>
    </div>
  )
}
