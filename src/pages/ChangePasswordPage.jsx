import React, { useEffect, useState } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { FiLock, FiSmartphone } from 'react-icons/fi'
import { useAuthStore } from '../store'
import { getDefaultRoute } from '../utils/routes'
import { Button, Field, Notice } from '../components/ui'
import { authApi } from '../api'
import { formatDateTime } from '../utils/format'
import { notifyError } from '../utils/notify'

const policyErrors = (p) => {
  const errors = []
  if (p.length < 8) errors.push('en az 8 karakter')
  if (!/[A-Za-zÇĞİÖŞÜçğıöşü]/.test(p)) errors.push('en az bir harf')
  if (!/\d/.test(p)) errors.push('en az bir rakam')
  return errors
}

/** İlk girişte veya şifre sıfırlamasından sonra zorunlu; isteğe bağlı olarak da kullanılabilir */
export default function ChangePasswordPage() {
  const navigate = useNavigate()
  const { isAuthenticated, user, changePassword, logout } = useAuthStore()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [repeat, setRepeat] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (!isAuthenticated) return <Navigate to="/login" replace />

  const errors = next ? policyErrors(next) : []
  const mismatch = repeat && next !== repeat

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    if (errors.length || mismatch || !current) return
    setBusy(true)
    const res = await changePassword(current, next)
    setBusy(false)
    if (res.success) {
      const updated = useAuthStore.getState().user
      navigate(getDefaultRoute(updated), { replace: true })
    } else {
      setError(res.message)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--color-bg)', padding: 16 }}>
      <form className="gs-card" style={{ width: '100%', maxWidth: 440 }} onSubmit={submit}>
        <div className="gs-card-header"><h3 className="gs-card-title"><FiLock /> Şifre Belirleme</h3></div>
        <div className="gs-card-body gs-form">
          {user?.mustChangePassword && (
            <Notice tone="warning">Güvenliğiniz için devam etmeden önce yöneticinizin verdiği geçici şifreyi kendi şifrenizle değiştirmelisiniz.</Notice>
          )}
          <Field label="Mevcut (geçici) şifre" required>
            <input className="gs-input" type="password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} required />
          </Field>
          <Field label="Yeni şifre" required hint={errors.length ? `Eksik: ${errors.join(', ')}` : 'En az 8 karakter, harf ve rakam içermeli'}>
            <input className="gs-input" type="password" autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} required />
          </Field>
          <Field label="Yeni şifre (tekrar)" required hint={mismatch ? 'Şifreler eşleşmiyor' : ''}>
            <input className="gs-input" type="password" autoComplete="new-password" value={repeat} onChange={(e) => setRepeat(e.target.value)} required />
          </Field>
          {error && <Notice tone="danger">{error}</Notice>}
          <Button type="submit" loading={busy} disabled={!current || !next || errors.length > 0 || next !== repeat}>Şifreyi Kaydet</Button>
          <Button variant="ghost" onClick={() => { logout(); navigate('/login') }}>Çıkış yap</Button>
          <p className="gs-muted">Şifre değiştiğinde diğer cihazlardaki açık oturumlar sonlandırılır.</p>
          {!user?.mustChangePassword && <SessionsBox onLoggedOut={() => { logout(); navigate('/login') }} />}
        </div>
      </form>
    </div>
  )
}

/** KVKK / Google Play: hesabın silinmesi talebi işletme yöneticisine bildirim olarak gider */
function DeletionRequest() {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  if (sent) return <Notice tone="success">Hesap silme talebiniz yöneticiye iletildi. En geç 30 gün içinde sonuçlandırılır.</Notice>
  if (!open) return <Button type="button" variant="ghost" onClick={() => setOpen(true)}>Hesabımı silme talebi</Button>
  const send = async () => {
    setBusy(true)
    try { await authApi.requestAccountDeletion(reason.trim()); setSent(true) } catch (err) { notifyError(err.message) } finally { setBusy(false) }
  }
  return (
    <div className="gs-form">
      <Field label="Açıklama (isteğe bağlı)"><input className="gs-input" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
      <Button type="button" variant="danger" loading={busy} onClick={send}>Silme talebini gönder</Button>
    </div>
  )
}

/** Açık cihaz oturumları ve "tüm cihazlardan çık" (kayıp / çalıntı telefon) */
function SessionsBox({ onLoggedOut }) {
  const [sessions, setSessions] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    authApi.sessions().then(setSessions).catch(() => setSessions([]))
  }, [])
  const logoutAll = async () => {
    setBusy(true)
    try {
      await authApi.logoutAll()
      onLoggedOut()
    } catch (err) {
      notifyError(err.message)
      setBusy(false)
    }
  }
  return (
    <div style={{ borderTop: '1px solid var(--color-border)', paddingTop: 12, marginTop: 4 }}>
      <strong><FiSmartphone /> Açık oturumlar</strong>
      {sessions === null ? <p className="gs-muted">Yükleniyor…</p> : sessions.length === 0 ? <p className="gs-muted">Kayıtlı cihaz oturumu yok.</p> : (
        <ul style={{ paddingLeft: 18, margin: '6px 0' }}>
          {sessions.map((s, i) => (
            <li key={i} className="gs-cell-sub">
              {String(s.device || 'Cihaz').slice(0, 60)} · {s.ip || '-'} · son etkinlik {formatDateTime(s.lastActiveAt)}
            </li>
          ))}
        </ul>
      )}
      <Button type="button" variant="danger" loading={busy} onClick={logoutAll}>Tüm cihazlardan çık</Button>
      <p className="gs-muted">Telefonunuzu kaybettiyseniz kullanın: tüm cihazlardaki oturumlar hemen kapanır.</p>
      <DeletionRequest />
      <p className="gs-muted"><a href="/privacy" target="_blank" rel="noreferrer">Gizlilik Politikası</a> · <a href="/account-deletion" target="_blank" rel="noreferrer">Hesap ve veri silme</a></p>
    </div>
  )
}
