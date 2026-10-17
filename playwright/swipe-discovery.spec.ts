import { expect, test, type Page } from '@playwright/test';

test.use({ serviceWorkers: 'block' });

const categories = [
  ['movie', 'Movies'],
  ['tv', 'Series'],
  ['book', 'Books'],
  ['audiobook', 'Audiobooks'],
  ['comic', 'Comics'],
  ['magazine', 'Magazines'],
  ['music', 'Music'],
  ['sports', 'Sports'],
  ['software-retro', 'Retro'],
  ['software-modern', 'Modern'],
  ['software-game', 'PC Games'],
  ['adult', 'Adult'],
] as const;

const loginAsAdmin = async (page: Page, baseURL: string | undefined) => {
  expect(baseURL).toBeTruthy();
  const response = await page
    .context()
    .request.post(`${baseURL}/api/v1/auth/local`, {
      data: { email: 'admin@seerr.dev', password: 'test1234' },
      headers: { 'X-Forwarded-Proto': 'https' },
    });
  expect(response.status()).toBe(200);
  const sessionCookie = response
    .headersArray()
    .find(
      (header) =>
        header.name.toLowerCase() === 'set-cookie' &&
        header.value.startsWith('connect.sid=')
    )
    ?.value.match(/^connect\.sid=([^;]+)/)?.[1];
  expect(sessionCookie).toBeTruthy();
  await page.context().addCookies([
    {
      name: 'connect.sid',
      value: sessionCookie!,
      url: baseURL!,
      httpOnly: true,
      secure: false,
      sameSite: 'Lax',
    },
  ]);
};

