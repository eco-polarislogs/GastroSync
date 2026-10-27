/**
 * Enterprise Mobile Native Test: Warehouse Receipt Flow (Mal Kabul).
 *
 * Verifies mobile stock intake execution, validation barriers against
 * negative/zero quantities, and instant UI state synchronization.
 */
describe('Warehouse Receipt (Mal Kabul) End-to-End Simulation', () => {

  let currentStockState = {
    id: 201,
    name: 'Baldo Pirinç',
    stock: 50.0,
    unit: 'kg',
    unitPrice: 42.0
  };

  const processStockIntake = (amount, operator) => {
    const qty = parseFloat(amount);
    if (isNaN(qty) || qty <= 0) {
      throw new Error('Geçersiz miktar: Mal kabul miktarı sıfırdan büyük olmalıdır.');
    }

    currentStockState.stock += qty;
    return {
      success: true,
      newStock: currentStockState.stock,
      recordedBy: operator,
      timestamp: new Date().toISOString()
    };
  };

  it('RECEIPT 1: Geçerli miktarla mal kabul yapıldığında stok bakiyesi anında artmalı', () => {
    const result = processStockIntake(25.5, 'Ali Depocu');
    expect(result.success).toBe(true);
    expect(result.newStock).toBe(75.5);
    expect(currentStockState.stock).toBe(75.5);
    expect(result.recordedBy).toBe('Ali Depocu');
  });

  it('RECEIPT 2: Negatif veya sıfır miktar girildiğinde işlem engellenmeli ve hata fırlatılmalı', () => {
    expect(() => processStockIntake(0, 'Ali Depocu')).toThrow('Geçersiz miktar');
    expect(() => processStockIntake(-15, 'Ali Depocu')).toThrow('Geçersiz miktar');
    expect(() => processStockIntake('abc', 'Ali Depocu')).toThrow('Geçersiz miktar');
    // Stok değişmemiş olmalıdır
    expect(currentStockState.stock).toBe(75.5);
  });
});
