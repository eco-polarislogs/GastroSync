import React from 'react'
import { Link } from 'react-router-dom'
import { useAuthStore } from '../store'

/**
 * Herkese açık yasal sayfalar (giriş gerektirmez). Google Play mağaza kaydı ve Veri Güvenliği formu
 * bu adresleri ister: /privacy (Gizlilik Politikası) ve /account-deletion (Hesap ve veri silme).
 * Metin seçili arayüz diline göre gösterilir.
 */
const CONTENT = {
  tr: {
    privacyTitle: 'Gizlilik Politikası',
    deletionTitle: 'Hesap ve Veri Silme',
    updated: 'Son güncelleme: 25 Kasım 2026',
    back: 'Girişe dön',
    privacy: [
      ['Kapsam', 'GastroSync, restoran işletmelerinin personeline yönelik bir yönetim panelidir (web ve Android). Hesapları işletme yöneticisi açar; uygulama halka açık kayıt almaz.'],
      ['Toplanan veriler', 'Ad soyad, kullanıcı adı, iş e-postası ve rol; giriş zamanı, IP adresi ve cihaz bilgisi (güvenlik ve denetim izi için); işletme kayıtları (adisyon, stok, gider, kasa); bildirim için cihazın push adresi. Kamera yalnızca barkod okumak için cihazda kullanılır, görüntü kaydedilmez veya gönderilmez.'],
      ['Kullanım amacı', 'Hizmetin sunulması, rol tabanlı yetkilendirme, iş akışı bildirimleri, güvenlik (hatalı giriş kilidi, oturum yönetimi) ve yasal saklama yükümlülükleri. Veriler reklam veya profilleme için kullanılmaz ve satılmaz.'],
      ['Paylaşım', 'Veriler yalnızca işletmenin kendi sunucusunda tutulur. Telefon bildirimleri Expo / Google Firebase Cloud Messaging üzerinden iletilir; bildirim içeriği dışında veri paylaşılmaz.'],
      ['Güvenlik', 'Bağlantılar HTTPS ile şifrelenir; şifreler BCrypt ile özetlenir; oturumlar kısa ömürlü erişim token’ı ve dönen yenileme token’ı ile yönetilir; tüm yetkili işlemler denetim izine yazılır.'],
      ['Saklama', 'Muhasebe ve satış kayıtları Vergi Usul Kanunu gereği 5 yıl saklanır. Hesap silindiğinde kişisel bilgiler kaldırılır veya anonimleştirilir; yasal saklama gerektiren işletme kayıtları kişiyle ilişkilendirilmeden tutulur.'],
      ['Haklarınız (KVKK)', '6698 sayılı Kanun kapsamında verilerinize erişme, düzeltme ve silinmesini isteme hakkınız vardır. Talepler işletme yöneticisine veya aşağıdaki hesap silme yoluyla iletilir.'],
    ],
    deletion: [
      ['Uygulama içinden', 'Giriş yaptıktan sonra Şifre / Güvenlik ekranındaki “Hesabımı silme talebi” bağlantısını kullanın. Talep işletme yöneticisine bildirim olarak gider.'],
      ['Uygulamaya giremiyorsanız', 'Çalıştığınız işletmenin yöneticisine kullanıcı adınızla başvurun; yönetici Personel ekranından hesabınızı kapatır.'],
      ['Silinen ve saklanan veriler', 'Ad, e-posta, oturum ve cihaz kayıtları silinir. Yasal zorunluluk nedeniyle muhasebe / satış kayıtları 5 yıl boyunca kişisel bilgi içermeyecek şekilde saklanır.'],
      ['Süre', 'Talepler en geç 30 gün içinde sonuçlandırılır.'],
    ],
  },
  en: {
    privacyTitle: 'Privacy Policy',
    deletionTitle: 'Account and Data Deletion',
    updated: 'Last updated: 25 November 2026',
    back: 'Back to sign in',
    privacy: [
      ['Scope', 'GastroSync is a management panel for restaurant staff (web and Android). Accounts are created by the business administrator; the app does not accept public sign-ups.'],
      ['Data collected', 'Name, username, work e-mail and role; sign-in time, IP address and device information (for security and audit trail); business records (checks, stock, expenses, cash); the device push address for notifications. The camera is used on the device only to scan barcodes; images are not stored or sent.'],
      ['Purpose', 'Providing the service, role-based authorization, workflow notifications, security (failed sign-in lockout, session management) and legal retention duties. Data is never used for advertising or profiling and is never sold.'],
      ['Sharing', 'Data is kept only on the business’s own server. Phone notifications are delivered via Expo / Google Firebase Cloud Messaging; no data other than the notification content is shared.'],
      ['Security', 'Connections are encrypted with HTTPS; passwords are hashed with BCrypt; sessions use short-lived access tokens and rotating refresh tokens; every privileged action is written to the audit trail.'],
      ['Retention', 'Accounting and sales records are kept for 5 years as required by the Turkish Tax Procedure Law. When an account is deleted, personal details are removed or anonymised; business records that must be retained are kept without being linked to the person.'],
      ['Your rights (KVKK / GDPR)', 'You have the right to access, correct and request deletion of your data. Requests go to the business administrator or through the account deletion process below.'],
    ],
    deletion: [
      ['In the app', 'After signing in, use “Request deletion of my account” on the Password / Security screen. The request is sent to the business administrator as a notification.'],
      ['If you cannot sign in', 'Contact the administrator of the business you work for with your username; the administrator closes your account from the Staff screen.'],
      ['Deleted and retained data', 'Name, e-mail, session and device records are deleted. Because of legal obligations, accounting / sales records are retained for 5 years without personal details.'],
      ['Timeframe', 'Requests are completed within 30 days at the latest.'],
    ],
  },
  de: {
    privacyTitle: 'Datenschutzerklärung',
    deletionTitle: 'Konto- und Datenlöschung',
    updated: 'Zuletzt aktualisiert: 25. November 2026',
    back: 'Zurück zur Anmeldung',
    privacy: [
      ['Geltungsbereich', 'GastroSync ist ein Verwaltungspanel für Restaurantpersonal (Web und Android). Konten werden vom Administrator des Betriebs angelegt; eine öffentliche Registrierung gibt es nicht.'],
      ['Erhobene Daten', 'Name, Benutzername, dienstliche E-Mail und Rolle; Anmeldezeit, IP-Adresse und Geräteinformationen (für Sicherheit und Prüfprotokoll); Geschäftsdaten (Rechnungen, Bestand, Ausgaben, Kasse); die Push-Adresse des Geräts für Benachrichtigungen. Die Kamera wird nur auf dem Gerät zum Scannen von Barcodes genutzt; Bilder werden weder gespeichert noch übertragen.'],
      ['Zweck', 'Bereitstellung des Dienstes, rollenbasierte Berechtigungen, Workflow-Benachrichtigungen, Sicherheit (Sperre nach Fehlanmeldungen, Sitzungsverwaltung) und gesetzliche Aufbewahrungspflichten. Daten werden nicht für Werbung oder Profiling genutzt und nicht verkauft.'],
      ['Weitergabe', 'Die Daten liegen ausschließlich auf dem Server des Betriebs. Push-Benachrichtigungen werden über Expo / Google Firebase Cloud Messaging zugestellt; außer dem Benachrichtigungsinhalt werden keine Daten weitergegeben.'],
      ['Sicherheit', 'Verbindungen sind per HTTPS verschlüsselt; Passwörter werden mit BCrypt gehasht; Sitzungen nutzen kurzlebige Zugriffstoken und rotierende Refresh-Token; jede berechtigte Aktion wird protokolliert.'],
      ['Aufbewahrung', 'Buchhaltungs- und Verkaufsdaten werden nach türkischem Steuerverfahrensgesetz 5 Jahre aufbewahrt. Bei Kontolöschung werden personenbezogene Angaben entfernt oder anonymisiert.'],
      ['Ihre Rechte (KVKK / DSGVO)', 'Sie haben das Recht auf Auskunft, Berichtigung und Löschung Ihrer Daten. Anfragen richten Sie an den Administrator oder über das unten beschriebene Löschverfahren.'],
    ],
    deletion: [
      ['In der App', 'Nach der Anmeldung im Bildschirm Passwort / Sicherheit „Löschung meines Kontos beantragen“ wählen. Der Antrag geht als Benachrichtigung an den Administrator.'],
      ['Ohne Anmeldung', 'Wenden Sie sich mit Ihrem Benutzernamen an den Administrator Ihres Betriebs; er schließt Ihr Konto im Bildschirm Personal.'],
      ['Gelöschte und aufbewahrte Daten', 'Name, E-Mail, Sitzungs- und Gerätedaten werden gelöscht. Buchhaltungs- / Verkaufsdaten werden aus rechtlichen Gründen 5 Jahre ohne Personenbezug aufbewahrt.'],
      ['Frist', 'Anträge werden spätestens innerhalb von 30 Tagen bearbeitet.'],
    ],
  },
  ar: {
    privacyTitle: 'سياسة الخصوصية',
    deletionTitle: 'حذف الحساب والبيانات',
    updated: 'آخر تحديث: 25 نوفمبر 2026',
    back: 'العودة إلى تسجيل الدخول',
    privacy: [
      ['النطاق', 'GastroSync لوحة إدارة لموظفي المطاعم (ويب وأندرويد). ينشئ مدير المنشأة الحسابات، ولا يقبل التطبيق التسجيل العام.'],
      ['البيانات التي نجمعها', 'الاسم واسم المستخدم والبريد الإلكتروني للعمل والدور؛ وقت تسجيل الدخول وعنوان IP ومعلومات الجهاز (للأمان وسجل التدقيق)؛ سجلات العمل (الفواتير والمخزون والمصروفات والصندوق)؛ عنوان الإشعارات للجهاز. تُستخدم الكاميرا على الجهاز فقط لقراءة الباركود ولا تُحفظ الصور أو تُرسل.'],
      ['الغرض', 'تقديم الخدمة، والصلاحيات حسب الدور، وإشعارات سير العمل، والأمان (قفل محاولات الدخول الخاطئة وإدارة الجلسات) والالتزامات القانونية. لا تُستخدم البيانات للإعلانات أو التنميط ولا تُباع.'],
      ['المشاركة', 'تُحفظ البيانات على خادم المنشأة فقط. تُرسل إشعارات الهاتف عبر Expo / Google Firebase Cloud Messaging دون مشاركة أي بيانات غير محتوى الإشعار.'],
      ['الأمان', 'الاتصالات مشفرة عبر HTTPS؛ كلمات المرور مُجزأة بـ BCrypt؛ الجلسات برموز وصول قصيرة العمر ورموز تحديث متجددة؛ وكل عملية مصرح بها تُسجل في سجل التدقيق.'],
      ['الاحتفاظ', 'تُحفظ السجلات المحاسبية والمبيعات 5 سنوات وفق قانون الإجراءات الضريبية التركي. عند حذف الحساب تُزال البيانات الشخصية أو تُجهّل.'],
      ['حقوقك', 'يحق لك الاطلاع على بياناتك وتصحيحها وطلب حذفها عبر مدير المنشأة أو عبر إجراء حذف الحساب أدناه.'],
    ],
    deletion: [
      ['من داخل التطبيق', 'بعد تسجيل الدخول استخدم «طلب حذف حسابي» في شاشة كلمة المرور / الأمان. يُرسل الطلب إلى مدير المنشأة كإشعار.'],
      ['إذا تعذّر الدخول', 'تواصل مع مدير المنشأة التي تعمل بها مع ذكر اسم المستخدم؛ يغلق المدير حسابك من شاشة الموظفين.'],
      ['البيانات المحذوفة والمحتفظ بها', 'تُحذف بيانات الاسم والبريد والجلسات والأجهزة. وتُحفظ السجلات المحاسبية / المبيعات 5 سنوات دون بيانات شخصية بسبب الالتزامات القانونية.'],
      ['المدة', 'تُنجز الطلبات خلال 30 يومًا كحد أقصى.'],
    ],
  },
}