test('Swipe exposes every enabled category and uses its normal request path', async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL);
  const decisions = new Map<string, { id: string; decision: string }[]>();
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  const catalogRequests: string[] = [];

  await page.route('**/api/v1/swipe/status', (route) =>
    route.fulfill({
      json: {
        aiRanking: true,
        mediaTypes: categories.map(([mediaType]) => mediaType),
        bookFormats: ['ebook', 'audiobook'],
        softwareCatalogProvider: 'romarr',
      },
    })
  );
  await page.route('**/api/v1/swipe/profile', (route) =>
    route.fulfill({
      json: {
        tasteNotes: 'quiet mysteries',
        seriesRequest: 'first-season',
        bookFormat: 'ebook',
        seedScope: 'full',
        favoriteSeeds: [],
      },
    })
  );
  await page.route('**/api/v1/swipe/decisions*', async (route) => {
    const request = route.request();
    const mediaType =
      new URL(request.url()).searchParams.get('mediaType') ?? '';
    if (request.method() === 'GET') {
      return route.fulfill({
        json: { decisions: decisions.get(mediaType) ?? [] },
      });
    }
    const body = request.postDataJSON() as {
      mediaType: string;
      id: string;
      decision: string;
    };
    const items = decisions.get(body.mediaType) ?? [];
    decisions.set(body.mediaType, [
      { id: body.id, decision: body.decision },
      ...items.filter(({ id }) => id !== body.id),
    ]);
    return route.fulfill({
      json: { mediaType: body.mediaType, id: body.id, decision: body.decision },
    });
  });
  await page.route('**/api/v1/swipe/history*', (route) =>
    route.fulfill({ json: { decisions: [], hasMore: false } })
  );
  await page.route('**/api/v1/swipe/history/restore', (route) =>
    route.fulfill({ json: { restored: true } })
  );
  await page.route('**/api/v1/swipe/undo', (route) =>
    route.fulfill({ json: { card: {} } })
  );
  await page.route('**/api/v1/request', async (route) => {
    requests.push({
      path: '/api/v1/request',
      body: route.request().postDataJSON(),
    });
    return route.fulfill({ status: 201, json: { request: { id: 101 } } });
  });
  await page.route('**/api/v1/request/software', async (route) => {
    requests.push({
      path: '/api/v1/request/software',
      body: route.request().postDataJSON(),
    });
    return route.fulfill({ status: 201, json: { request: { id: 102 } } });
  });
  await page.route('**/api/v1/swipe/deck*', (route) => {
    const mediaType =
      new URL(route.request().url()).searchParams.get('mediaType') ?? 'movie';
    return route.fulfill({
      json: {
        mediaType,
        ranked:
          mediaType === 'movie' || mediaType === 'tv' || mediaType === 'book',
        remaining: 1,
        cards: [
          {
            mediaType,
            id:
              mediaType === 'movie'
                ? '601'
                : mediaType === 'tv'
                  ? '602'
                  : 'OL603W',
            title: `Swipe ${mediaType}`,
            authorId: mediaType === 'book' ? 'OL603A' : undefined,
            tags: ['drama'],
          },
        ],
      },
    });
  });
  await page.route('**/api/v1/discover/**', (route) => {
    const requestUrl = new URL(route.request().url());
    catalogRequests.push(requestUrl.pathname + requestUrl.search);
    if (requestUrl.pathname === '/api/v1/discover/books') {
      const isAudio = requestUrl.searchParams.get('format') === 'audiobook';
      return route.fulfill({
        json: {
          results: [
            {
              id: isAudio ? 'OL701W' : 'OL702W',
              title: isAudio ? 'Swipe audiobook' : 'Swipe magazine book',
              authorId: 'OL70A',
              requestable: true,
              ratingsAverage: 4.2,
            },
          ],
        },
      });
    }
    if (requestUrl.pathname === '/api/v1/discover/comics') {
      return route.fulfill({
        json: {
          results: [
            {
              id: '703',
              title: 'Swipe comic',
              publisher: 'Vertigo',
              startYear: 2012,
            },
          ],
        },
      });
    }
    if (requestUrl.pathname === '/api/v1/discover/magazines') {
      return route.fulfill({
        json: {
          results: [
            {
              id: 'Swipe magazine',
              title: 'Swipe magazine',
              serviceId: 4,
              requestable: true,
            },
          ],
        },
      });
    }
    if (requestUrl.pathname === '/api/v1/discover/music') {
      return route.fulfill({
        json: {
          results: [
            {
              id: '11111111-1111-4111-8111-111111111111',
              title: 'Swipe music',
              'artist-credit': [{ name: 'Swipe artist' }],
            },
          ],
        },
      });
    }
    if (requestUrl.pathname === '/api/v1/discover/sports') {
      return route.fulfill({
        json: {
          results: [
            {
              id: 'sportarr:league-1',
              title: 'Swipe sports league',
              requestable: true,
              libraryState: 'not-added',
            },
          ],
        },
      });
    }
    return route.fulfill({ json: { results: [] } });
  });
  await page.route('**/api/v1/adult/search*', (route) => {
    const requestUrl = new URL(route.request().url());
    catalogRequests.push(requestUrl.pathname + requestUrl.search);
    return route.fulfill({
      json: {
        results: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            title: 'Swipe adult scene',
            serviceId: 6,
            performers: ['Swipe performer'],
            posterPath: '/api/v1/adult/scene/cover',
          },
        ],
      },
    });
  });
  await page.route('**/api/v1/request/software/catalog/popular*', (route) => {
    const category = new URL(route.request().url()).searchParams.get(
      'category'
    );
    const title =
      category === 'game' ? 'Swipe PC game' : `Swipe ${category} title`;
    return route.fulfill({
      json: {
        results: [
          {
            id: 'igdb-704',
            catalogId: '704',
            igdbId: 704,
            catalogProvider: 'igdb',
            title,
            ...(category === 'game'
              ? { platformOptions: [{ id: 6, name: 'PC (Microsoft Windows)' }] }
              : {
                  emulationSystems: [
                    {
                      slug: 'nes',
                      name: 'Nintendo Entertainment System',
                      group: category,
                    },
                  ],
                }),
          },
        ],
      },
    });
  });
  await page.route('**/api/v1/request/software/catalog/search*', (route) => {
    const requestUrl = new URL(route.request().url());
    catalogRequests.push(requestUrl.pathname + requestUrl.search);
    return route.fulfill({
      json: {
        results: [
          {
            id: 'igdb-704',
            catalogId: '704',
            igdbId: 704,
            catalogProvider: 'igdb',
            title: 'Swipe retro search result',
            emulationSystems: [
              {
                slug: 'nes',
                name: 'Nintendo Entertainment System',
                group: 'retro',
              },
            ],
          },
        ],
        nextCursor: 'retro-search-next',
      },
    });
  });

  await page.goto('/swipe');
  await expect(page.getByTestId('swipe-media-rail')).toBeVisible();
  for (const [mediaType] of categories) {
    await page.getByTestId(`swipe-category-${mediaType}`).click();
    await expect(
      page.locator('.swipe-card[data-stack-position="0"]')
    ).toBeVisible();
    await expect(
      page.locator('.swipe-card[data-stack-position="0"] .card-title')
    ).not.toBeEmpty();
  }

  await page.getByTestId('swipe-category-comic').click();
  await page.getByTestId('swipe-open-filters').click();
  await page.getByLabel('Publisher').fill('Vertigo');
  const filteredComicRequest = page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/discover/comics') &&
      new URL(request.url()).searchParams.get('publisher') === 'Vertigo'
  );
  await page.getByRole('button', { name: 'Apply filters' }).click();
  await filteredComicRequest;
  const refreshedComicRequest = page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/discover/comics') &&
      new URL(request.url()).searchParams.get('publisher') === 'Vertigo'
  );
  await page.getByTestId('swipe-refresh').click();
  await refreshedComicRequest;
  await page.getByTestId('swipe-open-history').click();
  await expect(page.getByRole('dialog')).toContainText('Review past decisions');
  await page.getByRole('button', { name: 'Close' }).last().click();

  await page.getByTestId('swipe-category-adult').click();
  await expect(
    page.getByText(/Adult discovery stays within your Whisparr catalog/)
  ).toBeVisible();
  await expect(page.getByText('Ordered for you by AI')).toHaveCount(0);
  await page
    .getByRole('searchbox', {
      name: 'Search titles, creators, descriptions, or genres',
    })
    .fill('performer');
  const adultSearchRequest = page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/adult/search') &&
      new URL(request.url()).searchParams.get('query') === 'performer'
  );
  await page
    .getByRole('button', {
      name: 'Search titles, creators, descriptions, or genres',
    })
    .click();
  await adultSearchRequest;
  await expect(
    page.locator('.swipe-card[data-stack-position="0"] .card-title')
  ).toHaveText('Swipe adult scene');

  await page.getByTestId('swipe-category-music').click();
  await expect(
    page.locator('.swipe-card[data-stack-position="0"] .card-title')
  ).toHaveText('Swipe music');
  await page.getByTestId('swipe-request').click();
  await expect
    .poll(() => requests.some(({ body }) => body.mediaType === 'music'))
    .toBe(true);
  expect(requests.find(({ body }) => body.mediaType === 'music')?.path).toBe(
    '/api/v1/request'
  );

  await page.getByTestId('swipe-category-software-retro').click();
  await page
    .getByRole('searchbox', {
      name: 'Search titles, creators, descriptions, or genres',
    })
    .fill('retro');
  const softwareSearchRequest = page.waitForRequest(
    (request) =>
      request.url().includes('/api/v1/request/software/catalog/search') &&
      new URL(request.url()).searchParams.get('q') === 'retro'
  );
  await page
    .getByRole('button', {
      name: 'Search titles, creators, descriptions, or genres',
    })
    .click();
  await softwareSearchRequest;
  await expect(
    page.locator('.swipe-card[data-stack-position="0"] .card-title')
  ).toHaveText('Swipe retro search result');
  await page.getByTestId('swipe-request').click();
  await page.getByLabel('System').selectOption('nes');
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'Request' })
    .click();
  await expect
    .poll(() =>
      requests.some(({ path }) => path === '/api/v1/request/software')
    )
    .toBe(true);
  expect(
    requests.find(({ path }) => path === '/api/v1/request/software')?.body
  ).toMatchObject({
    category: 'retro',
    catalogId: 704,
    platformSlug: 'nes',
  });

  expect(
    catalogRequests.some(
      (url) =>
        url.includes('/discover/books?') && url.includes('format=audiobook')
    )
  ).toBe(true);
  expect(
    catalogRequests.some((url) => url.includes('/discover/magazines?'))
  ).toBe(true);
});

