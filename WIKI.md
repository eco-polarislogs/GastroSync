# GastroSync — Geliştirici Wiki

Genel bakış, roller ve kurulum için [README.md](README.md). Bu sayfa geliştirici referansıdır.

## İçindekiler
1. [Mimari](#1-mimari)
2. [Proje yapısı](#2-proje-yapısı)
3. [API uç noktaları](#3-api-uç-noktaları)
4. [Gerçek zamanlı senkronizasyon (STOMP)](#4-gerçek-zamanlı-senkronizasyon-stomp)
5. [Veri modeli ve muhasebe eşlemesi](#5-veri-modeli-ve-muhasebe-eşlemesi)
6. [Yapılandırma](#6-yapılandırma)
7. [Pazar karşılaştırması](#7-pazar-karşılaştırması-ve-eşleştirme)
8. [Sorun giderme](#8-sorun-giderme)
9. [Ekran haritası](#9-ekran-haritası)
10. [Canlıya çıkış: pazar ve mevzuat eksik analizi](#10-canlıya-çıkış-pazar-ve-mevzuat-eksik-analizi)

---

## 1. Mimari

```
Web (React)  ─┐                         ┌─ /api/*  → Spring Boot (REST, JWT)
Mobil (Expo) ─┼─ Nginx :80 (+ TLS proxy)┼─ /ws     → STOMP WebSocket (JWT CONNECT)
              │                         └─ /       → derlenmiş web arayüzü
              └──────────────────────────────────── PostgreSQL 16 (yalnızca backend erişir)
```

- **Tek veri kaynağı sunucudur.** İstemciler sahte/örnek veri kullanmaz; bağlantı yoksa hata gösterir.
- İş akışı bildirimleri (onay bekleyen gider, ret, kritik stok, kasa farkı, güvenlik alarmı…) **sunucuda** üretilir ve işlem (commit) başarılı olduktan sonra yayınlanır.
- Stok miktarı yalnızca değiştirilemez stok hareketleriyle değişir (`stock_transactions`).

## 2. Proje yapısı

```
backend/src/main/java/com/gastrosync
  security/   Permissions (rol → izin → ekran: TEK yetki tablosu), PermissionGuard (@perm.can),
              AppRoles (kanal ve WebSocket politikası), JWT, TokenAuthenticationService, LoginAttemptService
  service/    ExpenseService (durum makinesi), InventoryService, SalesService, RecipeService,
              ReportService (K/Z, KDV, yevmiye, Z raporu), AccountingPeriodService, AuditService,
              NotificationService, SecurityAlertService, ChatService
  config/     WebSocketConfig, DataSeeder (demo / ilk yönetici), DatabaseSchemaInitializer (eski veri uyumu)
src/                        Web arayüzü
  api/index.js              Tüm REST uçları (bileşenler URL üretmez)
  pages/accounting/         Muhasebe modülü (tablo, formlar, rapor panelleri, permissions.js)
  utils/routes.js           Ekran kimliği ↔ adres eşlemesi (hangi ekranın açılacağını sunucu belirler)
  pages/PosPage.jsx         Masalar & Kasa (Kasiyer), masa düzeni ve iptal onayı (Müdür)
  pages/KitchenPage.jsx     Mutfak ekranı (Şef)
mobile/src
  shared/GastroSyncWorkspace.js   iOS + Android ortak uygulama (ekranlar ve düğmeler sunucu izinlerinden)
  screens/                        Masalar & Kasa, Mutfak, Kasa mutabakatı / kasa raporu
  services/api.js                 Mobil API katmanı (sunucu sonucu doğrulanır)
scripts/smoke-test.mjs      Canlı ortam duman testi
```

## 3. API uç noktaları

Tüm yanıtlar `{ success, message, data, timestamp }` biçimindedir. Hata kodları: 400 doğrulama, 401 oturum yok/geçersiz, 403 yetkisiz (denetim izine yazılır), 404 bulunamadı, 409 iş kuralı ihlali, 429 geçici kilit.

| Alan | Uç noktalar |
| :--- | :--- |
| Kimlik | `POST /api/auth/login` (kullanıcı adı veya e-posta), `GET /api/auth/me` (yanıtta `screens`, `permissions`, `roleLabel`), `POST /api/auth/change-password`, `GET /api/auth/demo-accounts` (herkese açık; demo modu kapalıyken boş liste), `GET /api/auth/roles` (rol kataloğu: görev tanımı, ekranlar, izinler — Yönetici) |
| Kullanıcı | `GET/POST /api/users` (`requirePasswordChange?` varsayılan `false`), `GET /api/users/search?q&role&status&sort&page&size`, `PUT /api/users/{id}` (`name`, `email`), `PUT /api/users/{id}/role`, `PUT /api/users/{id}/status`, `POST /api/users/{id}/reset-password`, `DELETE /api/users/{id}` |
| Masa & adisyon | `GET/POST /api/pos/tables`, `PUT /api/pos/tables/{id}` (Müdür), `GET /api/pos/menu` (fiyatı onaylı reçeteler), `POST /api/pos/tables/{id}/open`, `GET /api/pos/checks/{id}`, `POST /api/pos/checks/{id}/items`, `PUT /api/pos/items/{id}/status` (`PREPARING`/`READY` Şef, `SERVED` Kasiyer), `PUT /api/pos/items/{id}/cancel`, `PUT /api/pos/checks/{id}/transfer`, `POST /api/pos/checks/{id}/pay`, `PUT /api/pos/checks/{id}/cancel`, `GET /api/pos/kitchen`, `GET /api/pos/summary`, `GET /api/pos/checks?date&status&page&size` |
| Stok | `GET/POST /api/inventory`, `PUT/DELETE /api/inventory/{id}`, `POST /{id}/receive` (`quantity`, `unitCost?`, `documentNo?`, `expenseId?`), `POST /{id}/waste`, `POST /{id}/adjust` (`countedQuantity`, `reason`), `POST /{id}/purchase-request`, `GET /pending-deliveries`, `GET /valuation`, `GET /transactions/recent`, `GET /transactions?type&itemId&q&page&size` (sayfalı), `GET /{id}/transactions` |
| Reçete | `GET/POST /api/recipes`, `PUT/DELETE /api/recipes/{id}` — yanıtta `portionCost`, `foodCostPercent`, `costComplete`; `PUT /{id}/price` (`salePrice`, `reason`; Yönetici/Müdür, gerekçeli ve bildirimli) |
| Menü & Maliyet | `GET /api/analytics/menu-pricing?days=7..180` — menü sınıfı (`STAR`, `PLOWHORSE`, `PUZZLE`, `DOG`, `NO_DATA`), `suggestedPrice`, `breakEvenPrice` (yalnızca mali roller), `priceAction` (`LOSS`, `RAISE`, `WATCH`, `OK`), malzeme fiyat geçmişi (`lastPurchaseCost`, `changePercent`, `periodChangePercent`, `daysOfCover`) ve `alerts` |
| Satış | `POST /api/sales/order` (`tableNo`, `paymentMethod`, `items[{recipeId, quantity}]`), `POST /api/sales` (tek kalem), `GET /api/sales?from&to&includeVoided`, `GET /search?from&to&includeVoided&q&method&page&size` (sayfalı), `GET /range-summary?from&to`, `GET /today`, `GET /summary`, `POST /{id}/void` |
| Gider | `GET/POST /api/expenses`, `GET /search?period&tab&q&page&size` (sayfalı; `tab`: `pending`, `payable`, `submit` (müşavire gönderilecek), `rejected`, `ledger` (müşavir incelemesinde), `finalized`, `all`; `meta.counts` sekme sayılarını verir), `PUT /{id}`, `PUT /{id}/approve`, `POST /{id}/pay`, `PUT /{id}/submit` (`invoiceNumber?`, `counterparty?`, `note?` — muhasebe faturalandırıp müşavire gönderir), `PUT /{id}/finalize` (`note?` — Mali Müşavir veya Yönetici), `PUT /{id}/reject`, `DELETE /{id}`, `GET /{id}/history`, `GET /summary`, `GET /types` |
| Rapor | `GET /api/reports/summary?period=YYYY-MM`, `/vat`, `/journal`, `/z-report?date=`, `GET/POST /api/reports/cash-closings` (POST: Kasiyer), `PUT /api/reports/cash-closings/{id}/review` (`decision`: `APPROVE`/`REJECT`, `note` — Muhasebe), `GET /api/reports/cash-report?granularity=day\|month\|year&period=` |
| Dönem | `GET /api/accounting/periods`, `POST /api/accounting/periods/{YYYY-MM}/close`, `/reopen` |
| Denetim | `GET /api/audit-logs?entityType&q&page&size` (sayfalı) |
| Bildirim | `GET /api/notifications`, `PUT /{id}/read`, `PUT /mark-all-read`, `POST /security-alert`, `POST /` (yalnızca yönetim duyurusu) |
| Sohbet | `GET /api/chat/channels`, `GET/POST /api/chat/messages`, `GET /api/chat/unread` (kanal bazlı okunmamış), `PUT /api/chat/channels/{kanal}/read` |
| Sağlık | `GET /actuator/health` |

**Sayfalı yanıt biçimi** — `{ content, page, size, totalElements, totalPages, meta }`. `page` 0'dan başlar, `size` 5–100 arasına sabitlenir (varsayılan 20). **Sıralama:** `sort=alan,asc|desc` (giderler, satışlar, denetim izi, stok hareketleri, personel); yalnızca izinli alanlar kabul edilir, bilinmeyen alan varsayılan sıraya döner. Web tablolarında sütun başlığına tıklayarak, mobilde liste üstündeki sıralama çiplerinden seçilir. Web'de muhasebe, satış geçmişi, denetim kaydı ve stok hareketleri sunucu tarafında; stok, reçete ve personel listeleri istemci tarafında sayfalanır. Mobilde uzun listeler 15'er kayıtla gösterilir ve "Daha fazla göster" ile genişler.

Swagger (yalnızca geliştirme): `http://localhost:8080/swagger-ui/index.html`

## 4. Gerçek zamanlı senkronizasyon (STOMP)

Bağlantı: `ws(s)://<alan>/ws`, CONNECT çerçevesinde `Authorization: Bearer <JWT>` zorunlu. Mesaj gönderimi REST ile yapılır.

| Konu | Kim abone olabilir | İçerik |
| :--- | :--- | :--- |
| `/topic/notifications` | Herkes | `ALL` hedefli bildirimler |
| `/topic/notifications/{ROL}` | Yalnızca o rol | Role özel bildirimler |
| `/topic/notifications/supervisors` | ADMIN | Tüm rol bildirimlerinin kopyası (salt okunur gözetim) |
| `/topic/tables`, `/topic/kitchen` | MANAGER, CASHIER, CHEF | Masa / adisyon ve mutfak sırası değişiklikleri |
| `/user/queue/notifications` | Kullanıcının kendisi | Cihazlar arası bildirim okundu senkronizasyonu |
| `/user/queue/chat-read` | Kullanıcının kendisi | Bir cihazda okunan sohbet kanalı diğerlerinde de okunmuş görünür |
| `/topic/inventory` | Herkes | Stok değişikliği sinyali |
| `/topic/finance` | ADMIN, MANAGER, ACCOUNTANT, FINANCIAL_ADVISOR | Gider / satış değişikliği sinyali |
| `/topic/chat/{kanal}` | Kanal yetkisine göre | Sohbet mesajları |

**Rol değişikliği senkronu** — Yönetici rol değiştirdiğinde, hesabı pasifleştirdiğinde veya şifre sıfırladığında sunucu o kullanıcının açık WebSocket oturumlarını kapatır (`WebSocketSessionRegistry`). İstemci yeniden bağlanınca `GET /api/auth/me` ile yeni rolü alır, abonelikleri yeni role göre kurar ve kullanıcıyı rolünün varsayılan ekranına taşır. Web ayrıca pencere odağında ve 2 dakikada bir, mobil 90 saniyede bir oturumu doğrular.

Sohbet kanalları: `general` (herkes), `shift` (Mali Müşavir hariç), `kitchen` (yönetim, şef, depo), `warehouse` (yönetim, şef, depo, muhasebe), `cashier` ve `management` (yönetim, muhasebe, mali müşavir). Tanımsız tüm konular reddedilir. Web ve mobil kanal seçici yalnızca rolün yetkili olduğu kanalları gösterir.

## 5. Veri modeli ve muhasebe eşlemesi

- **Gider (`expenses`)**: `amount` KDV dahil brüt tutardır; `vatAmount`, `netAmount`, `remainingAmount` türetilir. Ödemeler `expense_payments` tablosundadır. Hammadde alımında `inventoryItemId`, `purchaseQuantity`, `deliveredQuantity` tutulur.
- **Satış (`sales_records`)**: fiyat, KDV ve porsiyon maliyeti satış anında dondurulur. İptal `status=VOIDED` + `SALE_REVERSAL` stok hareketiyle yapılır.
- **Stok hareketi tipleri**: `INBOUND`, `OUTBOUND_SALE`, `SALE_REVERSAL`, `WASTE`, `ADJUSTMENT` (işaretli miktar). Her harekette işlem sonrası bakiye saklanır.
- **Maliyet yöntemi**: ağırlıklı ortalama (alış fiyatı girilen mal kabulde yeniden hesaplanır).

Taslak yevmiye fişlerinde kullanılan TDHP hesapları (nihai eşleme mali müşavirin takdirindedir):

| Olay | Borç | Alacak |
| :--- | :--- | :--- |
| Günlük satış | 100 Kasa / 108 POS / 120 Yemek kartı şirketleri | 600 Yurtiçi Satışlar, 391 Hesaplanan KDV |
| Satılan mamul maliyeti | 620 | 150 İlk Madde ve Malzeme |
| Fire / sayım eksiği | 689 | 150 |
| Sayım fazlası | 150 | 679 |
| Gider faturası (kesinleşmiş) | 770 / 760 / 150 / 360 + 191 İndirilecek KDV | 320 Satıcılar |
| Ödeme | 320 | 100 Kasa / 102 Bankalar / 309 Şirket kredi kartı |

## 6. Yapılandırma

| Değişken | Açıklama |
| :--- | :--- |
| `SPRING_DATASOURCE_URL`, `SPRING_DATASOURCE_USERNAME`, `SPRING_DATASOURCE_PASSWORD` | Veritabanı (geliştirmede `DB_USERNAME` / `DB_PASSWORD` da okunur) |
| `GASTROSYNC_JWT_SECRET` | ≥ 32 bayt; `prod` profilinde yoksa uygulama başlamaz |
| `GASTROSYNC_JWT_EXPIRATION` | ms, varsayılan 12 saat |
| `GASTROSYNC_ADMIN_PASSWORD` | Boş veritabanında ilk `admin` hesabının geçici şifresi |
| `GASTROSYNC_SEED_DEMO_DATA` | Demo verisi (canlıda `false`) |
| `CORS_ALLOWED_ORIGINS` | Web panel adres(ler)i, virgülle ayrılmış |
| `GASTROSYNC_ENFORCE_SEGREGATION` | Görevler ayrılığı ve dört göz kuralı (varsayılan `true`) |
| `gastrosync.pricing.alert-threshold-percent` | Alış fiyatı değişim uyarı eşiği, % (varsayılan 8) |
| `gastrosync.analytics.target-food-cost-percent` | Hedef food cost, % (varsayılan 30) — önerilen fiyat bu orana göre hesaplanır |
| `GASTROSYNC_SALES_VAT_RATE` | Reçetede oran yoksa satış KDV'si (varsayılan 10) |
| `SWAGGER_ENABLED` | Swagger UI (canlıda `false`) |
| `VITE_API_URL` / `EXPO_PUBLIC_API_URL` | Web / mobil API adresi (web varsayılanı göreli `/api`) |

Profil: `SPRING_PROFILES_ACTIVE=prod` (Docker imajında varsayılan). Testler `test` profilinde, bellek içi H2 ile çalışır.

## 7. Pazar karşılaştırması ve eşleştirme

Piyasadaki restoran yönetim / maliyet yazılımlarında öne çıkan özellikler ve GastroSync'teki karşılıkları:

| Piyasadaki özellik | GastroSync karşılığı |
| :--- | :--- |
| Tedarikçi fiyat artışında etkilenen yemekleri ve tabak başı etkiyi bildiren uyarı | Mal kabulde alış fiyatı eşik üstü değişirse etkilenen reçeteler, porsiyon başı etki, yeni food cost ve önerilen fiyat anlık bildirilir (`PRICE_CHANGE`) |
| Fiyat geçmişi / dalgalanma takibi | Malzeme bazında son / önceki alış, dönem başı fiyat, min–max, değişim % (Menü & Maliyet → Malzeme Fiyat Dalgalanması) |
| Menü mühendisliği (kârlılık × popülerlik) | Kasavana-Smith sınıflaması: Yıldız / İş Atı / Bulmaca / Zayıf ve her biri için öneri |
| Maliyet / fiyat değişikliğini uygulamadan önce simüle etme | Fiyat simülasyonu: yeni fiyatla food cost, katkı payı ve fark; Yönetici/Müdür gerekçeli uygular |
| Gerçek zamanlı stok düşümü ve düşük stok uyarısı | POS satışında reçeteden otomatik düşüm, kritik stok bildirimi, günlük tüketime göre "kaç günlük stok" |
| Hedef dışı performans uyarısı | Food cost hedefin üzerindeki veya başabaşın altındaki yemekler için uyarı |
| Ekip içi mesajlaşma ve okundu durumu | Rol bazlı kanallar, acil mesaj bildirimi, web ve mobilde senkron okunmamış sayaçları |

## 8. Sorun giderme

**Mobil uygulama sunucuya bağlanamıyor** — Telefon ve bilgisayar aynı ağda olmalı; geliştirmede Expo'nun LAN IP'si kullanılır, backend `:8080`'de açık olmalı. Canlı derlemede `EXPO_PUBLIC_API_URL` doğru olmalı.

**Canlı bildirim gelmiyor** — Üst çubuktaki nokta turuncuysa WebSocket bağlı değildir; veriler 60 sn'de bir yenilenir. Nginx'te `/ws` yönlendirmesini ve `Upgrade` başlıklarını kontrol edin.

**Demo hesaplarıyla girilemiyor** — `GASTROSYNC_SEED_DEMO_DATA=true` olmalı ve backend yeniden başlatılmalıdır; eksik demo hesapları açılışta oluşturulur. Bir demo hesabın şifresi değiştirildiyse o hesap hızlı giriş listesinde görünmez (yönetici şifreyi sıfırlayabilir). Çok sayıda hatalı denemeden sonra o kullanıcı adı 5 dakika kilitlenir.

**Editörde kırmızı Java hataları (derleme ise başarılı)** — VS Code Java dil sunucusunun önbelleği eskidir. Komut paletinden *Java: Clean Java Language Server Workspace* çalıştırın. `.vscode/settings.json` yalnızca `backend` Maven projesini içe aktaracak şekilde ayarlıdır.

**"Görevler ayrılığı" hatası** — Kaydettiğiniz gideri başka bir yetkili (müdür / muhasebe) onaylamalıdır.

**"Belge düzeni" hatası** — Gideri reddedip fatura/fiş numarası ve karşı tarafı ekleyerek tekrar onaya sunun.

**"Dönem kapatılmıştır" hatası** — Mali müşavir dönemi gerekçeli olarak yeniden açmalıdır.

**Windows'ta yerel release APK derlemesi "Filename longer than 260 characters" / ninja `mkdir` hatasıyla duruyor** — React Native'in C++ derleme yolları Windows'un 260 karakter sınırını aşar. Önerilen yol EAS bulut derlemesidir (`npx eas-cli@latest build -p android --profile preview`); Linux'ta çalıştığı için bu sınır yoktur. Yönetici izni gerektirmeyen yerel çözüm (denendi, çalışıyor): (1) `mobile` klasörünü `C:\gs` gibi kısa bir yola kopyalayın (OneDrive'dan gelen salt okunur özniteliği `attrib -R C:\gs\* /S /D` ile kaldırın); (2) C++ codegen içeren iki paketi kısa klasöre taşıyıp yerlerine junction bırakın: `node_modules\react-native-safe-area-context` → `C:\s\sac`, `node_modules\@react-native-async-storage\async-storage` → `C:\s\as` (`mklink /J`); (3) `android/app/build.gradle` içinde `android { externalNativeBuild { cmake { buildStagingDirectory = file('C:/x') } } }`; (4) `GASTROSYNC_LOCAL_DEMO=1 EXPO_PUBLIC_API_URL=http://<bilgisayar-IP>:8080/api ./gradlew assembleRelease`. Not: `subst` ile sürücü harfine bağlamak Expo autolinking'i bozar.

**Port 8080 dolu** — `Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process -Force`

**Eski sürümden yükseltme** — `DatabaseSchemaInitializer` eski gider durumlarını (`APPROVED_IN_LEDGER` → `FINALIZED`, `SENT_TO_ADVISOR` → `APPROVED`, `NEEDS_CORRECTION` → `REJECTED`) ve Türkçe ödeme yöntemi adlarını otomatik dönüştürür. Yükseltmeden önce veritabanı yedeği alın.

---

## 9. Ekran haritası

Rol → ekran → ekran görüntüsü. Görüntüler `docs/screenshots/` altındadır ve demo veritabanından alınmıştır (README'de galeri olarak gösterilir).

| Rol (demo hesabı) | Web ekranı | Rota | Görüntü | Mobil karşılığı |
| :--- | :--- | :--- | :--- | :--- |
| İşletme Müdürü (`manager`) | Finansal Özet | `/dashboard` | `web-dashboard.png`, `web-dashboard-en.png` | Özet — `mobile-home.png`, `mobile-home-en.png` |
| İşletme Müdürü | Onaylar | `/approvals` | `web-approvals.png` | Onaylar — `mobile-approvals.png` |
| İşletme Müdürü | Stok Yönetimi | `/inventory` | `web-inventory.png` | Daha › Stok — `mobile-stock-en.png` |
| İşletme Müdürü | Reçete Merkezi | `/recipes` | `web-recipes.png` | Daha › Reçete |
| İşletme Müdürü | Satış Analizi | `/sales` | `web-sales.png` | Daha › Satış — `mobile-more.png` |
| İşletme Müdürü | Masalar (izleme) | `/pos` | — | Masalar — `mobile-tables.png` |
| Yönetici (`admin`) | Personel | `/users` | `web-users.png` | Daha › Personel |
| Yönetici | Denetim İzi | `/audit` | `web-audit.png` | Daha › Denetim |
| Kasiyer (`cashier`) | Masalar & Kasa | `/pos` | `web-pos.png` | Masalar |
| Mutfak Şefi (`chef`) | Mutfak Ekranı | `/kitchen` | `web-kitchen.png` | Mutfak |
| Depo Sorumlusu (`warehouse`) | Depo Terminali | `/warehouse` | `web-warehouse.png` | Depo |
| Muhasebe (`accountant`) | Muhasebe | `/accounting` | `web-accounting.png` | Muhasebe |
| Mali Müşavir (`advisor`) | Müşavir Defteri | `/advisor-ledger` | `web-advisor.png` | Müşavir Defteri |
| — | Giriş | `/login` | `web-login.png` | `mobile-login.png` |

Görüntüleri yenilemek için: backend `:8080`, web `:3000` çalışırken Edge/Chrome'u `--headless --remote-debugging-port` ile açıp her demo hesabıyla `/api/auth/login` sonrası ilgili rotaları 1440×900 çözünürlükte yakalayın; mobil görüntüler `adb exec-out screencap -p` ile alınır.

---

## 10. Canlıya çıkış: pazar ve mevzuat eksik analizi

*Kasım 2026 araştırması.* Türkiye'deki adisyon / restoran yazılımları (robotPOS, Simpra, Adisyo, GoPOS, Menulux), uluslararası stok-maliyet yazılımları (MarketMan, Apicbase) ve canlıya çıkışı doğrudan etkileyen mevzuat (GİB e-Adisyon, ÖKC/GMP-3, e-Fatura/e-Arşiv, Google Play hedef API) incelendi; bulgular GastroSync'in koduyla tek tek karşılaştırıldı.

### GastroSync'in rakiplerden güçlü olduğu yerler
- **Muhasebe ve mali müşavir aynı sistemde:** Gider → müdür onayı → ödeme → faturalandırma → müşavir defteri → dönem kapama zinciri. İncelenen adisyon yazılımlarının hiçbiri mali müşaviri sürece rol olarak dahil etmiyor.
- **Görevler ayrılığı ve onay zinciri** (iptal / ikram / indirim / sayım farkı), değiştirilemez denetim izi.
- **Reçete maliyeti ve fiyat dalgalanması:** ağırlıklı ortalama maliyet, alış fiyatı değişince etkilenen yemek ve önerilen fiyat; MarketMan / Apicbase sınıfı özellikler adisyonla aynı veritabanında.
- **Rol bazlı canlı bildirim** (uygulama içi + telefon), 4 dil ve sağdan sola düzen.

### P0 — Gerçek bir restoranda canlıya çıkmadan önce gerekli

| Eksik | Neden kritik | Koddaki durum | Öneri |
| :--- | :--- | :--- | :--- |
| **Mali belge entegrasyonu** (ÖKC / e-Arşiv / e-Adisyon) | Müşteriye verilen belge yasal olarak ÖKC fişi veya e-Arşiv faturadır. e-Adisyon, GİB'in mükellefe bildirimiyle zorunlu hâle gelir. | **Kısmen yapıldı (Kasım 2026):** Ödenmiş adisyona e-Arşiv faturası (UBL-TR 1.2 XML, GİB formatında belge no, VKN/TCKN doğrulaması) kesilir; ÖKC fiş no ve Z no adisyona bağlanır; gün sonu "belgesiz adisyon" mutabakatı var (`/api/fiscal/*`). XML entegratör paneline yüklenebilir. | Kalan: seçilecek özel entegratörün API'siyle canlı gönderim (sözleşme + API anahtarı gerekir) ve GMP-3 uyumlu ÖKC SDK'sı ile otomatik fiş. |
| **Parçalı ödeme / hesap bölme** | Nakit + kart + yemek kartı karışık ödeme ve hesap bölme günlük iştir. | **Yapıldı:** `POST /api/pos/checks/{id}/payments` — kalanın tamamı, tutar, kişi başı eşit bölme veya kalem seçerek ödeme; kalan sıfırlanınca adisyon kapanır (satış `MIXED`). Kısmi tahsilat gerekçeyle geri alınır. Z raporu ödeme satırlarına göre dağıtır. | — |
| **Yazıcı (mutfak / bar / adisyon fişi)** | Ekran olmayan mutfaklarda sipariş fişi, masaya adisyon dökümü. | **Yapıldı:** Ağ ESC/POS yazıcıları (58/80 mm), mutfak / bar / kasa istasyonu; sipariş girilince mutfak/bar fişi otomatik, adisyon dökümü ve bilgi fişi düğmeyle. Sunucu buluttaysa `scripts/print-bridge.mjs` restorandaki bir cihazda köprü olarak çalışır. | — |
| **Bağlantı kesintisine dayanıklılık** | İnternet koptuğunda sipariş ve tahsilat durmamalı. | **Yapıldı (mobil):** sipariş, tahsilat, servis işareti ve ÖKC bağlama cihazda sıraya alınır, bağlantı gelince `Idempotency-Key` ile sırayla gönderilir (sunucu tekrar gönderimde işlemi ikinci kez yapmaz). Masa / menü / adisyon son hâli önbellekten gösterilir. | Kalan: çevrimdışıyken yeni masa açma (sunucu adisyon numarası verir). |
| **Test verisinin canlı veritabanına yazılması** | Testler IDE'den çalıştırılınca surefire profili atlanıyor ve "E2E / Phase3" kayıtları gerçek veriye karışıyordu (stokta 73 kaydın 42'si buydu). | **Düzeltildi:** tüm `@SpringBootTest` sınıflarına `@ActiveProfiles("test")` eklendi; mevcut kalıntılar yedek alınıp arşivlendi (soft-delete). | `npm run smoke -- <adres> --write` yalnızca demo ortamında çalıştırılmalı. |
| **Seed verisinin kendi kurallarıyla çelişmesi** | Jüri / müşteri demosunda tutarsızlık güven kaybettirir. | Eski demo verisinde belge numarası olmadan "deftere işlenmiş" kayıtlar ve hem "onay bekliyor" hem "müşavire gönderilmiş" 25 gider var. | Seed'i gerçek servis katmanı üzerinden üret (`npm run seed:advisor` gibi), doğrudan tabloya yazma. |

### P1 — Rekabet için (rakiplerde standart)

| Eksik | Rakiplerde | GastroSync'te |
| :--- | :--- | :--- |
| Paket servis platformları (Yemeksepeti, Getir Yemek, Trendyol Yemek) siparişlerini tek ekranda alma | robotPOS, Simpra, GoPOS, YemekPOS | Yok. Platformların API erişimi başvuru ile veriliyor. |
| QR menü / masadan sipariş ve ödeme | Simpra (QR Menu Order), çoğu rakip | Yok |
| Yapılandırılmış ürün seçenekleri (pişirme derecesi, ücretli ekstra, porsiyon) | Tüm POS'lar | Yalnızca serbest metin kalem notu var |
| Tedarikçi kartı, tedarikçiye satın alma siparişi (PO), tedarikçi fiyat listesi | MarketMan (PO, fiyat takibi, mal kabul) | Tedarikçi stok kartında düz metin; tedarik talebi var ama tedarikçiye giden sipariş yok |
| Gelen e-faturayı entegratörden otomatik çekme / fatura eşleştirme | MarketMan (invoice management), xtraCHEF | Gider ve fatura numarası elle girilir |
| Rezervasyon | Simpra (rezervasyon entegrasyonu) | Yok |
| Müşteri kartı / sadakat / kampanya | Toast, Square, çoğu yerli POS | Yok |
| Personel vardiya planı ve puantaj | Bulut POS'larda modül olarak | Yok (yalnızca kasa gün sonu) |
| Çok şube (merkezi menü, konsolide rapor) | Zincirler için standart | Tek restoran |

### P2 — İyileştirme
- EFT-POS terminaline tutar gönderme (banka POS'larında GMP-3 zorunlu değildir; yemek kartı POS'ları da entegrasyonsuz kullanılabilir).
- Zaman bazlı fiyat (happy hour), menünün saat / gün planı.
- Tüketim hızına göre otomatik sipariş önerisi (par seviyesi).

### Mevzuat ve mağaza durumu
- **Google Play:** 31 Ağustos 2026'dan itibaren yeni uygulama ve güncellemeler Android 16 (API 36) hedeflemeli. Expo SDK 58 API 36 hedefliyor ✓. Hesap silme (`/account-deletion`) ve gizlilik (`/privacy`) sayfaları hazır ✓.
- **e-Fatura / e-Arşiv:** Kaynaklar 2026'da e-Arşiv'in genel uygulamaya dönüştüğünü, kağıt fatura istisnasının 1 Ocak 2027'de kalktığını belirtiyor; ciro eşikleri ve tarihler için GİB tebliği esas alınmalı. Restoranın gider faturaları büyük oranda e-Fatura / e-Arşiv olarak gelecek → **gelen e-fatura entegrasyonu** muhasebe iş yükünü en çok azaltacak özellik.
- **KVKK:** Uygulama kişisel veri (personel adı, e-posta, cihaz kimliği) işler; aydınlatma metni sayfası var. VERBİS kaydı ve veri işleme envanteri işletmenin sorumluluğundadır.

Kaynaklar: [robotPOS e-Adisyon rehberi](https://www.robotpos.com/blog_new/e-adisyon-gecisi-2026-mevzuat-donanim-pos-tam-rehber) · [FaturaPort e-Adisyon 2026](https://faturaport.com/blog/e-donusum/e-adisyon-nedir-2026-guncel-rehber-kimler-kullanmak-zorunda) · [BirFatura e-Adisyon](https://birfatura.com/e-adisyon-nedir-e-adisyon-zorunlulugu/) · [GİB GMP-3 teknik kılavuz](https://ynokc.gib.gov.tr/UploadedFiles/Files/GMOEBYSTeknikKilavuzu3.pdf) · [Muhasebe News: EFT-POS ve GMP-3](https://www.muhasebenews.com/?p=66628) · [Muhasebe News: yemek kartı POS](https://www.muhasebenews.com/?p=66796) · [robotPOS paket servis entegrasyonları](https://en.robotpos.com/delivery-integrations) · [Simpra restoran yazılımı](https://simprasuite.com/restaurant-software/) · [Adisyo (Capterra)](https://www.capterra.com/p/10049581/Adisyo/) · [MarketMan (GetApp)](https://www.getapp.com/all-software/a/marketman-restaurant-inventory/) · [Apicbase özellikleri (G2)](https://www.g2.com/products/https-get-apicbase-com/features) · [Google Play hedef API](https://developer.android.com/google/play/requirements/target-sdk) · [Sovos 2026 e-dönüşüm takvimi](https://sovos.com/tr/blog/kdv/sirketler-icin-2026-e-donusum-takvimi-ve-zorunluluklar/) · [Paraşüt e-Arşiv zorunluluğu](https://www.parasut.com/blog/e-fatura-ve-e-arsiv-zorunlulugu) · [Flipdish handheld POS](https://www.flipdish.com/gb/resources/blog/handheld-pos-features-restaurants)


## 11. Bilgisayar kapalıyken çalışma (bulut kurulumu) ve Google Play

Telefon ve web paneli sunucuya bağlanır. Sunucu geliştirici bilgisayarında çalıştığı sürece bilgisayar kapanınca uygulama da durur. Kalıcı çalışma için sunucu ve veritabanı bulutta barınmalıdır. İki hazır yol var:

**A) Render.com (en az iş):** Depo GitHub'da. Render panelinde *New → Blueprint* ile depoyu seçin; `render.yaml` veritabanını (PostgreSQL), API'yi ve web panelini birlikte kurar. İstenen değerler: yönetici şifresi, işletme unvanı, VKN, vergi dairesi, adres. JWT anahtarı otomatik üretilir. Adres `https://gastrosync-web.onrender.com` olur; kendi alan adınız bağlanabilir.

**B) Kendi sunucunuz (VPS):** Docker kurulu bir Linux sunucuda `.env` dosyasını `.env.example`'dan doldurun, `DOMAIN` değişkenini alan adınız yapın ve `docker compose --profile tls up -d` çalıştırın. Caddy, Let's Encrypt sertifikasını otomatik alır.

**Mobil uygulamayı buluta bağlama ve Google Play:**
1. `mobile/eas.json` içindeki `EXPO_PUBLIC_API_URL` değerini bulut adresiniz yapın (ör. `https://gastrosync-web.onrender.com/api`). Giriş ekranındaki *Sunucu adresi* kutusundan da sonradan değiştirilebilir.
2. `cd mobile && npx eas-cli@latest login` (ücretsiz Expo hesabı).
3. Telefona kurulacak APK: `npx eas-cli@latest build -p android --profile preview` → bağlantıdan indirip kurun.
4. Google Play paketi (AAB): `npx eas-cli@latest build -p android --profile production`; ardından `npx eas-cli@latest submit -p android` (Play Console geliştirici hesabı, tek seferlik 25 USD). İlk yükleme Play Console'da elle yapılabilir; mağaza kaydı için gizlilik sayfası `/privacy`, hesap silme sayfası `/account-deletion` hazırdır.

**Yazıcı köprüsü (sunucu bulutta, yazıcı restoranda):**
```
GASTROSYNC_URL=https://gastrosync-web.onrender.com/api GASTROSYNC_USER=yazici GASTROSYNC_PASSWORD=... node scripts/print-bridge.mjs
```
Köprü hesabı yazdırma işlerini görebilen (Kasiyer gibi) bir personel hesabıdır. Yazıcı ekranında bağlantı türü "Köprü" seçilir.
