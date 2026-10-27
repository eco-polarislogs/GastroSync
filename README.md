# 🍽️ GastroSync ERP — Kurumsal Restoran İşletim, Kasa/Muhasebe & Maliyet Zekası Sistemi (OS)

[![React](https://img.shields.io/badge/Frontend-React%2018%20%2B%20Vite%206-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![React Native](https://img.shields.io/badge/Mobile-React%20Native%20%2F%20Expo%2052-61DAFB?logo=react&logoColor=black)](https://reactnative.dev/)
[![Spring Boot](https://img.shields.io/badge/Backend-Spring%20Boot%203.3.4-6DB33F?logo=springboot&logoColor=white)](https://spring.io/)
[![Java](https://img.shields.io/badge/Java-21%20LTS-ED8B00?logo=openjdk&logoColor=white)](https://adoptium.net/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL%2016-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![WebSocket](https://img.shields.io/badge/RealTime-STOMP%20WebSocket-00A4A6?logo=websocket&logoColor=white)](https://spring.io/)
[![Docker](https://img.shields.io/badge/DevOps-Docker%20%26%20Nginx%20Alpine-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Security](https://img.shields.io/badge/Security-Spring%20Security%206%20%2B%20JWT-red?logo=springsecurity&logoColor=white)](https://spring.io/projects/spring-security)
[![Tests](https://img.shields.io/badge/Tests-22%2F22%20Passing%20(100%25)-brightgreen)](https://github.com)
[![i18n](https://img.shields.io/badge/i18n-TR%20%7C%20EN%20%7C%20DE%20%7C%20AR-blue)](https://gastrosync.local)

**GastroSync ERP**, modern restoran zincirleri, çok şubeli yeme-içme operasyonları ve gastronomi işletmeleri için geliştirilmiş uçtan uca **İşletim, Kasa-Muhasebe, Mali Müşavir (SMMM) Onay Defteri, Dinamik Reçete Maliyeti (COGS), Gerçek Zamanlı Departman Telsizi ve Akıllı Uyarı Ekosistemidir**.

Sistem; uluslararası ticari standartlarda (Toast POS, Oracle MICROS Simphony ve SambaPOS) çalışacak şekilde; **React 18 Web**, **React Native (iOS/Android) Mobil**, **Java 21 / Spring Boot 3.3.4 (STOMP WebSocket)** kurumsal arka yüzü ve **PostgreSQL 16** ilişkisel veritabanı ile tam senkronize tek bir mimaride birleştirilmiştir.

---

## 📌 İçindekiler
1. [Öne Çıkan Kurumsal Özellikler](#-öne-çıkan-kurumsal-özellikler)
2. [Gerçek Zamanlı Departman Telsizi & Akıllı Bildirimler (STOMP)](#-gerçek-zamanlı-departman-telsizi--akıllı-bildirimler-stomp)
3. [Ekranlar ve Rol Yetki Matrisi (RBAC)](#-ekranlar-ve-rol-yetki-matrisi-rbac)
4. [Dinamik COGS & Reçeteden Otomatik Stok Düşüm Motoru](#-dinamik-cogs--reçeteden-otomatik-stok-düşüm-motoru)
5. [3 Aşamalı Mali Müşavir (SMMM) Defter Durum Makinesi](#-3-aşamalı-mali-müşavir-smmm-defter-durum-makinesi)
6. [Eşzamanlılık & ACID Veritabanı Bütünlüğü](#-eşzamanlılık--acid-veritabanı-bütünlüğü)
7. [Sistem Mimarisi & Konteynerleştirme (Docker & Nginx)](#-sistem-mimarisi--konteynerleştirme-docker--nginx)
8. [Mobil Uygulama Mimarisi (React Native & Expo)](#-mobil-uygulama-mimarisi-react-native--expo)
9. [Uçtan Uca Doğrulama & Otomasyon Test Paketi (E2E)](#-uçtan-uca-doğrulama--otomasyon-test-paketi-e2e)
10. [Çoklu Dil Desteği (i18n)](#-çoklu-dil-desteği-i18n)
11. [Hızlı Başlangıç & Kurulum Rehberi](#-hızlı-başlangıç--kurulum-rehberi)
12. [Varsayılan Demo Hesapları](#-varsayılan-demo-hesapları)
13. [Lisans](#-lisans)

---

## ✨ Öne Çıkan Kurumsal Özellikler

### 1. 🎯 Dinamik Gerçek Zamanlı COGS (Satılan Malın Maliyeti) Motoru
- Sabit yüzdelik veya tahmini yapay çarpanlar **tamamen kaldırılmıştır**.
- Kasa POS üzerinden satılan her menü kalemi (`SalesRecord`), arka yüzde reçetesindeki hammadde gramajlarını (`RecipeIngredient` / `ingredientsJson`) çözer ve PostgreSQL üzerinde anlık olarak stoktan düşer.
- Gerçekleşen hammadde maliyeti, `stock_transactions` tablosundaki `OUTBOUND_SALE` kayıtlarının toptancı birim fiyatları üzerinden toplanarak kuruşu kuruşuna dinamik hesaplanır.

### 2. 🛡️ Güçlendirilmiş Spring Security 6 & JWT Mimarisi
- **Metot Düzeyinde RBAC:** `@PreAuthorize("hasAnyRole(...)")` anotasyonları ile hassas finansal veriler, satış özetleri ve kullanıcı yönetimi denetlenir.
- **IDOR (Yetkisiz Nesne Erişimi) Koruması:** Kullanıcıların istek parametrelerini değiştirerek diğer rollere ait bildirimleri çekmesi engellenmiş; bildirim servisi kullanıcının doğrulanmış JWT rolüne kilitlenmiştir.
- **Kriptografik Denetim İzi (Audit Identity):** Stok giriş-çıkış hareketlerinde operatör kimliği (`recordedBy`), istemciden gelen güvensiz parametrelerden değil, doğrudan Spring `SecurityContextHolder` üzerinden doğrulanmış kullanıcı oturumundan çekilir.
- **Otomatik 401 Eviction:** Web ve Mobilde süresi dolmuş veya geçersiz tokenlar anında tespit edilir, yerel depolama temizlenir ve kullanıcı güvenle `/login?expired=true` ekranına yönlendirilir.

### 3. 📖 3 Aşamalı Mali Müşavir (SMMM) Defter Durum Makinesi
- Faturalar ve işletme giderleri katı bir durum akışına (`PENDING_APPROVAL -> APPROVED -> FINALIZED`) tabidir.
- **Tahrifat Koruması (Tamper-Proof Ledger):** Mali Müşavir tarafından resmi deftere onaylanmış (`FINALIZED`) bir gider kaydının silinmesi (`DELETE`) veya güncellenmesi (`UPDATE`) sistem seviyesinde `IllegalStateException` fırlatılarak engellenir.

### 4. ⚡ Eşzamanlılık & ACID Uyumu (Concurrency & Row Locking)
- Depo görevlisinin Mobil Uygulamadan mal kabulü (+50 kg un) yaptığı esnada, Kasa/Müdürün Web Dashboard üzerinden manuel sayım düzeltmesi (+30 kg un) yapması durumunda PostgreSQL satır düzeyinde kilit (`Pessimistic / Row-Level Lock`) ile işlemleri sıralar.
- Sıfır kayıp güncelleme (Zero Lost Updates), sıfır kirli okuma (Zero Dirty Reads) garantisi verilir.

### 5. 🐳 Sıfır-CORS Nginx Ters Proxy & Docker Orkestrasyonu
- `docker-compose.yml` ile PostgreSQL 16 Alpine, Spring Boot 3.3.4 (Java 21 Alpine) ve React 18 Nginx Alpine servisleri tek komutla ayağa kaldırılır.
- Nginx `/api/*` isteklerini arka yüz konteynerine aktararak canlı dağıtımlarda CORS hatalarını tamamen ortadan kaldırır.

### 6. 📻 Restoran İçi Departman Telsizi & Ekip Sohbeti (Team Chat)
- Salon, Mutfak, Kasa, Yönetim ve Depo arasında anlık kanallar (`#general`, `#kitchen`, `#warehouse`, `#management`, `#shift`).
- Kritik stok tükenmesi veya acil tedarik siparişi açıldığında ilgili departmanlara anında sesli/görsel telsiz anonsu düşer.

---

## 📡 Gerçek Zamanlı Departman Telsizi & Akıllı Bildirimler (STOMP)

GastroSync, restoran içerisindeki anlık iletişimi ve onay akışlarını **Spring Boot STOMP Message Broker** ve saf **WebSocket** üzerinden yönetir:

```
 ┌───────────────────────────────────────────────────────────────┐
 │               GastroSync Real-Time Comm Hub                   │
 └──────┬───────────────────────┬─────────────────────────┬──────┘
        │ STOMP over WS         │ STOMP over WS           │
        ▼                       ▼                         ▼
┌──────────────────┐    ┌─────────────────┐    ┌──────────────────┐
│  React Web App   │    │ Expo Mobile App │    │ Spring Boot 3.3  │
│  (Vite / React)  │    │ (iOS & Android) │    │ Message Broker   │
└──────────────────┘    └─────────────────┘    └─────────┬────────┘
                                                         │ ACID Persist
                                                         ▼
                                               ┌──────────────────┐
                                               │ PostgreSQL DB    │
                                               │ Chat & Notifs    │
                                               └──────────────────┘
```

### Öne Çıkan İletişim & Uyarı Yetenekleri:
1. **RFC 6750 JWT Bearer Doğrulaması:** WebSocket el sıkışması (`CONNECT`) anında JWT doğrulanır; yetkisiz oturumların sisteme sızması engellenir.
2. **Kanal İzin Denetimi (Topic Authorization):** Mutfak (`/topic/kitchen`), Depo (`/topic/warehouse`) ve Yönetim (`/topic/management`) kanallarına abonelikler Spring Security `ChannelInterceptor` seviyesinde denetlenir.
3. **Eyleme Dayalı Derin Bağlantı (Actionable Deep-Linking):** Bildirimler düz metin değildir. `entityId`, `targetRoute` ve `actionType` içerir. Örneğin bir faturaya ait onay uyarısına tıklandığında hem Web hem de Mobil doğrudan o faturanın onay ekranına yönlendirir.
4. **Öncelik Rozetleri (Severity Levels):** Bildirimler önem derecesine göre rozetlenir:
   - `CRITICAL`: Yanıp sönen kırmızı acil müdahale rozeti.
   - `WARNING`: Kehribar renkli stok/vade uyarı rozeti.
   - `INFO`: Zümrüt renkli bilgilendirme rozeti.
5. **Cihazlar Arası Okundu Senkronizasyonu (Read Receipts):** Web'de okunan bir bildirim veya mesaj, `/topic/notifications/read` yayını ile mobildeki rozet sayısını ve durumunu anında günceller.
6. **PostgreSQL Kalıcılığı & Çift Yönlü Yansıma:** Mesajlar hem veritabanında `chat_messages` tablosuna atomik olarak yazılır hem de bağlı tüm cihazlara anında fırlatılır.

---

## 🔐 Ekranlar ve Rol Yetki Matrisi (RBAC)

| Rol Adı | Kod | Varsayılan Sayfa | Erişebildiği Modüller & Arayüzler |
| :--- | :--- | :--- | :--- |
| **Sistem Yöneticisi (Super Admin)** | `ADMIN` | `/dashboard` | Tüm Ekranlar (Yönetim Paneli, Kasa, Müşavir Defteri, Stok, Reçeteler, Satış, Depo, Kullanıcılar, Telsiz) |
| **İşletme Yöneticisi (Müdür)** | `MANAGER` | `/dashboard` | Finansal Dashboard, Kasa Takibi, Stok, Reçeteler, Satış Analizi, Gider Onay/Ödeme, Departman Telsizi |
| **Muhasebeci (Kasa)** | `ACCOUNTANT` | `/cashier` | Kasa & Nakit Akışı, POS Satış, Gider Faturası Girişi, Toptancı Borç Ödeme, Z Raporu, Günlük Ciro |
| **Mali Müşavir (SMMM)** | `FINANCIAL_ADVISOR` | `/advisor-ledger` | Resmi Defter Onayı (Finalize), Gerekçeli Ret, TDHP Hesap Planı, Luca/Zirve Mahsup Fişi, KDV Beyannamesi |
| **Mutfak Şefi (Chef)** | `CHEF` | `/recipes` | Reçete Merkezi, Gramaj & Porsiyon Maliyeti, Depo Stok İzleme, Acil Tedarik Siparişi Açma, Mutfak Telsizi |
| **Depo Sorumlusu** | `WAREHOUSE` | `/warehouse` | Barkodlu Mal Kabul Terminali, Zayiat/Fire Girişi, Manuel Stok Arama, Sayım Düzeltme, Depo Telsizi |

---

## 🔄 Dinamik COGS & Reçeteden Otomatik Stok Düşüm Motoru

GastroSync, ticari restorancılığın en kritik operasyonel zincirini hatasız işletir:

```
 [1. Depo Mal Kabul] ────────► [2. Reçete Standartlaştırma]
        │                                     │
   Mobil Barkod Okuma                  BOM Gramaj Tanımı
   +50.00 kg Dana Antrikot             0.250 kg / Porsiyon
        │                                     │
        ▼                                     ▼
 [4. Dinamik COGS Analizi]  ◄───────── [3. POS Satış Kaydı]
   Gerçek Toptancı Fiyatı                4 Porsiyon Satış
   (Örn: 1.00 kg * 450 TL = 450 TL)      Stoktan Anında 1.00 kg Düşüm
   PostgreSQL Ledger Kaydı               Kalan Stok: 49.00 kg
```

---

## 🏛️ 3 Aşamalı Mali Müşavir (SMMM) Defter Durum Makinesi

Finansal disiplin ve vergi mevzuatına uyum için gider kayıtları 3 katmanlı durum makinesiyle korunur:

```
 [Gider Talebi Oluşturma]
        │
        ▼
   PENDING_APPROVAL ──(Kasa / Müdür Onayı)──► APPROVED & PAID
                                                    │
                                                    ▼ (Mali Müşavir İncelemesi)
                                       ┌────────────┴────────────┐
                                       │                         │
                                    FINALIZED                 REJECTED
                            (Resmi Deftere İşlendi)     (Gerekçeli Düzeltme)
                               [KİLİTLİ: Silinemez]
```

---

## 🐳 Sistem Mimarisi & Konteynerleştirme (Docker & Nginx)

Sistem hem yerel ortamda hem de AWS/DigitalOcean VPS üzerinde üretim standardında konteyner mimarisi sunar:

```
                     ┌───────────────────────────────────────────────┐
                     │            NGINX ALPINE REVERSE PROXY         │
                     │          (Port 80: HTTP / SSL Termination)    │
                     └───────┬───────────────────────────────┬───────┘
                             │                               │
                      Statik SPA Dosyaları               /api/* Ters Proxy
                      (React 18 / Vite 6)           (Zero CORS / Upgrade headers)
                             │                               │
                             ▼                               ▼
                     ┌───────────────┐               ┌───────────────┐
                     │ gastrosync-   │               │ gastrosync-   │
                     │ frontend      │               │ backend       │
                     │ (Dist static) │               │ (Java 21 JRE) │
                     └───────────────┘               └───────┬───────┘
                                                             │
                                                     JDBC Bağlantı Havuzu
                                                     (HikariCP / Port 5432)
                                                             │
                                                             ▼
                                                     ┌───────────────┐
                                                     │ gastrosync-db │
                                                     │ (Postgres 16) │
                                                     │ Volume: pgdata│
                                                     └───────────────┘
```

---

## 📱 Mobil Uygulama Mimarisi (React Native & Expo)

GastroSync mobil uygulaması **React Native & Expo SDK 52** üzerinde yerel bileşenlerle inşa edilmiştir:

- **Dinamik Ağ & Host Çözümleme (`mobileAxiosClient.js`):** Yerel ağdaki (LAN) geliştirme bilgisayarının IP adresini Expo üzerinden dinamik tespit eder; kod içine gömülü statik localhost bağımlılıklarını sıfırlar.
- **Kamera Barkod Okuyucu (`CameraScanner.js`):** Cihaz kamerasını doğrudan kullanarak EAN-13, Code 128 ve QR kodları milisaniyeler içinde çözer.
- **TanStack Query v5 Senkronizasyonu:** Depoda yapılan mal kabul veya sayım işlemleri, web üzerindeki yönetici paneline anında yansır (`queryClient.invalidateQueries`).
- **Platform Odaklı Tasarım:** Android için Material Design sekmeleri; iOS için Cupertino dinamik ada/çentik (`Safe Area`) uyumu.

---

## 🧪 Uçtan Uca Doğrulama & Otomasyon Test Paketi (E2E)

Sistemin üretim öncesi kararlılığı; [`GastroSyncProductionE2ETests.java`](file:///c:/Users/solma/OneDrive/Desktop/GastroSync/backend/src/test/java/com/gastrosync/GastroSyncProductionE2ETests.java), [`GastroSyncApplicationTests.java`](file:///c:/Users/solma/OneDrive/Desktop/GastroSync/backend/src/test/java/com/gastrosync/GastroSyncApplicationTests.java) ve [`SecurityAndChatSynchronizationTests.java`](file:///c:/Users/solma/OneDrive/Desktop/GastroSync/backend/src/test/java/com/gastrosync/SecurityAndChatSynchronizationTests.java) sınıflarında yer alan **22 adet kapsamlı entegrasyon testi** ile doğrulanmıştır.

```bash
cd backend
./maven/apache-maven-3.9.9/bin/mvn test
```

### Test Sonucu
```
[INFO] -------------------------------------------------------
[INFO]  T E S T S
[INFO] -------------------------------------------------------
[INFO] Running com.gastrosync.GastroSyncApplicationTests
[INFO] Tests run: 5, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.gastrosync.GastroSyncProductionE2ETests
[INFO] Tests run: 11, Failures: 0, Errors: 0, Skipped: 0
[INFO] Running com.gastrosync.SecurityAndChatSynchronizationTests
[INFO] Tests run: 6, Failures: 0, Errors: 0, Skipped: 0
[INFO] 
[INFO] Results:
[INFO] Tests run: 22, Failures: 0, Errors: 0, Skipped: 0
[INFO] ------------------------------------------------------------------------
[INFO] BUILD SUCCESS
[INFO] ------------------------------------------------------------------------
```

### Doğrulanan Kritik Test Senaryoları
1. **RBAC Metot Koruması:** `CHEF` ve `WAREHOUSE` rollerinin `/api/sales/summary` uç noktasına erişimi katı biçimde `HTTP 403 Forbidden` ile engellenir; `MANAGER` erişebilir (`HTTP 200`).
2. **IDOR Zafiyet Koruması:** Mutfak şefinin `?role=FINANCIAL_ADVISOR` parametresiyle mali müşavir bildirimlerini dinlemesi engellenmiştir.
3. **Audit Identity Doğrulaması:** Stok hareketlerindeki `recordedBy` operatör alanı, kullanıcının gönderdiği JSON gövdesinden bağımsız olarak Spring JWT oturumundan güvenle alınır.
4. **Eşzamanlılık & ACID Testi:** Eşzamanlı iki paralel thread üzerinden yapılan mal kabul (+50 kg) ve düzeltme (+30 kg) işlemleri PostgreSQL satır kilidiyle sıralanır; bakiye tam 180 kg olarak kaydedilir.
5. **Reçeteden Otomatik Stok Düşümü:** POS satışı sonrası reçeteli ürünlerin hammaddeleri gramaj bazında eksiltilir.
6. **Mali Durum Makinesi & Tahrifat Koruması:** Resmi deftere işlenmiş (`FINALIZED`) kayıtların silinmesi veya değiştirilmesi `IllegalStateException` ile reddedilir.
7. **STOMP WebSocket & Ekip Telsizi Senkronizasyonu:** Mesajların PostgreSQL `chat_messages` tablosuna atomik yazılması ve `/topic/chat/{channel}` kanallarına anında dağıtımı doğrulanmıştır.
8. **Akıllı Bildirim & Okundu Eşitlemesi:** Öncelik seviyelerine (`CRITICAL`, `WARNING`, `INFO`) sahip derin bağlantılı bildirimlerin oluşturulması ve cihazlar arası okundu senkronizasyonu test edilmiştir.

---

## 🌍 Çoklu Dil Desteği (i18n)

Sistem `src/utils/translations.js` (Web) ve `mobile/src/data/translations.js` (Mobil) sözlükleri üzerinden tek merkezden yönetilir:

| Dil | Kod | Kapsam |
| :--- | :--- | :--- |
| **Türkçe** | `tr` | Varsayılan dil; tüm ekranlar, TDHP hesapları ve yasal bildirimler |
| **İngilizce** | `en` | Uluslararası restoran yönetimi ve POS terminolojisi |
| **Almanca** | `de` | Avrupa gastronomi standartları ve GuV muhasebe terimleri |
| **Arapça** | `ar` | Körfez ve Orta Doğu restoran zincirleri için RTL uyumlu çeviriler |

---

## 🚀 Hızlı Başlangıç & Kurulum Rehberi

### Yöntem A: Docker Compose ile Tek Komutla Çalıştırma (Önerilen)
Sistemde Docker kurulu ise kök dizinden tek komutla tüm mimariyi ayağa kaldırabilirsiniz:
```bash
docker-compose up -d --build
```
> - **Web Uygulaması:** `http://localhost` (Port 80)  
> - **Backend API & Swagger:** `http://localhost:8080/swagger-ui/index.html`  
> - **PostgreSQL Veritabanı:** `localhost:5432`  

---

### Yöntem B: Windows Tek Tıkla Başlatıcı
Kök dizindeki **`start-all.bat`** dosyasını çalıştırarak Backend (`:8080`), Web (`:3000`) ve Mobil Expo (`:8081`) sunucularını aynı anda başlatabilirsiniz:
```cmd
start-all.bat
```

---

### Yöntem C: Manuel Geliştirici Kurulumu

#### 1. Veritabanını Başlatın
PostgreSQL üzerinde `gastrosync` adında bir veritabanı açın:
```sql
CREATE DATABASE gastrosync;
```

#### 2. Backend API'yi Başlatın
```bash
cd backend
./maven/apache-maven-3.9.9/bin/mvn spring-boot:run
```
> Sunucu `http://localhost:8080` üzerinde başlar. `DataSeeder` sınıfı demo kullanıcıları, reçeteleri ve hammadde kayıtlarını otomatik olarak oluşturur.

#### 3. Web Dashboard'u Başlatın
```bash
npm install
npm run dev
```
> Web arayüzü `http://localhost:3000` (veya `5173`) üzerinde açılır.

#### 4. Mobil Uygulamayı Başlatın (Expo)
```bash
cd mobile
npm install
npx expo start
```

---

## 🔑 Varsayılan Demo Hesapları

Tüm hesapların varsayılan şifresi **`123456`** olarak ayarlanmıştır:

| Kullanıcı Adı | E-posta | Rol | Açıklama |
| :--- | :--- | :--- | :--- |
| **`admin`** | `admin@gastrosync.com` | Süper Yönetici | Tüm sistem, kullanıcı yetkilendirme ve raporlar |
| **`manager`** | `manager@gastrosync.com` | İşletme Müdürü | Satış, maliyet ve operasyon yönetimi |
| **`accountant`** | `muhasebe@gastrosync.com` | Kasa & Muhasebe | Nakit akışı, gider ödeme, borç takibi, Z-Raporu |
| **`advisor`** | `musavir@gastrosync.com` | Mali Müşavir (SMMM) | Resmi yevmiye defteri onayı, Luca/Zirve entegrasyonu |
| **`chef`** | `chef@gastrosync.com` | Mutfak Şefi | Reçete gramajları, porsiyon maliyeti ve tüketim |
| **`warehouse`** | `depo@gastrosync.com` | Depo Sorumlusu | Barkodlu mal kabul, zayiat ve stok sayımı |

---

## 📄 Jüri & Canlı Değerlendirme Kılavuzu
Projenin canlı değerlendirmesi, rol geçişleri ve senaryo adımları için detaylı [Jüri Değerlendirme Kılavuzu (JURY_EVALUATION_PLAYBOOK.md)](file:///c:/Users/solma/OneDrive/Desktop/GastroSync/JURY_EVALUATION_PLAYBOOK.md) dosyasını inceleyebilirsiniz.

---

## 📜 Lisans
Bu proje [MIT Lisansı](LICENSE) altında lisanslanmıştır.  
GastroSync © 2026 Tüm Hakları Saklıdır.  
Geliştirici: Ecren Solmazgül