test('Adult-only access opens directly into the private Adult deck', async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL);
  await page.route('**/api/v1/swipe/status', (route) =>
    route.fulfill({
      json: {
        aiRanking: true,
        mediaTypes: ['adult'],
        bookFormats: [],
        softwareCatalogProvider: 'romarr',
      },
    })
  );
  await page.route('**/api/v1/swipe/profile', (route) =>
    route.fulfill({
      json: {
        tasteNotes: 'private preference',
        seriesRequest: 'first-season',
        bookFormat: 'ebook',
        seedScope: 'full',
        favoriteSeeds: [],
      },
    })
  );
  await page.route('**/api/v1/swipe/decisions*', (route) =>
    route.fulfill({ json: { decisions: [] } })
  );
  await page.route('**/api/v1/adult/search*', (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
            title: 'Private adult pick',
            serviceId: 6,
            performers: ['Private performer'],
          },
        ],
      },
    })
  );

  await page.goto('/swipe');
  const adultTab = page.getByTestId('swipe-category-adult');
  await expect(adultTab).toBeVisible();
  await expect(adultTab).toHaveAttribute('aria-selected', 'true');
  await expect(page.locator('.swipe-card .card-title')).toHaveText(
    'Private adult pick'
  );
  await expect(page.getByText('Ordered for you by AI')).toHaveCount(0);
  await expect(page.getByTestId('swipe-category-movie')).toHaveCount(0);
});

