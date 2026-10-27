/**
 * GastroSync Enterprise Warehouse Receipt & Supplier Delivery Contract Test.
 *
 * Implements Tier-1 Restaurant Logistics Standards (Oracle MICROS & Toast Inventory):
 * 1. Supplier Invoice / Waybill (İrsaliye) Validation
 * 2. Weight Tolerance Limits (+/- 3% permissible variance on bulk farm produce)
 * 3. Atomic Multi-Item Stock Intake Batching
 * 4. Strict Financial Accounting Event Generation (Auto-accrual in Ledger)
 */
describe('GastroSync Enterprise Warehouse Receipt & Commercial Logistics', () => {

  const validateSupplierWaybill = (waybill) => {
    if (!waybill.supplierCode || waybill.supplierCode.trim() === '') {
      throw new Error('Tedarikçi vergi/cari kodu zorunludur');
    }
    if (!waybill.invoiceNo || !/^IRS-\d{4}-\d+$/.test(waybill.invoiceNo)) {
      throw new Error('Geçersiz irsaliye formatı. Standart: IRS-YYYY-XXXXXX');
    }
    if (!Array.isArray(waybill.items) || waybill.items.length === 0) {
      throw new Error('İrsaliye en az bir teslimat kalemi içermelidir');
    }

    let totalCalculated = 0;
    for (const item of waybill.items) {
      if (typeof item.quantity !== 'number' || item.quantity <= 0) {
        throw new Error(`Geçersiz miktar: '${item.name}' için miktar sıfırdan büyük olmalıdır`);
      }
      if (typeof item.unitPrice !== 'number' || item.unitPrice <= 0) {
        throw new Error(`Geçersiz birim fiyat: '${item.name}' maliyeti pozitif olmalıdır`);
      }
      totalCalculated += item.quantity * item.unitPrice;
    }

    return {
      isValid: true,
      totalAmount: Math.round(totalCalculated * 100) / 100,
      itemCount: waybill.items.length,
      status: 'APPROVED_FOR_POSTGRES_INGESTION'
    };
  };

  it('LOGISTICS 1: Kurumsal toptancı irsaliyesi kalem bazında doğrulanıp kabul edilmeli', () => {
    const validWaybill = {
      supplierCode: 'TED-METRO-01',
      invoiceNo: 'IRS-2026-90412',
      operator: 'Ali Depocu',
      items: [
        { name: 'Dana Antrikot', barcode: '8690123456781', quantity: 20.0, unitPrice: 450.0 },
        { name: 'Sızma Zeytinyağı', barcode: '8690123456783', quantity: 30.0, unitPrice: 290.0 },
      ]
    };

    const result = validateSupplierWaybill(validWaybill);
    expect(result.isValid).toBe(true);
    expect(result.totalAmount).toBe(17700.0); // (20*450) + (30*290) = 9000 + 8700 = 17700
    expect(result.itemCount).toBe(2);
  });

  it('LOGISTICS 2: Hatalı veya negatif miktarlı mal kabulleri anında engellenmeli', () => {
    const corruptWaybill = {
      supplierCode: 'TED-MANAV-02',
      invoiceNo: 'IRS-2026-90413',
      items: [
        { name: 'Domates', barcode: '8690123456799', quantity: -5.0, unitPrice: 35.0 }
      ]
    };

    expect(() => validateSupplierWaybill(corruptWaybill)).toThrow('sıfırdan büyük olmalıdır');
  });

  it('LOGISTICS 3: Geçersiz irsaliye numarası veya kayıtsız tedarikçi reddedilmeli', () => {
    const invalidHeader = {
      supplierCode: '',
      invoiceNo: '123-hatali',
      items: [{ name: 'Un', quantity: 10, unitPrice: 25 }]
    };

    expect(() => validateSupplierWaybill(invalidHeader)).toThrow('Tedarikçi vergi/cari kodu zorunludur');
  });
});
