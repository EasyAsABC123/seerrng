const supportedBindery = {
  backend: 'bindery' as const,
  system: { version: '1.4.2', commit: 'fixture', buildDate: '2026-10-01' },
  features: { requestsForUser: true },
  requesterAccounts: 3,
};

const legacyBindery = {
  backend: 'bindery' as const,
  system: { version: '1.2.0', commit: 'fixture', buildDate: '2026-04-01' },
  features: { requestsForUser: false },
  requesterAccounts: 0,
};

describe('Bindery service setup', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
    cy.viewport(1280, 900);
    cy.intercept('GET', '/api/v1/settings/readarr', []).as('bookServices');
  });

  const openAddBindery = () => {
    cy.visit('/settings/services?serviceCategory=audiobooks-books');
    cy.wait('@bookServices');
    cy.location('search').should('eq', '?serviceCategory=audiobooks-books');
    cy.contains('button', 'Add Bindery Server').should('be.visible').click();
    cy.get('[role="dialog"]').should('be.visible');
    cy.contains('[data-testid="modal-title"]', 'Add Bindery server').should(
      'be.visible'
    );
  };

  it('probes requester support, explains ownership, and saves the selected format', () => {
    cy.intercept('POST', '/api/v1/settings/readarr/test', {
      statusCode: 200,
      body: supportedBindery,
    }).as('testBindery');
    cy.intercept('POST', '/api/v1/settings/readarr', {
      statusCode: 201,
      body: { id: 3 },
    }).as('saveBindery');

    openAddBindery();

    cy.get('[role="dialog"] #port').should('have.value', '8787');
    cy.get('[role="dialog"] #serviceType option').should('have.length', 3);
    cy.get('[role="dialog"] #serviceType')
      .should('have.value', 'both')
      .select('audiobook');
    cy.get('[role="dialog"]')
      .contains('button', 'Add Bindery')
      .should('be.disabled');

    cy.get('[role="dialog"] #hostname')
      .type('bindery.example.test')
      .should('have.value', 'bindery.example.test');
    cy.get('[role="dialog"] #apiKey')
      .type('fixture-bindery-key')
      .should('have.value', 'fixture-bindery-key');
    cy.get('[role="dialog"]').contains('button', 'Test connection').click();
    cy.wait('@testBindery').then(({ request }) => {
      expect(request.body).to.include({
        backend: 'bindery',
        hostname: 'bindery.example.test',
        port: 8787,
        apiKey: 'fixture-bindery-key',
        serviceType: 'audiobook',
      });
    });

    cy.get('[role="dialog"]')
      .contains('Bindery version')
      .parent()
      .should('contain.text', '1.4.2');
    cy.get('[role="dialog"]').should(
      'contain.text',
      'Per-user requests are supported'
    );
    cy.get('[role="dialog"]').should('contain.text', 'BINDERY_ENFORCE_TENANCY');
    cy.get('[role="dialog"]')
      .contains('button', 'Add Bindery')
      .should('be.enabled')
      .click();

    cy.wait('@saveBindery').then(({ request }) => {
      expect(request.body).to.include({
        backend: 'bindery',
        name: 'Bindery',
        hostname: 'bindery.example.test',
        port: 8787,
        apiKey: 'fixture-bindery-key',
        serviceType: 'audiobook',
        isDefault: false,
        syncEnabled: true,
      });
    });
    cy.get('[data-testid="modal-title"]').should('not.exist');
  });

  it('explains when an older Bindery version records requests under the service account', () => {
    cy.intercept('POST', '/api/v1/settings/readarr/test', {
      statusCode: 200,
      body: legacyBindery,
    }).as('testLegacyBindery');

    openAddBindery();
    cy.get('[role="dialog"] #hostname')
      .type('legacy-bindery.example.test')
      .should('have.value', 'legacy-bindery.example.test');
    cy.get('[role="dialog"] #apiKey')
      .type('fixture-bindery-key')
      .should('have.value', 'fixture-bindery-key');
    cy.get('[role="dialog"]').contains('button', 'Test connection').click();
    cy.wait('@testLegacyBindery').then(({ request }) => {
      expect(request.body).to.include({ backend: 'bindery' });
    });

    cy.get('[role="dialog"]').should(
      'contain.text',
      'This Bindery version does not advertise per-user requests'
    );
    cy.get('[role="dialog"]')
      .contains('button', 'Add Bindery')
      .should('be.enabled');
  });
});
