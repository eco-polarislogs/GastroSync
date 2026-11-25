<p align="center">
  <img src="branding/gastrosync-logo.png" alt="GastroSync" width="560">
</p>

<h3 align="center">Mutfaktan kasaya, kasadan mali müşavire — restoranınızın tamamı tek ekranda, canlı.</h3>

<p align="center">
  <b>Web paneli</b> · <b>Android uygulaması</b> · 7 rol · 4 dil (TR / EN / DE / AR) · Gerçek zamanlı senkron · Rol bazlı telefon bildirimleri
</p>

---

# GastroSync — Restoran İşletim, Kasa-Muhasebe ve Maliyet Sistemi

GastroSync; stok, reçete maliyeti, POS satışı, gider/fatura onayı, kasa mutabakatı ve mali müşavir defter onayını **tek veritabanında, rol bazlı ve canlı senkronize** yöneten bir restoran yönetim sistemidir.

## Neden GastroSync?

| | |
| :--- | :--- |
| 💸 **Her tabağın gerçek maliyeti** | Reçete gramajı, ağırlıklı ortalama alış maliyeti ve fire tek yerde. Alış fiyatı değişince etkilenen yemekler, porsiyon başı zarar ve önerilen yeni fiyat anında yönetime düşer. |
| 🍽️ **Masa → mutfak → kasa tek akış** | Kasiyer siparişi girer, mutfak ekranına canlı düşer; tahsilatta stok reçeteden otomatik düşer, KDV sunucuda hesaplanır. |
| ✅ **Onay zinciri ve görevler ayrılığı** | İptal, ikram, indirim, sayım farkı ve harcamalar gerekçeli onaydan geçer. Hiçbir rol, birbirini denetleyen iki adımı birden yapamaz. |
| 📒 **Muhasebe ve mali müşavir aynı sistemde** | Gider → müdür onayı → ödeme → faturalandırma → müşavir defteri. Kesinleşen kayıt kilitlenir, dönem kapatılır, her adım denetim izine yazılır. |
| 🔔 **Doğru kişiye doğru bildirim** | Bildirimler role göre hem uygulama içi bildirim merkezine hem telefonun bildirim çubuğuna gelir; dokununca ilgili ekran açılır. |
| 🌍 **Çok dilli, sağdan sola destekli** | Arayüz tek dokunuşla TR / EN / DE / AR arasında değişir; kullanıcının yazdığı ürün, not ve gerekçeler olduğu gibi kalır. |
| 🔐 **Kurumsal güvenlik** | JWT + dönen yenileme token'ı, kaba kuvvet koruması, yetkisiz her denemenin kaydı ve yöneticiye anlık uyarı. |

## Ekranlar

### Web paneli

| Finansal özet (İşletme Müdürü) | Giriş ve demo hesapları |
| :---: | :---: |
| ![Finansal özet](docs/screenshots/web-dashboard.png) | ![Giriş](docs/screenshots/web-login.png) |
| **Masalar & Kasa (Kasiyer)** | **Muhasebe** |
| ![Masalar ve kasa](docs/screenshots/web-pos.png) | ![Muhasebe](docs/screenshots/web-accounting.png) |
| **Onaylar** | **Reçete merkezi** |
| ![Onaylar](docs/screenshots/web-approvals.png) | ![Reçeteler](docs/screenshots/web-recipes.png) |
| **Stok yönetimi** | **Satış analizi** |
| ![Stok](docs/screenshots/web-inventory.png) | ![Satışlar](docs/screenshots/web-sales.png) |
| **Mutfak ekranı (Şef)** | **Depo terminali** |
| ![Mutfak](docs/screenshots/web-kitchen.png) | ![Depo](docs/screenshots/web-warehouse.png) |
| **Personel ve roller (Yönetici)** | **Denetim izi** |
| ![Personel](docs/screenshots/web-users.png) | ![Denetim izi](docs/screenshots/web-audit.png) |
| **Müşavir defteri (SMMM)** | **Aynı panel İngilizce** |
| ![Müşavir defteri](docs/screenshots/web-advisor.png) | ![English](docs/screenshots/web-dashboard-en.png) |

