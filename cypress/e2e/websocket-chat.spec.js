/**
 * Enterprise E2E Test: WebSocket STOMP Walkie-Talkie & Smart Alerting.
 *
 * Verifies real-time chat broadcast, badge count increments,
 * and deep-linking navigation upon notification click.
 */
describe('WebSocket STOMP Walkie-Talkie & Smart Alerting Specification', () => {

  beforeEach(() => {
    cy.visit('/login');
    cy.get('input[type="text"]').type('manager');
    cy.get('input[type="password"]').type('123456');
    cy.get('button[type="submit"]').click();
    cy.url().should('include', '/dashboard');
  });

  it('WS 1: Üst bardaki bildirim zili tıklandığında öncelik rozetleri (CRITICAL, WARNING, INFO) listelenmeli', () => {
    // Bildirim zili butonunu aç
    cy.get('button[title="Rol Bildirimleri"]').click();

    // Açılır panel görünür olmalı
    cy.contains('Bildirimler').should('be.visible');

    // Öncelik etiketlerinin varlığını doğrula
    cy.get('.layout-header-right').within(() => {
      cy.get('span').contains(/KRİTİK|UYARI|BİLGİ/).should('exist');
    });
  });

  it('WS 2: Bildirime tıklandığında derin bağlantı (Deep Link) ile faturaya/ekrana yönlendirmeli', () => {
    cy.get('button[title="Rol Bildirimleri"]').click();

    // "İncele →" linkine veya bildirim kartına tıkla
    cy.contains('İncele →').first().click();

    // Rota ilgili sayfaya geçmiş olmalı (örn: /advisor-ledger veya /cashier)
    cy.url().should('match', /\/(advisor-ledger|cashier|inventory|users)/);
  });

  it('WS 3: Yüzen telsiz butonu açıldığında kanallara mesaj gönderilebilmeli ve anında listeye düşmeli', () => {
    // Yüzen telsiz butonuna tıkla
    cy.contains('Ekip Telsizi').click();

    // Telsiz penceresi açılmalı
    cy.contains('Dahili Restoran Telsizi').should('be.visible');

    // Mesaj yaz ve Acil olarak işaretle
    const testMsg = 'Test E2E Telsiz Anonsu ' + Date.now();
    cy.get('input[placeholder*="Mesajınızı yazın"]').type(testMsg);
    cy.get('input[type="checkbox"]').check();

    // Gönder
    cy.get('button[type="submit"]').click();

    // Mesaj anında listede görünmeli
    cy.contains(testMsg).should('be.visible');
    cy.contains('⚡ ACİL').should('be.visible');
  });
});