test('DAT-backed software hides filters the catalog cannot serve', async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL);
  await page.route('**/api/v1/swipe/status', (route) =>
    route.fulfill({
      json: {
        aiRanking: false,
        mediaTypes: ['software-retro'],
        bookFormats: [],
        softwareCatalogProvider: 'romarr-dat',
      },
    })
  );
  await page.route('**/api/v1/swipe/profile', (route) =>
    route.fulfill({
      json: {
        tasteNotes: '',
        seriesRequest: 'first-season',
        bookFormat: 'ebook',
        seedScope: 'full',
        favoriteSeeds: [],
      },
    })
  );
  await page.route('**/api/v1/swipe/decisions*', (route) =>
    route.fulfill({ json: { decisions: [] } })
  );
  await page.route('**/api/v1/request/software/catalog/popular*', (route) =>
    route.fulfill({
      json: {
        results: [
          {
            id: `dat-${'a'.repeat(64)}`,
            catalogId: `dat-${'a'.repeat(64)}`,
            catalogProvider: 'dat',
            title: 'DAT catalog title',
            emulationSystems: [
              {
                slug: 'nes',
                name: 'Nintendo Entertainment System',
                group: 'retro',
              },
            ],
          },
        ],
        nextOffset: null,
      },
    })
  );

  await page.goto('/swipe?mediaType=software-retro');
  await expect(
    page.locator('.swipe-card[data-stack-position="0"] .card-title')
  ).toHaveText('DAT catalog title');
  await page.getByTestId('swipe-open-filters').click();
  const filterDialog = page.getByRole('dialog');
  await expect(filterDialog.getByLabel('From year')).toBeVisible();
  await expect(filterDialog.getByLabel('Genre or subject')).toHaveCount(0);
  await expect(filterDialog.getByLabel('Minimum rating')).toHaveCount(0);
});

