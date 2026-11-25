# GastroSync — Jüri / Demo Değerlendirme Kılavuzu

Bu kılavuz demo kurulumunda (demo verisi açık) sistemin uçtan uca nasıl değerlendirileceğini anlatır.

## 1. Demo ortamını başlatma

```bash
cp .env.example .env
# .env içinde: POSTGRES_PASSWORD, GASTROSYNC_JWT_SECRET (openssl rand -base64 48) doldurun
# demo için: GASTROSYNC_SEED_DEMO_DATA=true
docker compose up -d --build
node scripts/smoke-test.mjs http://localhost            # salt okunur kontrol
node scripts/smoke-test.mjs http://localhost --write    # demo ortamında uçtan uca akış
```

Web paneli: `http://localhost` · Geliştirmede: `start-all.bat` → `http://localhost:3000`

## 2. Demo hesapları (yalnızca demo verisiyle; şifre `123456`)

| Kullanıcı | Rol | Açılış ekranı |
| :--- | :--- | :--- |
| `admin` | Sistem Yöneticisi | Yönetim paneli |
| `manager` | İşletme Müdürü | Yönetim paneli |
| `accountant` | Muhasebe & Kasa | Kasa & Muhasebe |
| `advisor` | Mali Müşavir (SMMM) | Resmi Defter |
| `chef` | Mutfak Şefi | Reçeteler |
| `warehouse` | Depo Sorumlusu | Depo terminali |

## 3. Değerlendirme senaryoları

**Senaryo 1 — Tedarikten deftere tam döngü**
1. `chef`: Stok ekranında kritik bir ürün için *Sipariş Talebi Aç*. Muhasebe, müdür ve depoya bildirim düşer.
2. `accountant`: Kasa & Muhasebe → *Onay Bekleyen* → talebi *Düzelt* (fatura no, gerçek tutar). Aynı kişi *Onayla* diyemez ("Başka yetkili onaylamalı").
3. `manager`: aynı kaydı onaylar. `accountant`: *Ödeme Bekleyen Borçlar* → kısmi veya tam ödeme.
4. `warehouse`: Depo terminali → *Bekleyen Teslimatlar* → tek dokunuşla mal kabul; stok ve ortalama maliyet güncellenir.
5. `advisor`: Resmi Defter → *Defter Onayı Bekleyen* → *Deftere İşle*. Kayıt artık düzeltilemez / silinemez / reddedilemez.

**Senaryo 2 — Satış ve maliyet**
1. `accountant`: Satış & POS → menüden ürün ekle → siparişi kaydet. Fiyat reçeteden gelir; hammadde otomatik düşer.
2. Stokta yetmeyen bir ürün satılmaya çalışılırsa sipariş bütünüyle reddedilir.
3. `manager`: satışı gerekçeyle iptal eder; stok ters kayıtla geri gelir, muhasebeye bildirim düşer.

**Senaryo 3 — Gün sonu ve vergi**
1. `accountant`: Kasa & Muhasebe → *Z Raporu & Kasa Sayımı* → sayılan nakdi girin. Fark varsa açıklama istenir ve yönetime bildirilir.
2. `advisor`: *KDV Ön İzleme* ve *Yevmiye Fişleri* (borç = alacak dengesi, Excel/CSV dışa aktarım).
3. `advisor`: *Dönem Kapanışı* — geçmiş ay, tüm kayıtlar kesinleşmişse kapatılır; kapalı döneme kayıt girilemez.

**Senaryo 4 — Güvenlik**
1. `chef` ile adres çubuğuna `/users` yazın → engellenir; olay *Denetim İzi* ekranına ve yöneticilere düşer.
2. `admin`: bir kullanıcının rolünü değiştirin → kullanıcının açık oturumu yeni yetkilerle anında çalışır; *Pasife Al* → oturum düşer.
3. Yeni kullanıcı oluşturun → ilk girişte kendi şifresini belirlemesi istenir.
4. Aynı kullanıcı adıyla 5 kez yanlış şifre → 5 dakika geçici kilit.

## 4. Savunmada öne çıkan noktalar

1. **Görevler ayrılığı ve bağımsız denetim:** kaydeden onaylayamaz; resmi deftere yalnızca mali müşavir işler.
2. **Belge düzeni ve değiştirilemezlik:** belgesiz gider deftere giremez; kesinleşen kayıt kilitlidir; tüm geçişler denetim izinde.
3. **Gerçek maliyetleme:** ağırlıklı ortalama maliyet, satışta donan porsiyon maliyeti, iptalde ters kayıt; tüm raporlar kayıtlı işlemlerden üretilir.
4. **Sunucu tarafı yetki:** her API ucu ve her WebSocket aboneliği rol politikasıyla denetlenir; rol değişikliği anında etkilidir.
5. **Test edilebilirlik:** 41 backend entegrasyon testi izole veritabanında; canlı ortam için duman testi.

## 5. Kapatma

```bash
docker compose down        # veriler pgdata hacminde korunur
docker compose down -v     # TÜM verileri siler (yalnızca demo)
```
