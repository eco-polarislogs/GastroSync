# 📚 GastroSync — Geliştirici & Kullanıcı Wiki Rehberi

Bu wiki belgesi, **GastroSync Restoran İşletim & Maliyet Zekası** sisteminin iç çalışma mantığını, algoritmalarını, güvenlik mimarisini ve iş akışlarını ayrıntılı olarak açıklamaktadır.

---

## 📑 İçindekiler
1. [Food Cost Hesaplama Mantığı ve Matematiksel Modeli](#1-food-cost-hesaplama-mantığı)
2. [Rol Tabanlı Erişim Kontrolü (RBAC) ve Güvenlik](#2-rol-tabanlı-erişim-kontrolü-rbac)
3. [Depo & Barkod Tarama Döngüsü](#3-depo--barkod-tarama-döngüsü)
4. [Satış & POS Entegrasyonu ve Kırılımlar](#4-satış--pos-entegrasyonu-ve-kırılımlar)
5. [Dizayn Sistemi & Keyvo Mint-Emerald Teması](#5-dizayn-sistemi--keyvo-mint-emerald-teması)
6. [Hata Giderme (Troubleshooting)](#6-hata-giderme-troubleshooting)

---

## 1. Food Cost Hesaplama Mantığı

Restoran sektörünün en kritik kârlılık metriği olan **Food Cost Oranı (Yemek Maliyeti Yüzdesi)**, GastroSync içerisinde hammadde reçete maliyetleri üzerinden dinamik olarak hesaplanır:

### Formül:
$$\text{Reçete Maliyeti} = \sum_{i=1}^{n} (\text{Malzeme Miktarı}_i \times \text{Birim Fiyatı}_i)$$

$$\text{Food Cost \%} = \left( \frac{\text{Reçete Maliyeti}}{\text{Menü Satış Fiyatı}} \right) \times 100$$

### Kâr Gösterge Renkleri:
- **Yeşil (`Food Cost <= %25`)**: Yüksek kârlı ürün. Restoran için en ideal segment.
- **Sarı (`%25 < Food Cost <= %35`)**: Standart ve dengeli yemek maliyeti.
- **Kırmızı (`Food Cost > %35`)**: Yüksek maliyetli veya porsiyon gramajı gözden geçirilmesi gereken ürün (Örn: Ağır dinlendirilmiş etler veya deniz ürünleri).

---

## 2. Rol Tabanlı Erişim Kontrolü (RBAC)

GastroSync, yetkisiz veri erişimini hem **İstemci (React ProtectedRoute)** hem de **Sunucu (Spring Boot API)** katmanında denetler:

### 1. Dinamik Rol Değişimi:
- Ana yönetici (`admin`), `Kullanıcı Yönetimi` ekranından herhangi bir personelin rolünü değiştirdiğinde (`PUT /api/users/{id}/role`):
  1. İstek Spring Boot backend'ine gönderilir.
  2. PostgreSQL veritabanındaki `AppUser` tablosundaki `role` sütunu güncellenir.
  3. Kullanıcı sonraki girişinde doğrudan yeni rolüne ait ekranlara erişir.

### 2. E-posta veya Kullanıcı Adı ile Giriş:
- `UserController.login()` fonksiyonu gelen veriyi hem `findByUsernameIgnoreCase` hem de `findByEmailIgnoreCase` ile sorgular.
- Personel, yöneticinin tanımladığı şirket maili (`ahmet@gastrosync.com`) veya kullanıcı adı ile sisteme güvenle girebilir.

---

## 3. Depo & Barkod Tarama Döngüsü

### Kamera Tabanlı Tarama:
- `Html5BarcodeScanner.jsx` bileşeni tarayıcının `MediaDevices.getUserMedia` API'si üzerinden kamerayı açar.
- Kamera vizörü kurumsal dikdörtgen bir kılavuz çizgisi ve lazer tarama çizgisi sunar.
- Barkod algılandığında optik okuyucu anında titreşim/ses geri bildirimi verir ve ürünü bulup stok mal kabul modalına otomatik aktarır.

### Zayiat (Fire) Düşümü:
- Depo görevlisi veya şef bozulmuş/hasarlı ürünleri girdiğinde, stoktan düşülür ve bu işlem finansal tabloda **Toplam Zayiat Maliyeti** olarak özetlenir.

---

## 4. Satış & POS Entegrasyonu ve Kırılımlar

GastroSync Satış Analizi ekranı iki temel görünüm sunar:

1. **Ürün Bazlı Satış Özeti**:
   - Menüdeki her yemeğin gün içindeki toplam satılan porsiyon adedi.
   - Elde edilen brüt gelir ve toplam hammadde maliyeti.
   - Net kâr ve Food Cost yüzdesi.

2. **Detaylı Satış Kaydı (Zaman Dilimlerine Göre)**:
   - Öğle servisi (`12:00-14:00`), Akşam servisi (`19:00-22:00`) ve Sabah servisi kırılımları.
   - Hangi saat aralığında hangi yemeğin daha fazla talep gördüğünü gösterir.

---

## 5. Dizayn Sistemi & Keyvo Mint-Emerald Teması

Platform, kurumsal yeşil tonlarına ve göz yormayan kontrast oranlarına dayanır:

- **Arka Plan Rengi**: `#f2f9f5` (Açık ve ferah mint-krem).
- **Vurgu & Aksiyon Rengi**: `#047857` (Zümrüt Yeşili) ve `#10b981` (Canlı Emerald).
- **Yazı Renkleri**: `#062612` (Koyu orman yeşili - yüksek okunabilirlik) ve `#64748b` (Açık gri alt metinler).
- **Animasyonlu Balonlar**: Giriş ekranında zümrüt ve nane tonlarında hareket eden hafif bulanıklaştırılmış (`blur(80px)`) 4 adet organik balon.

---

## 6. Hata Giderme (Troubleshooting)

### Soru 1: Backend başlatılamıyor veya 8080 portu dolu uyarısı veriyor:
**Çözüm**: 8080 portunu kullanan işlemi sonlandırın:
```powershell
Get-Process -Id (Get-NetTCPConnection -LocalPort 8080).OwningProcess | Stop-Process -Force
```

### Soru 2: PostgreSQL bağlantı hatası alıyorum:
**Çözüm**: `backend/src/main/resources/application.properties` dosyasında PostgreSQL şifrenizi doğrulayın ve veritabanının çalıştığından emin olun:
```sql
psql -U postgres -c "CREATE DATABASE gastrosync;"
```

### Soru 3: Kamera barkod okuyucu açılmıyor:
**Çözüm**: Tarayıcınızın adres çubuğundaki kilit simgesine tıklayarak kamera izninin verildiğinden emin olun. (Tarayıcılar kamerayı yalnızca `localhost` veya `https://` üzerinde destekler).
