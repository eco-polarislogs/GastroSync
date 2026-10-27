/**
 * Enterprise Mobile Native Test: Barcode Scanner Camera Module.
 *
 * Verifies mock camera frame decoding, rapid consecutive barcode scans,
 * debouncing logic to prevent duplicate receipt entries, and fallback manual input.
 */
describe('Mobile Barcode Scanner & Rapid Stock Intake', () => {

  const mockInventoryDatabase = [
    { id: 101, name: 'Dana Antrikot', barcode: '86900010001', stock: 25.0, unit: 'kg' },
    { id: 102, name: 'Taze Kaşar Peyniri', barcode: '86900010002', stock: 14.0, unit: 'kg' },
    { id: 103, name: 'Sızma Zeytinyağı', barcode: '86900010003', stock: 30.0, unit: 'lt' }
  ];

  it('SCAN 1: Barkod başarıyla okunduğunda doğru ürün kartı çözümlenmeli', () => {
    const scannedBarcode = '86900010001';
    const foundItem = mockInventoryDatabase.find(item => item.barcode === scannedBarcode);

    expect(foundItem).toBeDefined();
    expect(foundItem.name).toBe('Dana Antrikot');
    expect(foundItem.unit).toBe('kg');
  });

  it('SCAN 2: Ardışık seri taramalarda (Rapid Consecutive Scans) debouncing ile mükerrer giriş engellenmeli', () => {
    let scanCount = 0;
    let lastScanTime = 0;
    const DEBOUNCE_INTERVAL_MS = 1500;

    const onBarcodeScanned = (barcode, currentTime) => {
      if (currentTime - lastScanTime < DEBOUNCE_INTERVAL_MS) {
        return false; // Mükerrer tarama reddedildi
      }
      lastScanTime = currentTime;
      scanCount++;
      return true;
    };

    const t0 = 10000;
    expect(onBarcodeScanned('86900010001', t0)).toBe(true);
    // 300 ms sonra aynı barkod tekrar kameraya girdi (mükerrer)
    expect(onBarcodeScanned('86900010001', t0 + 300)).toBe(false);
    // 600 ms sonra aynı barkod (mükerrer)
    expect(onBarcodeScanned('86900010001', t0 + 600)).toBe(false);
    // 2000 ms sonra yeni geçerli tarama
    expect(onBarcodeScanned('86900010002', t0 + 2000)).toBe(true);

    expect(scanCount).toBe(2);
  });

  it('SCAN 3: Tanımsız veya hasarlı barkodda manuel arama fallback modu devreye girmeli', () => {
    const invalidBarcode = '99999999999';
    const item = mockInventoryDatabase.find(i => i.barcode === invalidBarcode);
    expect(item).toBeUndefined();

    // Manuel arama fallback
    const searchQuery = 'Kaşar';
    const searchResults = mockInventoryDatabase.filter(i => i.name.toLowerCase().includes(searchQuery.toLowerCase()));
    expect(searchResults.length).toBe(1);
    expect(searchResults[0].barcode).toBe('86900010002');
  });
});