### Android uygulaması

| Giriş | Özet | Onaylar | Masalar |
| :---: | :---: | :---: | :---: |
| <img src="docs/screenshots/mobile-login.png" width="200"> | <img src="docs/screenshots/mobile-home.png" width="200"> | <img src="docs/screenshots/mobile-approvals.png" width="200"> | <img src="docs/screenshots/mobile-tables.png" width="200"> |
| **Mutfak + menü** | **Özet (English)** | **Kritik stok (English)** | |
| <img src="docs/screenshots/mobile-more.png" width="200"> | <img src="docs/screenshots/mobile-home-en.png" width="200"> | <img src="docs/screenshots/mobile-stock-en.png" width="200"> | |

> Ekran görüntüleri demo veritabanından alınmıştır. Mobil görüntülerde sağ üstteki gri dişli düğmesi Expo geliştirme menüsüdür; mağaza sürümünde görünmez.

| Katman | Teknoloji |
| :--- | :--- |
| Web paneli | React 19 + Vite 6, TanStack Query, Zustand |
| Mobil | React Native / Expo (iOS ve Android tek kod tabanı) |
| Backend | Java 21, Spring Boot 3.3, Spring Security (JWT), STOMP WebSocket |
| Veritabanı | PostgreSQL 16 |
| Dağıtım | Docker Compose + Nginx (web, API ve WebSocket tek kapıdan) |

Ayrıntılı geliştirici dokümanı: [WIKI.md](WIKI.md) · Jüri / demo kılavuzu: [JURY_EVALUATION_PLAYBOOK.md](JURY_EVALUATION_PLAYBOOK.md)

---

## 1. Roller ve yetkiler

Yetkiler **tek bir tabloda, sunucuda** tanımlıdır (`backend/.../security/Permissions.java`). Her API ucu, servis katmanı ve WebSocket aboneliği bu tabloyu uygular; web ve mobil menüleri ile düğmeleri `GET /api/auth/me` yanıtındaki `screens` ve `permissions` listelerinden kurulur (istemci kendi yetki tablosu tutmaz). Rol değişikliği, hesabın pasife alınması veya şifre değişikliği **açık oturumlara anında** yansır.

**İlke:** her rol yalnızca kendi işini yapar. Roller arası etkileşim yalnızca *gönderme / onaylama / reddetme* adımlarıyla olur. Görevler ayrılığı (yetkilendirme, kayıt ve varlık muhafazası ayrı kişilerde) yetki matrisinin kendisiyle garanti edilir; hiçbir rol, birbirini denetleyen iki adıma birden sahip değildir (`FinancialStateMachineTest.permissionMatrixSegregation`).

| Rol | Görevi | Gördüğü ekranlar |
| :--- | :--- | :--- |
| **Yönetici** | Personel hesabı açar, rol atar, şifre sıfırlar; tüm raporları ve denetim izini **salt okunur** izler. Diğer rollerin işlemlerini yapmaz. | Genel Bakış, Personel, Denetim İzi, Satışlar, Muhasebe (izleme), Stok, Reçeteler, Menü & Maliyet |
| **İşletme Müdürü** | Harcama taleplerini onaylar / gerekçeyle reddeder; satış ve hazırlanmış adisyon iptalini onaylar; menü satış fiyatını ve masa düzenini belirler. | Genel Bakış, Onaylar, Masalar, Mutfak (izleme), Satışlar, Stok, Reçeteler, Menü & Maliyet |
| **Muhasebe** | Fatura, kira ve diğer giderleri kaydeder ve öder; günlük / aylık / yıllık kasa hesaplarını çıkarır; kasiyerin gün sonu sayımını mutabakatlar; belgeyi faturalandırıp Mali Müşavire gönderir; birim maliyet düzeltir. | Muhasebe, Satışlar, Stok, Menü & Maliyet |
| **Mali Müşavir (SMMM)** | Muhasebenin gönderdiği belgeyi deftere işler veya gerekçeyle reddeder; dönem kapatır / gerekçeyle açar. Kayıt, ödeme veya düzeltme yapmaz. | Müşavir Defteri, Denetim İzi |
| **Kasiyer** | Masaya adisyon açar, siparişi mutfağa iletir, tahsilat alır, gün sonu kasa sayımını yapar. | Masalar & Kasa |
| **Mutfak Şefi** | Reçete ve gramajı yönetir, mutfak ekranından siparişleri hazırlar, fire ve tedarik talebi girer. | Mutfak, Reçeteler, Stok, Menü & Maliyet (maliyet) |
| **Depo Sorumlusu** | Mal kabul, stok kartı, sayım ve fire; tedarik talebi. | Depo Terminali, Stok |

