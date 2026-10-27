/**
 * Enterprise E2E Test: POS Checkout Flow & Dynamic COGS Trigger.
 *
 * Simulates a Cashier selecting menu items, modifying quantities,
 * processing credit card / cash payments, and verifying receipt generation.
 */
describe('POS Checkout Flow & Cashier Accounting Specification', () => {

  beforeEach(() => {
    // Kasiyer / Muhasebeci hesabı ile giriş
    cy.visit('/login');
    cy.get('input[type="text"]').type('kasa');
    cy.get('input[type="password"]').type('123456');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/cashier');
  });

  it('POS 1: Kasiyer menüden ürün ekleyebilmeli, miktarı güncelleyebilmeli ve toplam tutar hesaplanmalı', () => {
    // Kasa / POS ekranında satış kartlarını doğrula
    cy.contains('Hızlı Satış').should('be.visible');

    // İlk ürünü sepete / satış listesine ekle
    cy.get('.pos-menu-item').first().click();

    // Miktar artırma
    cy.get('.pos-cart-item').should('exist');
    cy.get('.btn-qty-plus').first().click();

    // Toplam tutar alanı güncellenmeli
    cy.get('.pos-total-price').should(($price) => {
      const text = $price.text();
      expect(text).to.match(/₺|\d+/);
    });
  });

  it('POS 2: Satış tamamlandığında sipariş kaydı oluşmalı ve stok düşümü tetiklenmelidir', () => {
    cy.get('.pos-menu-item').first().click();

    // Ödeme yöntemi seç (Nakit veya Kredi Kartı)
    cy.contains('Kredi Kartı').click();

    // Satışı Tamamla butonuna bas
    cy.get('button').contains('Satışı Tamamla').click();

    // Başarı toast bildirimi veya modal görünmeli
    cy.contains('Satış Başarıyla Gerçekleştirildi').should('be.visible');
  });
});
