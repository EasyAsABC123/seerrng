describe('service setup categories', () => {
  beforeEach(() => {
    cy.loginAsAdmin();
  });

  it('shows only the selected category and keeps the choice in the URL', () => {
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
      .and('contain', 'Bookshelf Settings')
      .and('contain', 'Reader Apps')
      .and('contain', 'Audiobookshelf Availability')
      .and('contain', 'Connect Audiobookshelf library');

    cy.contains('button[aria-pressed="false"]', 'Tools & Other').click();
    cy.location('search').should('eq', '?serviceCategory=tools-other');
    cy.get('[data-settings-category="tools-other"]')
      .should('be.visible')
      .and('contain', 'Connect your apps');
    cy.get('#prowlarr').should('be.visible');
    cy.get('[data-settings-category="audiobooks-books"]').should(
      'not.be.visible'
    );
  });

  it('opens a hidden category for Settings search results and deep links', () => {
    cy.visit('/settings/services');
    cy.get('input[aria-label="Search Settings"]').type('Prowlarr{enter}');

    cy.get('[data-settings-category="tools-other"]').should('be.visible');
    cy.location('search').should('contain', 'serviceCategory=tools-other');
    cy.get('#prowlarr').should('be.visible');

    cy.visit('/settings/services?settingsSearchTarget=prowlarr#prowlarr');
    cy.get('[data-settings-category="tools-other"]').should('be.visible');
    cy.get('#prowlarr').should('be.visible');

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