Roller arası akışlar:

| Gönderen | → Onaylayan / Reddeden | İş |
| :--- | :--- | :--- |
| Muhasebe (gider / fatura / kira kaydı) | İşletme Müdürü | Harcama onayı (yetkilendirme) |
| Şef / Depo (tedarik talebi) | İşletme Müdürü | Satın alma onayı |
| Muhasebe (ödenmiş, faturalandırılmış belge) | Mali Müşavir | Resmi deftere işleme |
| Kasiyer (gün sonu kasa sayımı) | Muhasebe | Kasa mutabakatı / yeniden sayım |
| Şef (yeni reçete, önerilen fiyat) | İşletme Müdürü | Fiyat onayı; onaylanana kadar kasada satışa açılmaz |
| Kasiyer (hazırlanmış kalem / adisyon iptali) | İşletme Müdürü | İptal onayı |

Yöneticinin kaydettiği kişi, verilen **kullanıcı adı veya e-posta** ve şifreyle hemen giriş yapar ve yalnızca kaydedildiği rolün ekranlarını görür. Personel ekranında rol seçilirken o rolün görev tanımı, ekranları ve izinleri gösterilir (`GET /api/auth/roles`). Kullanıcı adı arşivdeki personel dahil, e-posta aktif personel arasında benzersizdir.

---

## 2. İş akışları

**Tedarik → mal kabul → maliyet**
1. Şef veya depo kritik stok için *tedarik talebi* açar → İşletme Müdürünün onayına tahmini tutarlı bir hammadde alım kaydı düşer; muhasebe ve depo bilgilendirilir.
2. **Müdür** harcamayı onaylar; muhasebe fatura gelince belge numarasını tamamlar ve ödemeyi kaydeder (kısmi ödeme desteklenir).
3. Depo, *bekleyen teslimatlar* listesinden tek dokunuşla mal kabul yapar; alış fiyatı girilirse **ağırlıklı ortalama maliyet** yeniden hesaplanır. Alış fiyatı önceki alışa göre eşik değerden (varsayılan %8) fazla değişirse etkilenen reçeteler, porsiyon başı etki ve önerilen yeni fiyat yönetime, muhasebeye ve mutfağa anlık bildirilir.
4. Muhasebe ödediği gideri **faturalandırır** (belge no ve tedarikçi) ve **Mali Müşavire gönderir**.
5. Mali müşavir gönderilen belgeyi kontrol eder: **onaylar** (resmi deftere işlenir, kilitlenir) veya **gerekçeli reddeder** (muhasebeye döner).

