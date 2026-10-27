/**
 * Enterprise E2E Test: Admin RBAC & Route Protection Guard.
 *
 * Verifies URL-level route guarding, unauthorized access eviction,
 * and role-based UI component visibility.
 */
describe('Admin RBAC & Route Guarding Specification', () => {

  it('RBAC 1: Şef kullanıcısı /users (Kullanıcı Yönetimi) ekranına girmeye çalıştığında engellenmeli', () => {
    // 1. Şef olarak giriş yap
    cy.visit('/login');
    cy.get('input[type="text"]').type('sef');
    cy.get('input[type="password"]').type('123456');
    cy.get('button[type="submit"]').click();

    // 2. URL doğrula (Şef /recipes veya /inventory ekranına gitmeli)
    cy.url().should('not.include', '/login');

    // 3. Yetkisiz rotaya doğrudan erişim teşebbüsü
    cy.visit('/users', { failOnStatusCode: false });

    // 4. Sistem yetkisiz erişimi yakalamalı ve /unauthorized sayfasına atmalıdır
    cy.url().should('include', '/unauthorized');
    cy.contains('Yetkisiz Erişim Teşebbüsü').should('be.visible');
  });

  it('RBAC 2: Şef menüsünde Mali Müşavir Defteri veya Kullanıcılar sekmesi görünmemelidir', () => {
    cy.visit('/login');
    cy.get('input[type="text"]').type('chef');
    cy.get('input[type="password"]').type('123456');
    cy.get('button[type="submit"]').click();

    // Sol menüde sadece izinli rotalar olmalıdır
    cy.get('.sidebar-nav').within(() => {
      cy.contains('Müşavir Defteri').should('not.exist');
      cy.contains('Kullanıcı Yönetimi').should('not.exist');
      cy.contains('Reçeteler').should('be.visible');
    });
  });

  it('RBAC 3: Super Admin kullanıcısı tüm modüllere eksiksiz erişebilmelidir', () => {
    cy.visit('/login');
    cy.get('input[type="text"]').type('admin');
    cy.get('input[type="password"]').type('123456');
    cy.get('button[type="submit"]').click();

    cy.get('.sidebar-nav').within(() => {
      cy.contains('Kullanıcı Yönetimi').should('be.visible');
      cy.contains('Müşavir Defteri').should('be.visible');
      cy.contains('Kasa & Muhasebe').should('be.visible');
      cy.contains('Reçeteler').should('be.visible');
      cy.contains('Depo Yönetimi').should('be.visible');
    });
  });
});
