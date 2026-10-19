describe('service setup categories', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('shows only the selected category and keeps the choice in the URL', () => {
    cy.intercept('GET', '/api/v1/settings/readarr', []);
    cy.visit('/settings/services');

    cy.get('[data-settings-category="tv-movies"]')
      .should('be.visible')
      .and('contain', 'Radarr Settings');
    cy.get('[data-settings-category="audiobooks-books"]').should(
      'not.be.visible'
    );
    cy.get('[data-settings-category="music"]').should('not.be.visible');
    cy.get('[data-settings-category="tools-other"]').should('not.be.visible');

    cy.contains('button[aria-pressed="false"]', 'Music').click();
    cy.location('search').should('eq', '?serviceCategory=music');
    cy.get('[data-settings-category="music"]')
      .should('be.visible')
      .and('contain', 'Lidarr Settings')
      .and('contain', 'Navidrome Availability')
      .and('contain', 'Configure Spotify playlist access');
    cy.get('#slskdn-enabled').should('be.visible');
    cy.get('[data-settings-category="tv-movies"]').should('not.be.visible');

    cy.reload();
    cy.get('[data-settings-category="music"]').should('be.visible');

    cy.contains('button[aria-pressed="false"]', 'Audiobooks & Books').click();
    cy.location('search').should('eq', '?serviceCategory=audiobooks-books');
    cy.get('[data-settings-category="audiobooks-books"]')
      .should('be.visible')
      .and('contain', 'Bookshelf and Bindery Settings')
      .and('contain', 'Connect ChaptarrNG, BookshelfNG')
      .and('contain', 'No variable is needed on the SeerrNG container')
      .and('contain', 'Add ChaptarrNG Server')
      .and('contain', 'Reader Apps')
      .and('contain', 'Audiobookshelf Availability')
      .and('contain', 'Connect Audiobookshelf library');

    cy.contains('button', 'Add ChaptarrNG Server').click();
    cy.contains('[data-testid=modal-title]', 'Add ChaptarrNG Server').should(
      'exist'
    );
    cy.get('[role="dialog"]')
      .contains('CHAPTARR__AUTH__SEERRAPIKEY')
      .should('exist');
    cy.get('[data-testid=modal-cancel-button]').click();

    cy.contains('button[aria-pressed="false"]', 'System').click();
    cy.location('search').should('eq', '?serviceCategory=tools-other');
    cy.get('[data-settings-category="tools-other"]')
      .should('be.visible')
      .and('contain', 'Connect your apps');
    cy.get('#prowlarr').should('not.exist');
    cy.contains('section.app-card-sub', 'Live Download Progress').should(
      'be.visible'
    );
    cy.contains('section.app-card-sub', 'Swipe Discovery').should('be.visible');
    cy.get('[data-settings-category="audiobooks-books"]').should(
      'not.be.visible'
    );
  });

  it('opens Prowlarr from Settings search and preserves existing Prowlarr links', () => {
    cy.visit('/settings/services');
    cy.get('input[aria-label="Search Settings"]').type('Prowlarr{enter}');

    cy.location('pathname').should('eq', '/settings/prowlarr');
    cy.get('#prowlarr-settings-title').should('be.visible');
    cy.get('.settings-page-filter-nav nav a[href="/settings/prowlarr"]')
      .should('contain', 'Prowlarr')
      .next()
      .should('contain', 'Metadata Providers');

    cy.visit('/settings/services?settingsSearchTarget=prowlarr#prowlarr');
    cy.location('pathname').should('eq', '/settings/prowlarr');
    cy.get('#prowlarr-settings-title').should('be.visible');

    cy.visit('/settings/services#prowlarr');
    cy.location('pathname').should('eq', '/settings/prowlarr');
    cy.get('#prowlarr-settings-title').should('be.visible');

    cy.visit('/settings/services');
    cy.get('input[aria-label="Search Settings"]').type('Navidrome{enter}');
    cy.get('[data-settings-category="music"]').should('be.visible');
    cy.location('search').should('eq', '?serviceCategory=music');
    cy.get('[data-settings-category="tools-other"]').should('not.be.visible');
  });

  it('keeps the category chooser usable on a narrow screen', () => {
    cy.viewport(390, 640);
    cy.visit('/settings/services');

    cy.get('nav[aria-label="Service categories"] button').should(
      'have.length',
      4
    );
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.be.at.most(
        document.documentElement.clientWidth + 1
      );
    });

    cy.contains('button[aria-pressed="false"]', 'Audiobooks & Books').click();
    cy.get('[data-settings-category="audiobooks-books"]').should('be.visible');
    cy.document().then((document) => {
      expect(document.documentElement.scrollWidth).to.be.at.most(
        document.documentElement.clientWidth + 1
      );
    });
  });
});