**Menü & Maliyet (gelir-gider oranına göre fiyatlama)** — Her yemek son 30 günün satışlarına göre *Yıldız / İş Atı / Bulmaca / Zayıf* olarak sınıflanır (Kasavana-Smith menü mühendisliği). Önerilen fiyat; ortalama maliyet ile son alış fiyatından yüksek olanı üzerinden hedef food cost oranına göre hesaplanır. Dönemin faaliyet giderleri satılan porsiyonlara dağıtılarak porsiyon başı genel gider payı ve **başabaş fiyatı** bulunur; fiyatı başabaşın altında kalan yemek "zarar ediyor" olarak işaretlenir. İşletme Müdürü fiyatı simülasyonla gerekçeli günceller; kasalarda anında geçerli olur. Şefin açtığı yeni reçete, Müdür fiyatı onaylayana kadar kasada satışa açılmaz.

**Masa & adisyon (Kasiyer)** — Kasiyer masaya adisyon açar ve siparişi girer; kalemler mutfak ekranına canlı düşer, Şef *hazırlanıyor → hazır* olarak işaretler, kasiyer servis eder. Tahsilatta fiyat, KDV ve porsiyon maliyeti sunucuda reçeteden hesaplanır (istemcinin gönderdiği fiyat yok sayılır), hammadde reçeteden otomatik düşülür; stok yetersizse sipariş bütünüyle reddedilir. Henüz hazırlanmamış kalemi kasiyer, hazırlanmış kalemi / adisyonu yalnızca Müdür gerekçeyle iptal eder. Satış silinmez; Müdür gerekçeli iptal eder ve stok ters kayıtla iade edilir.

**Roller arası onay zinciri (yönetici onayı / "manager override")** — Personel yetkisini aşan işlemi doğrudan yapamaz; gerekçeli *onay talebi* açar, talep İşletme Müdürüne bildirim + canlı sinyal olarak düşer (web: Onaylar › İptal · İkram · İndirim · Sayım; mobil: Onaylar ekranı ve adisyon içi hızlı onay). Müdür onaylarsa işlem sunucuda talep sahibinin adına ve Müdürün imzasıyla uygulanır; reddederse gerekçe talep sahibine bildirilir. Talep sahibi talebini geri çekebilir; kimse kendi talebine karar veremez; hedef kayıt karar verilmeden kapanırsa talep *geçersiz* olur. Bekleyen talep varken adisyon tahsil edilemez.

| Talep | Açan | Karar veren | Onayda ne olur |
| :--- | :--- | :--- | :--- |
| Kalem / adisyon iptali (hazırlanmış) | Kasiyer | Müdür | Kalem / adisyon iptal edilir, denetim izine "talep eden + onaylayan" yazılır |
| İkram | Kasiyer | Müdür | Kalem ücretsiz olur; stok ve maliyet yine işlenir, raporlarda ikram değeri ayrıca görünür |
| İndirim (% veya ₺) | Kasiyer | Müdür | Tahsilatta ücretli satırlara oransal dağıtılır, KDV indirimli tutar üzerinden ayrılır |
| Eşiği aşan sayım farkı | Depo Sorumlusu | Müdür | Sayım anındaki fark uygulanır (onay beklerken yapılan satışlar korunur); ret halinde yeniden sayım istenir |

Sayım eşiği: fark %5 ve 250 ₺'yi birlikte ya da tek başına 1.000 ₺'yi aşarsa onaya gider (`GASTROSYNC_COUNT_APPROVAL_*`). Müdür ikram / indirimi doğrudan da uygulayabilir.

**Gider yaşam döngüsü**

```
PENDING_APPROVAL ─(Müdür harcama onayı)──────────────► APPROVED ─(muhasebe: faturalandır & gönder)─► MÜŞAVİR İNCELEMESİNDE
       │                                                  │                                              │
       │                                                  │                       (Mali Müşavir onayı)───┴──► FINALIZED [kilitli]
       └──────────────(gerekçeli ret)──────► REJECTED ◄───┴──────────────(Mali Müşavir gerekçeli ret)───┘
                                                └──(düzeltme)──► PENDING_APPROVAL
Ödeme (kasa/banka) onaydan bağımsız ayrı bir işlemdir: UNPAID → PARTIAL → PAID.
Tahakkuk esası gereği vadeli (ödenmemiş) fatura da müşavire gönderilebilir; ödeme durumu müşavire bildirilir.
```