function LegalLayout({ title, sections, c, lang }) {
  return (
    <div dir={lang === 'ar' ? 'rtl' : 'ltr'} style={{ minHeight: '100vh', background: 'var(--color-bg)', padding: '24px 16px' }}>
      <div className="gs-card" style={{ maxWidth: 760, margin: '0 auto' }}>
        <div className="gs-card-header"><h1 className="gs-card-title" style={{ fontSize: '1.4rem' }}>GastroSync · {title}</h1></div>
        <div className="gs-card-body">
          <p className="gs-muted">{c.updated}</p>
          {sections.map(([h, body]) => (
            <section key={h} style={{ marginBottom: 16 }}>
              <h2 style={{ fontSize: '1.05rem', margin: '0 0 6px' }}>{h}</h2>
              <p style={{ margin: 0, lineHeight: 1.6 }}>{body}</p>
            </section>
          ))}
          <p style={{ marginTop: 24 }}>
            <Link to="/privacy">{c.privacyTitle}</Link> · <Link to="/account-deletion">{c.deletionTitle}</Link> · <Link to="/login">{c.back}</Link>
          </p>
        </div>
      </div>
    </div>
  )
}

const useContent = () => {
  const lang = useAuthStore((s) => s.currentLanguage) || 'tr'
  return { c: CONTENT[lang] || CONTENT.en, lang }
}

export function PrivacyPolicyPage() {
  const { c, lang } = useContent()
  return <LegalLayout title={c.privacyTitle} sections={c.privacy} c={c} lang={lang} />
}

export function AccountDeletionPage() {
  const { c, lang } = useContent()
  return <LegalLayout title={c.deletionTitle} sections={c.deletion} c={c} lang={lang} />
}