test('Swipe controls support keyboard actions, undo, and pointer gestures', async ({
  page,
  baseURL,
}) => {
  await loginAsAdmin(page, baseURL);
  const cards = [
    { mediaType: 'movie', id: '601', title: 'Swipe action one', tags: [] },
    { mediaType: 'movie', id: '602', title: 'Swipe action two', tags: [] },
    { mediaType: 'movie', id: '603', title: 'Swipe action three', tags: [] },
  ];
  const decisions: { id: string; decision: string }[] = [];
  const requests: Record<string, unknown>[] = [];
  await page.route('**/api/v1/swipe/status', (route) =>
    route.fulfill({
      json: {
        aiRanking: false,
        mediaTypes: ['movie'],
        bookFormats: ['ebook'],
        softwareCatalogProvider: 'romarr',
      },
    })
  );
  await page.route('**/api/v1/swipe/profile', (route) =>
    route.fulfill({
      json: {
        tasteNotes: '',
        seriesRequest: 'first-season',
        bookFormat: 'ebook',
        seedScope: 'full',
        favoriteSeeds: [],
      },
    })
  );
  await page.route('**/api/v1/swipe/decisions*', async (route) => {
    if (route.request().method() === 'GET') {
      return route.fulfill({ json: { decisions } });
    }
    const body = route.request().postDataJSON() as {
      id: string;
      decision: string;
    };
    decisions.unshift(body);
    return route.fulfill({ json: body });
  });
  await page.route('**/api/v1/swipe/history*', async (route) => {
    if (route.request().method() === 'DELETE') {
      const retained = decisions.filter(({ decision }) => decision === 'want');
      const cleared = decisions.length - retained.length;
      decisions.splice(0, decisions.length, ...retained);
      return route.fulfill({ json: { cleared } });
    }
    return route.fulfill({
      json: {
        decisions: decisions.map((item) => ({
          ...item,
          mediaType: 'movie',
          title: cards.find(({ id }) => id === item.id)?.title ?? item.id,
          createdAt: '2026-10-17T12:00:00.000Z',
          card: cards.find(({ id }) => id === item.id),
        })),
        hasMore: false,
      },
    });
  });
  await page.route('**/api/v1/swipe/history/restore', async (route) => {
    const { id } = route.request().postDataJSON() as { id: string };
    const index = decisions.findIndex((decision) => decision.id === id);
    if (index >= 0) decisions.splice(index, 1);
    return route.fulfill({ json: { restored: index >= 0 } });
  });
  await page.route('**/api/v1/swipe/deck*', (route) =>
    route.fulfill({
      json: {
        mediaType: 'movie',
        ranked: false,
        remaining: cards.length,
        cards,
      },
    })
  );
  await page.route('**/api/v1/swipe/undo', async (route) => {
    const undone = decisions.shift();
    const card = cards.find(({ id }) => id === undone?.id);
    return route.fulfill({ json: { card } });
  });
  await page.route('**/api/v1/request', async (route) => {
    requests.push(route.request().postDataJSON());
    return route.fulfill({ status: 201, json: { request: { id: 103 } } });
  });

  await page.goto('/swipe');
  const topTitle = page.locator(
    '.swipe-card[data-stack-position="0"] .card-title'
  );
  await expect(topTitle).toHaveText('Swipe action one');

  await page.keyboard.press('ArrowLeft');
  await expect(topTitle).toHaveText('Swipe action two');
  await expect.poll(() => decisions[0]?.decision).toBe('pass');
  await expect(page.getByTestId('swipe-undo')).toBeEnabled();
  await page.getByTestId('swipe-undo').click();
  await expect(topTitle).toHaveText('Swipe action one');
  await expect.poll(() => decisions.length).toBe(0);

  await page.keyboard.press('ArrowUp');
  await expect(topTitle).toHaveText('Swipe action two');
  await expect.poll(() => decisions[0]?.decision).toBe('seen');

  await page.getByTestId('swipe-open-history').click();
  const historyDialog = page.getByRole('dialog');
  await expect(historyDialog).toContainText('Swipe action one');
  await historyDialog.getByRole('button', { name: 'Bring back' }).click();
  await expect.poll(() => decisions.length).toBe(0);
  await historyDialog.getByRole('button', { name: 'Close' }).last().click();
  await expect(historyDialog).toBeHidden();
  await expect(topTitle).toHaveText('Swipe action one');

  const card = page.locator('.swipe-card[data-stack-position="0"]');
  const bounds = await card.boundingBox();
  expect(bounds).toBeTruthy();
  await page.mouse.move(bounds!.x + bounds!.width / 2, bounds!.y + 90);
  await page.mouse.down();
  await page.mouse.move(bounds!.x + bounds!.width / 2 - 160, bounds!.y + 90, {
    steps: 6,
  });
  await page.mouse.up();
  await expect(topTitle).toHaveText('Swipe action two');
  await expect.poll(() => decisions[0]?.decision).toBe('pass');

  await page.keyboard.press('ArrowRight');
  await expect.poll(() => requests.length).toBe(1);
  expect(requests[0]).toEqual({ mediaType: 'movie', mediaId: 602 });
  await expect.poll(() => decisions[0]?.decision).toBe('want');

  await page.getByTestId('swipe-open-history').click();
  await expect(historyDialog).toContainText('Swipe action two');
  const clearHistoryButton = historyDialog.getByRole('button', {
    name: 'Clear passes and seen',
  });
  await expect(clearHistoryButton).toBeVisible();
  await clearHistoryButton.click();
  await expect.poll(() => decisions.length).toBe(1);
  await expect(historyDialog.getByText('Swipe action one')).toHaveCount(0);
  await expect(historyDialog).toContainText('Swipe action two');
});