**Gün sonu** — Z raporu gerçek satışlardan üretilir (ödeme türü, KDV oranı, iptaller). Kasiyer sayılan nakdi girer; beklenen nakit = devir + nakit satış − kasadan nakit ödemeler. Fark varsa açıklama zorunludur ve Müdüre bildirilir. Tutanak **Muhasebenin mutabakatına** düşer: Muhasebe Z özeti, POS slipleri ve yemek kartı raporlarıyla karşılaştırıp *mutabık* der veya gerekçeyle *yeniden sayım* ister. Sayımı giren kişi kendi sayımını onaylayamaz.

**Kasa raporu (Muhasebe)** — Günlük (seçili ay), aylık (seçili yıl) ve yıllık döküm: KDV dahil tahsilat, net satış, nakit / kart / yemek kartı kırılımı, ödenen giderler (kasa / banka / kart), net nakit akışı ve sayım farkları. Excel'e aktarılır.

**Dönem kapanışı** — Mali müşavir geçmiş bir ayı, tüm kayıtları kesinleşmiş veya reddedilmişse kapatabilir. Kapalı dönemde kayıt eklenemez, düzeltilemez, satış iptal edilemez. Yeniden açma gerekçe ister ve bildirilir.

---

## 3. Muhasebe ve meslek etiği kuralları

- **Görevler ayrılığı:** Gideri Muhasebe kaydeder, Müdür onaylar, Muhasebe öder, Mali Müşavir deftere işler; kaydeden kişi aynı gideri onaylayamaz.
- **Onay ≠ ödeme:** Harcama yetkisi ile kasa çıkışı ayrı kaydedilir; ödeme kalan borcu aşamaz.
- **Bağımsız denetim:** Muhasebe belgeyi tamamlayıp gönderir; resmi deftere işleme, gerekçeli ret ve dönem kapama **yalnızca** Mali Müşavirin kararıdır (Yönetici dahil başka hiçbir rol yapamaz). Müşavir incelemesindeki kaydı muhasebe veya müdür geri çekemez (yetkisiz işlem olarak raporlanır).
- **Dört göz:** Gideri kaydeden veya onaylayan kişi, aynı gideri resmi deftere işleyemez.
- **Belge düzeni (VUK):** Fatura/fiş numarası ve karşı taraf bilgisi olmayan gider deftere işlenemez; sistem belge numarası üretmez.
- **Değiştirilemezlik:** Kesinleşmiş kayıt değiştirilemez/silinemez. Onaylanmış kayıt önce gerekçeyle reddedilmelidir. Ödemesi yapılmış kayıt silinemez.
- **Gerekçe zorunluluğu:** Ret, satış iptali, sayım farkı, kasa farkı ve dönem açma gerekçesiz yapılamaz.
- **Denetim izi:** Giriş denemeleri, yetkisiz erişimler, rol/şifre değişiklikleri, tüm mali durum geçişleri, fiyat ve maliyet değişiklikleri değiştirilemez şekilde kaydedilir.
- **Raporlama:** Gelirler KDV hariç raporlanır; food cost % = SMM / net satış. Hammadde alımı stok (150) olarak izlenir, gider tüketildikçe SMM (620) olur. Vergi ödemeleri faaliyet gideri sayılmaz. Yevmiye fiş dökümü ve KDV özeti **taslaktır**; nihai sınıflandırma mali müşavirin takdirindedir.

---

## 4. Güvenlik

