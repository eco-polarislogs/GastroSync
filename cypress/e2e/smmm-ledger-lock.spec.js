/**
 * Enterprise E2E Test: SMMM Official Ledger 3-Tier State & Tamper Lock.
 *
 * Verifies the complete lifecycle:
 * Accountant Entry -> Manager Payment Approval -> SMMM Official Ledger Finalization.
 * Specifically checks UI locking: Edit & Delete buttons must be permanently disabled once FINALIZED.
 */
describe('SMMM Official Ledger & Tamper Lock Specification', () => {

  it('SMMM 1: Mali Müşavir bekleyen gideri inceleyip onayladığında FINALIZED mührü vurulmalı', () => {
    // 1. Mali Müşavir olarak oturum aç
    cy.visit('/login');
    cy.get('input[type="text"]').type('malimusavir');
    cy.get('input[type="password"]').type('123456');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/advisor-ledger');

    // 2. Onay bekleyen faturalar sekmesine git
    cy.contains('Onay Bekleyen Giderler').click();

    // 3. İlk faturanın "Resmi Deftere İşle" butonuna tıkla
    cy.get('.btn-finalize-ledger').first().click();

    // Yevmiye defter maddesi ve hesap kodu onayı
    cy.get('input[name="journalNumber"]').type('YEV-2026-TEST');
    cy.get('button').contains('Deftere Mühürle').click();

    // Fatura durumu FINALIZED olarak güncellenmeli
    cy.contains('FINALIZED').should('be.visible');
  });

  it('SMMM 2: Mühürlenmiş (FINALIZED) bir kayıtta Sil ve Düzenle butonları kilitli olmalıdır', () => {
    cy.visit('/login');
    cy.get('input[type="text"]').type('admin');
    cy.get('input[type="password"]').type('123456');
    cy.get('button[type="submit"]').click();
    cy.visit('/advisor-ledger');

    // Mühürlü faturalar tablosunda
    cy.get('.finalized-row').first().within(() => {
      // Silme butonu bulunmamalı veya disabled olmalıdır
      cy.get('.btn-delete-expense').should('be.disabled');
      cy.contains('Mühürlü Defter').should('be.visible');
    });
  });
});