- JWT (HS256) her istekte doğrulanır; kullanıcı, rol ve aktiflik bilgisi **veritabanından** okunur. Şifre değişince eski oturumlar düşer.
- **Oturum modeli (OWASP):** erişim token'ı kısa ömürlüdür (15 dk); oturum, veritabanında yalnızca SHA-256 özeti tutulan **dönen yenileme token'ı** ile sürer (`POST /api/auth/refresh`). Kullanılmış yenileme token'ı tekrar gelirse (çalıntı şüphesi) o cihaz oturumunun tamamı iptal edilir. Mutlak oturum süresi 30 gündür. Web ve mobil istemci token'ı bitmeden arka planda yeniler; 401'de tek yenileme ile isteği tekrarlar. `POST /api/auth/logout` bu cihazı, `POST /api/auth/logout-all` tüm cihazları kapatır; Yönetici personelin oturumlarını sonlandırabilir (kayıp telefon, işten ayrılma). Rol / şifre değişikliği ve pasife alma tüm yenileme token'larını ve cihaz push kayıtlarını iptal eder.
- Yöneticinin eklediği personel, girilen **kullanıcı adı veya e-posta** ve şifreyle hemen kendi rolünün ekranına girer. İsteğe bağlı "ilk girişte şifre değiştirsin" seçeneği vardır; yöneticinin **sıfırladığı** şifre ise her zaman ilk girişte değiştirilir. Şifre politikası: en az 8 karakter, harf + rakam.
- Rol değişikliği anında geçerlidir: sunucu kullanıcının canlı WebSocket oturumlarını kapatır, web ve mobil yeniden bağlanırken yeni rolü `/api/auth/me` üzerinden alır ve kullanıcıyı yeni rolünün ekranına taşır. Pasifleştirilen hesap bir sonraki istekte oturumdan düşer.
- Kaba kuvvet koruması: 5 hatalı denemede **yalnızca o kullanıcı adı** 5 dakika kilitlenir (429). Restoranda herkes aynı ağ çıkışını (IP) paylaştığı için IP bazlı toplu kilit uygulanmaz.
- Yetki üç katmanda uygulanır: controller (`@PreAuthorize("@perm.can('…')")`), servis katmanı (kritik mali geçişler controller atlansa da reddedilir) ve WebSocket abonelikleri.
- Yetkisiz her işlem (API reddi, yetkisiz ekran / WebSocket aboneliği) denetim kaydına yazılır ve Yöneticiye anlık güvenlik bildirimi olarak gider.
- WebSocket: token'sız bağlantı reddedilir; her abonelik rol politikasına göre denetlenir (varsayılan kapalı). Sohbet gönderen kimliği sunucuda belirlenir.
- Bildirim okundu bilgisi kullanıcıya özeldir; başka rolün bildirimine erişim engellidir.
- Hata yanıtları iç ayrıntı sızdırmaz; beklenmeyen hatalarda takip kodu verilir.
- Sırlar koda yazılmaz (ortam değişkeni). Swagger canlıda kapalıdır. CORS izinli kaynakları yapılandırılır.

---

## 5. Kurulum

### Geliştirme (Windows)
1. PostgreSQL'de `gastrosync` veritabanını oluşturun.
2. Kök dizine `.env` oluşturun (`.env.example` şablonu). Backend bu dosyayı otomatik okur.
3. `start-all.bat` → backend `:8080`, web `:3000`, Expo `:8081`.

`GASTROSYNC_SEED_DEMO_DATA=true` (geliştirmede varsayılan) iken demo modu açıktır: boş veritabanına demo verisi yüklenir ve eksik demo hesapları (`admin`, `manager`, `accountant`, `advisor`, `cashier`, `chef`, `warehouse` — şifre `123456`) tamamlanır; mevcut hesapların şifresine dokunulmaz. Giriş ekranındaki hızlı giriş düğmelerini sunucu belirler (`GET /api/auth/demo-accounts`): yalnızca şifresi gerçekten tutan aktif demo hesaplar listelenir. Canlıda bu değişken `false` olmalıdır; o zaman liste boş döner ve düğmeler görünmez.

### Canlı ortam (Docker)
```bash
cp .env.example .env     # şifreleri, JWT anahtarını, alan adını doldurun
docker compose up -d --build
node scripts/smoke-test.mjs https://panel.restoraniniz.com   # salt okunur duman testi
```
- İlk açılışta veritabanı boşsa `admin` hesabı `GASTROSYNC_ADMIN_PASSWORD` ile oluşturulur; ilk girişte şifre değiştirilir.
- TLS'i önüne koyacağınız reverse proxy (Caddy, Traefik, certbot'lu Nginx) sağlamalıdır. `CORS_ALLOWED_ORIGINS` değerine panel adresini yazın.
- **Yedekleme:** `db-backup` servisi her gün `pg_dump` alır (`./backups`, varsayılan 14 gün saklama). Yedekleri sunucu dışına da kopyalayın.
- **HTTPS:** `DOMAIN=panel.restoraniniz.com HTTP_PORT=8088 docker compose --profile tls up -d` ile Caddy otomatik Let's Encrypt sertifikası alır, HSTS ekler (`Caddyfile`).
- **Yasal sayfalar:** `/privacy` (Gizlilik Politikası) ve `/account-deletion` (hesap ve veri silme) giriş gerektirmez; Google Play mağaza kaydında bu adresleri kullanın. Uygulama içinde *Şifre / Güvenlik* ekranından hesap silme talebi Yöneticiye gider; arşivlenen hesabın kişisel bilgileri kaldırılır, yasal saklama gerektiren muhasebe kayıtları kişiyle ilişkilendirilmeden tutulur.
- **Adisyon belgesi:** Uygulamanın tahsilat ekranı bilgi fişidir; müşteriye ödeme belgesi olarak ÖKC fişi veya e-Arşiv fatura düzenlenir (e-Adisyon zorunluluğu GİB bildirimine bağlıdır).

### Mobil derleme ve Google Play
Mağaza / canlı derlemede `EXPO_PUBLIC_API_URL=https://panel.restoraniniz.com/api` tanımlayın (`mobile/eas.json` profillerindeki örnek adresi değiştirin). Demo hızlı giriş düğmeleri web ile aynı şekilde sunucudan gelir; canlıda (`GASTROSYNC_SEED_DEMO_DATA=false`) görünmez.

1. `cd mobile && npx eas-cli@latest login` ve `npx eas-cli@latest init` (EAS proje kimliği `app.json` → `extra.eas.projectId` alanına yazılır; uzak push bu kimliği kullanır).
2. Telefon bildirimleri (uygulama kapalıyken): Firebase projesi açın, FCM V1 hizmet hesabı anahtarını `npx eas-cli@latest credentials` ile Expo'ya yükleyin. Sunucu bildirimleri Expo Push Service üzerinden gönderir (`gastrosync.push.*`); Expo "Enhanced push security" açılırsa `GASTROSYNC_EXPO_ACCESS_TOKEN` tanımlayın.
3. İç test APK: `npx eas-cli@latest build -p android --profile preview` · Mağaza paketi (AAB, Android 16 / API 36 hedefi Expo SDK 58 ile gelir): `npx eas-cli@latest build -p android --profile production` · Gönderim: `npx eas-cli@latest submit -p android --profile production` (önce iç test kanalı).
4. Play Console: uygulama erişimi için test hesabı verin (demo kapalıyken Yöneticinin açtığı bir hesap), Veri Güvenliği formunda kamera (yalnızca cihazda barkod), hesap bilgileri ve cihaz kimliği (push) beyan edin; gizlilik ve hesap silme bağlantısı olarak `/privacy` ve `/account-deletion` adreslerini girin.

**Canlıya çıkmadan telefonda kullanma (demo APK):** Uygulama `GASTROSYNC_LOCAL_DEMO=1` ile derlenip telefona kurulabilir; bilgisayardaki backend'e aynı Wi-Fi üzerinden bağlanır. Giriş ekranının altındaki **Sunucu** kutusundan adres değiştirilebilir (`192.168.1.36`, `192.168.1.36:8080` veya `https://panel.restoraniniz.com`); "Kaydet ve Dene" bağlantıyı test eder, adres cihazda saklanır. Kendi sunucusunu barındıran restoranlar da aynı ayarı kullanır.

Windows'ta yerel (`gradlew assembleRelease`) derleme, React Native'in uzun C++ yolları nedeniyle 260 karakter sınırına takılabilir; EAS bulut derlemesi önerilir, yerel derleme için [WIKI › Sorun giderme](WIKI.md#8-sorun-giderme).

**Telefon bildirimleri** — Bildirim merkezine düşen her bildirim, hedef roldeki aktif kullanıcıların kayıtlı cihazlarına da gider (hedef kullanıcılar her gönderimde güncel role göre belirlenir). Expo Go'da (SDK 53+) uzak push yoktur; uygulama açıkken / arka plandayken gelen rol bildirimleri yerel bildirim olarak telefonun bildirim çubuğunda gösterilir. Bildirime dokununca ilgili ekran açılır.

**Dil desteği (TR / EN / DE / AR)** — Arayüzdeki tüm sabit metinler ortak sözlükten (`i18n/phrases.json`) seçili dile çevrilir; Arapçada düzen sağdan sola döner. Kullanıcının yazdıkları (ürün, bölüm, not, gerekçe, isim) değişmez. Yeni metin eklendiğinde `npm run i18n:missing` eksikleri `i18n/missing.json`'a yazar, çeviriler `i18n/parts/*.json`'a eklenip `npm run i18n:merge` ile web ve mobile dağıtılır; `npm run i18n:check` eksik varsa hata verir (CI).

---

## 6. Testler

| Komut | Kapsam |
| :--- | :--- |
| `cd backend && mvn test` | 67 entegrasyon testi (onay zinciri, oturum yenileme / tekrar kullanım tespiti / tüm cihazlardan çıkış ve rol bazlı telefon bildirimi dahil), izole H2 veritabanında (gerçek veriye dokunmaz): yetki matrisi (hiçbir rolün birbirini denetleyen iki adıma sahip olmaması), hiçbir rolün başka rolün işini yapamaması, yöneticinin kaydettiği personelin verilen rol ve bilgilerle girişi, kasiyer → muhasebe kasa mutabakatı, şef → müdür fiyat onayı, masa/mutfak ayrımı, oturum güvenliği, belge düzeni, dönem kilidi, ağırlıklı ortalama maliyet, atomik satış, iptal ters kaydı, eşzamanlılık, yevmiye dengesi, sayfalı ve sıralı listeler, sohbet okunma senkronu |
| `npm run smoke -- <adres>` | Çalışan sisteme karşı salt okunur duman testi (sağlık, giriş, yetki matrisi, WebSocket yetkileri, yevmiye dengesi) |
| `npm run smoke -- <adres> --write` | Demo/test ortamında uçtan uca iş akışı (canlıda kullanmayın) |
| `npm run seed:advisor -- [adres]` | Demo ortamında Mali Müşavir incelemesine 10 belge gönderir (muhasebe kaydı → müdür onayı → ödeme → müşavire gönderim, gerçek API akışıyla). 3'ü bilerek sorunludur, ret pratiği içindir. Aynı ay tekrar çalıştırılırsa mevcut belgeleri atlar |

---

## 7. Bilinen sınırlar

- Şema `ddl-auto=update` ile yönetilir; çok şubeli / yüksek hacimli kullanımda Flyway migrasyonlarına geçilmesi önerilir.
- Giriş denemesi sayacı ve WebSocket aracısı bellek içidir; birden fazla backend örneği çalıştırılacaksa Redis ve harici STOMP aracısı gerekir.
- e-Fatura / e-Arşiv, ÖKC (yazar kasa) ve banka entegrasyonları yoktur; Z özeti yazar kasanın resmi Z raporuyla karşılaştırılmalıdır.

---

MIT Lisansı · GastroSync © 2026 · Geliştirici: Ecren Solmazgül
