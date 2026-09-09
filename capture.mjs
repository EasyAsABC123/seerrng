import assert from 'node:assert/strict';
import http from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
const require = createRequire('/tmp/seerrng-tools/package.json');
const { chromium } = require('playwright');
const repoRequire = createRequire('/tmp/seerrng-artwork-reuse/package.json');
const sharp = repoRequire('sharp');
if (!process.env.EVIDENCE_EMAIL || !process.env.EVIDENCE_PASSWORD || !process.env.EVIDENCE_COMMIT) throw new Error('Set EVIDENCE_EMAIL, EVIDENCE_PASSWORD, and EVIDENCE_COMMIT for the isolated test app.');
const ORIGIN = 'http://127.0.0.1:5155';
const APP = 'http://127.0.0.1:5156';
const coldOnly = process.env.ARTWORK_COLD_ONLY === '1';
const reportPath = '/tmp/seerrng-artwork-pr-media/assertions.json';
const OUTPUT = '/tmp/seerrng-artwork-pr-media';
const albumId = '11111111-1111-4111-8111-111111111111';
const artistId = '22222222-2222-4222-8222-222222222222';
const shared = { adult: false, budget: 0, revenue: 0, genres: [], keywords: [], relatedVideos: [], productionCompanies: [], productionCountries: [], spokenLanguages: [], credits: { cast: [], crew: [] }, externalIds: {}, watchProviders: [], originalLanguage: 'en', popularity: 1, voteAverage: 0, voteCount: 0, status: 'Released', onUserWatchlist: false };
const movie = { ...shared, id: 9101, title: 'Artwork Movie', originalTitle: 'Artwork Movie', overview: 'Fixture movie for browser cache verification.', posterPath: '/artwork-movie.png', releaseDate: '2025-01-01', releases: { results: [] }, runtime: 90, video: false };
const tv = { ...shared, id: 9102, name: 'Artwork Series', originalName: 'Artwork Series', overview: 'Fixture series for browser cache verification.', posterPath: '/artwork-tv.png', contentRatings: { results: [] }, createdBy: [], episodeRunTime: [30], firstAirDate: '2025-01-01', lastAirDate: '2025-01-01', homepage: '', inProduction: false, languages: ['en'], networks: [], numberOfEpisodes: 0, numberOfSeasons: 0, originCountry: [], seasons: [], type: 'Scripted' };
const collection = { id: 9103, name: 'Artwork Collection', title: 'Artwork Collection', overview: 'Fixture collection for browser cache verification.', posterPath: '/artwork-collection.png', parts: [] };
const book = { id: 'OL9104W', mediaType: 'book', title: 'Artwork Book', author: 'Fixture Author', firstPublishYear: 2025, description: 'Fixture ebook.', subjects: [], posterPath: 'https://covers.openlibrary.org/b/id/artwork-book-L.png' };
const audiobook = { ...book, id: 'OL9105W', title: 'Artwork Audiobook', description: 'Fixture audiobook.', posterPath: 'https://covers.openlibrary.org/b/id/artwork-audiobook-L.png?edition=audio' };
const album = { id: albumId, mbId: albumId, mediaType: 'album', title: 'Artwork Album', type: 'Album', 'primary-type': 'Album', releaseDate: '2025-01-01', 'first-release-date': '2025-01-01', artist: { id: artistId, name: 'Artwork Artist' }, 'artist-credit': [{ name: 'Artwork Artist' }], posterPath: 'https://archive.org/download/artwork-album/artwork-album_thumb250.png', tracks: [], tags: { artist: [], releaseGroup: [] } };
const artist = { id: artistId, mediaType: 'artist', name: 'Artwork Artist', artist: { name: 'Artwork Artist' }, artistThumb: 'https://r2.theaudiodb.com/images/media/artist/artwork-artist.png', releaseGroups: [], typeCounts: {}, biography: 'Fixture artist.' };
const person = { id: 9108, mediaType: 'person', name: 'Artwork Person', profilePath: '/artwork-person.png', biography: 'Fixture person.', knownForDepartment: 'Acting', alsoKnownAs: [], adult: false, popularity: 1, externalIds: {} };
const fixtures = { movie, tv, collection, book, audiobook, album, artist, person };
const searches = [{ ...movie, mediaType: 'movie' }, { ...tv, mediaType: 'tv' }, { ...collection, mediaType: 'collection' }, book, audiobook, album, artist, person];
const details = new Map([['/api/v1/movie/9101', movie], ['/api/v1/tv/9102', tv], ['/api/v1/collection/9103', collection], ['/api/v1/book/OL9104W', book], ['/api/v1/book/OL9105W', audiobook], [`/api/v1/music/${albumId}`, album], [`/api/v1/artist/${artistId}`, artist], ['/api/v1/person/9108', person]]);
const cases = [['movie', '/movie/9101', 'artwork-movie'], ['tv', '/tv/9102', 'artwork-tv'], ['collection', '/collection/9103', 'artwork-collection'], ['book', '/book/OL9104W', 'artwork-book'], ['audiobook', '/book/OL9105W', 'artwork-audiobook'], ['album', `/music/${albumId}`, 'artwork-album'], ['artist', `/artist/${artistId}`, 'artwork-artist'], ['person', '/person/9108', 'artwork-person']];
const imageRequests = [];
const upstreamErrors = [];
const pngs = new Map();
let upgradeDelayMs = 0;
let forcedArtworkError = false;
let searchOnly = null;
for (const width of [250, 342, 500, 600, 780]) {
  const height = Math.round(width * 1.5);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#334155"/><circle cx="${width/2}" cy="${width/2}" r="${width/3}" fill="#7c3aed"/><text x="${width/2}" y="${height-40}" text-anchor="middle" fill="white" font-size="${width/10}">${width}px</text></svg>`;
  pngs.set(width, await sharp(Buffer.from(svg)).png().toBuffer());
}
const fixtureArtworkCache = new Map();
const fixtureArtwork = async (path, width) => {
  const media = ['movie','tv','collection','audiobook','book','album','artist','person'].find(type => path.includes(`artwork-${type}`)) ?? 'movie';
  const title = { movie:'MOVIE', tv:'SERIES', collection:'COLLECTION', book:'BOOK', audiobook:'AUDIOBOOK', album:'ALBUM', artist:'ARTIST', person:'PERSON' }[media];
  const color = { movie:'#7c3aed', tv:'#2563eb', collection:'#c026d3', book:'#059669', audiobook:'#0891b2', album:'#dc2626', artist:'#d97706', person:'#4f46e5' }[media];
  const height = Math.round(width * (['album','artist'].includes(media) ? 1 : 1.5));
  const key = `${media}-${width}`;
  if (!fixtureArtworkCache.has(key)) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"><rect width="100%" height="100%" fill="#0f172a"/><rect x="${width*.07}" y="${height*.045}" width="${width*.86}" height="${height*.91}" rx="${width*.045}" fill="${color}"/><circle cx="${width*.5}" cy="${height*.43}" r="${width*.31}" fill="#ffffff" fill-opacity=".1"/><path d="M${width*.38} ${height*.3} L${width*.67} ${height*.43} L${width*.38} ${height*.56}Z" fill="#ffffff" fill-opacity=".8"/><text x="${width*.5}" y="${height*.15}" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${width*.07}" letter-spacing="${width*.014}">FIXTURE ART</text><text x="${width*.5}" y="${height*.70}" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${width*.09}" font-weight="700">${title}</text><text x="${width*.5}" y="${height*.26}" text-anchor="middle" fill="white" font-family="sans-serif" font-size="${width*.13}" font-weight="700">${width} px</text></svg>`;
    fixtureArtworkCache.set(key, await sharp(Buffer.from(svg)).png().toBuffer());
  }
  return fixtureArtworkCache.get(key);
};
const json = (res, body, status = 200) => { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-cache' }); res.end(JSON.stringify(body)); };
const emptyPage = { page: 1, totalPages: 1, totalResults: 0, results: [] };
const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, ORIGIN);
    if (url.pathname.startsWith('/avatarproxy/') || (url.pathname.startsWith('/imageproxy/') && !url.pathname.includes('artwork-'))) {
      const body = pngs.get(342);
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': body.length, 'Cache-Control': 'public, max-age=3600' });
      res.end(body); return;
    }
    if (url.pathname.startsWith('/imageproxy/') && url.pathname.includes('artwork-')) {
      const width = Number(url.pathname.match(/\/w(342|500|780)\//)?.[1] ?? (url.pathname.includes('person') ? 600 : url.pathname.includes('album') ? 250 : 500));
      const body = await fixtureArtwork(url.pathname, width);
      const entry = { path: url.pathname + url.search, width, bytes: 0, status: 200, started: Date.now() };
      imageRequests.push(entry);
      if (width === 780 && upgradeDelayMs) await new Promise(resolve => setTimeout(resolve, upgradeDelayMs));
      if (width === 780 && forcedArtworkError) { entry.status = 503; res.writeHead(503); res.end(); return; }
      const etag = `"fixture-${width}-${url.pathname}"`;
      if (req.headers['if-none-match'] === etag) { entry.status = 304; res.writeHead(304, { ETag: etag, 'Cache-Control': 'public, max-age=3600' }); res.end(); return; }
      entry.bytes = body.length;
      res.writeHead(200, { 'Content-Type': 'image/png', 'Content-Length': body.length, 'Cache-Control': 'public, max-age=3600', ETag: etag, Date: new Date().toUTCString() });
      res.end(body); return;
    }
    const nextMatch = url.pathname.match(/^\/_next\/data\/[^/]+\/(movie|tv|collection)\/(910[123])\.json$/);
    if (nextMatch) { json(res, { pageProps: { [nextMatch[1]]: fixtures[nextMatch[1]] }, __N_SSP: true }); return; }
    if (url.pathname === '/api/v1/search') {
      let results = url.searchParams.get('query') === 'Cold' ? [] : searches;
      if (searchOnly) results = results.filter(result => String(result.id) === String(fixtures[searchOnly].id));
      json(res, { page: 1, totalPages: 1, totalResults: results.length, results }); return;
    }
    if (/^\/api\/v1\/user\/\d+\/settings\/card-text$/.test(url.pathname)) { json(res, { movie: 'always', tv: 'always', album: 'always', book: 'always' }); return; }
    if (details.has(url.pathname)) { json(res, details.get(url.pathname)); return; }
    if (url.pathname.startsWith('/api/v1/association/')) { json(res, { root: { id: 'fixture', title: 'Fixture', mediaType: 'movie' }, edges: [] }); return; }
    if (url.pathname.endsWith('/combined_credits')) { json(res, { id: 9108, cast: [], crew: [] }); return; }
    if (url.pathname === '/api/v1/imageproxy/warm') { json(res, { queued: 0 }); return; }
    if (url.pathname.startsWith('/api/v1/genres/')) { json(res, []); return; }
    if (url.pathname.startsWith('/api/v1/settings/discover')) { json(res, []); return; }
    if (url.pathname.includes('/ratings')) { json(res, {}); return; }
    if (url.pathname.startsWith('/api/v1/') && !/^\/api\/v1\/(auth|settings|user|status)(?:\/|$)/.test(url.pathname)) { json(res, emptyPage); return; }
    const headers = { ...req.headers, host: '127.0.0.1:5156', 'accept-encoding': 'identity' };
    const upstream = http.request(new URL(req.url, APP), { method: req.method, headers }, (response) => {
      if (url.pathname === '/api/v1/settings/public') {
        const chunks = [];
        response.on('data', chunk => chunks.push(chunk));
        response.on('end', () => {
          const body = JSON.parse(Buffer.concat(chunks).toString());
          const result = Buffer.from(JSON.stringify({ ...body, cacheImages: true, musicEnabled: true, booksEnabled: true, localLogin: true }));
          res.writeHead(response.statusCode, { ...response.headers, 'content-length': result.length }); res.end(result);
        });
      } else { res.writeHead(response.statusCode, response.headers); response.pipe(res); }
    });
    upstream.on('error', error => { upstreamErrors.push(error.message); if (!res.headersSent) res.writeHead(502); res.end(); });
    req.pipe(upstream);
  } catch (error) { upstreamErrors.push(error.stack); if (!res.headersSent) res.writeHead(500); res.end(String(error)); }
});
await new Promise(resolve => server.listen(5155, '127.0.0.1', resolve));
const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
const report = { origin: ORIGIN, app: APP, browser: await browser.version(), date: new Date().toISOString(), navigation: [], upgrade: [], cold: [], runtimeErrors: [], upstreamErrors, imageRequests };
const log = (...args) => console.log(...args);
const settle = page => page.waitForTimeout(300);
const loaded = async (page, token) => {
  const image = page.locator(`img[src*="${token}"]`).first();
  for (let attempt = 0; attempt < 5; attempt++) {
    try { await image.scrollIntoViewIfNeeded(); break; }
    catch (error) { if (attempt === 4) throw error; await page.waitForTimeout(100); }
  }
  await image.waitFor({ state: 'visible' });
  await page.waitForFunction(token => { const img = document.querySelector(`img[src*="${token}"]`); return img?.complete && img.naturalWidth > 0; }, token);
  return image;
};
const snapshot = image => image.evaluate(img => ({ src: img.currentSrc, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, cssWidth: img.getBoundingClientRect().width, cssHeight: img.getBoundingClientRect().height, dpr: devicePixelRatio }));
const counts = token => imageRequests.filter(request => request.path.includes(token)).reduce((result, entry) => ({ requests: result.requests + 1, bytes: result.bytes + entry.bytes }), { requests: 0, bytes: 0 });
const timing = (page, token) => page.evaluate(token => performance.getEntriesByType('resource').filter(entry => entry.name.includes(token)).map(entry => ({ name: entry.name, transferSize: entry.transferSize, encodedBodySize: entry.encodedBodySize, decodedBodySize: entry.decodedBodySize, duration: entry.duration })), token);
async function login(context, page) {
  await page.goto(`${ORIGIN}/login`, { waitUntil: 'domcontentloaded' });
  const email = page.getByTestId('email');
  if (!await email.isVisible()) { const local = page.getByText('Use your Seerr account').first(); if (await local.isVisible()) await local.click(); }
  await email.fill(process.env.EVIDENCE_EMAIL);
  await page.getByTestId('password').fill(process.env.EVIDENCE_PASSWORD);
  await page.getByTestId('local-signin-button').click();
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20000 });
  const me = await context.request.get(`${ORIGIN}/api/v1/auth/me`);
  assert.equal(me.status(), 200, 'Real local authenticated session must be established');
}
async function setup(serviceWorkers, dpr = 2, width = 390) {
  const context = await browser.newContext({ viewport: { width, height: 844 }, deviceScaleFactor: dpr, serviceWorkers });
  const page = await context.newPage();
  page.on('console', message => { if (message.type() === 'error') { log('CONSOLE', message.text()); if (/TypeError|ReferenceError|SyntaxError|Minified React|Maximum update/.test(message.text())) report.runtimeErrors.push(message.text()); } });
  page.on('response', response => { if (response.status() >= 400) log('HTTP', response.status(), response.url()); });
  page.on('requestfailed', request => log('REQUESTFAILED', request.url(), request.failure()?.errorText));
  page.on('pageerror', error => { report.runtimeErrors.push(error.stack); log('PAGEERROR', error.message); });
  await login(context, page);
  if (serviceWorkers === 'allow') await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
  log('authenticated', serviceWorkers, 'DPR', dpr);
  return { context, page };
}
async function clickCard(page, path, token) {
  const img = await loaded(page, token);
  await img.hover();
  await page.locator(`a[href="${path}"]`).first().evaluate(anchor => anchor.click());
  const expected = new URL(path, ORIGIN);
  await page.waitForURL(url => url.pathname === expected.pathname && url.search === expected.search);
}
report.commit = process.env.EVIDENCE_COMMIT;
report.fixtureDisclosure = 'Actual SeerrNG production build running locally with deterministic metadata and fixed-size artwork served by an HTTP fixture proxy. These are not production catalog titles. No Playwright routing or browser cache disabling is used.';
report.recordings = [];
function observeErrors(page) {
  page.on('pageerror', error => report.runtimeErrors.push(error.stack));
  page.on('console', message => { if (message.type() === 'error' && /TypeError|ReferenceError|SyntaxError|Minified React|Maximum update/.test(message.text())) report.runtimeErrors.push(message.text()); });
}
async function authenticatedContext(storageState, width, height, dpr, record) {
  const context = await browser.newContext({ storageState, viewport: { width, height }, deviceScaleFactor: dpr, serviceWorkers: 'allow', ...(record ? { recordVideo: { dir: `${OUTPUT}/raw`, size: { width, height } } } : {}) });
  const epoch = Date.now();
  const page = await context.newPage();
  observeErrors(page);
  await page.goto(`${ORIGIN}/search?query=Artwork`, { waitUntil: 'domcontentloaded' });
  await loaded(page, 'artwork-movie');
  await page.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 20000 });
  return { context, page, epoch };
}
try {
  const authentication = await setup('allow');
  const storageState = await authentication.context.storageState();
  await authentication.context.close();
  const grid = await authenticatedContext(storageState, 1440, 1000, 1, false);
  for (const [, , token] of cases) await loaded(grid.page, token);
  await grid.page.evaluate(() => window.scrollTo(0, 0));
  await grid.page.waitForTimeout(350);
  await grid.page.screenshot({ path: `${OUTPUT}/01-media-grid.png`, scale: 'css', fullPage: true });
  await grid.context.close();
  log('CAPTURE grid');

  const mobile = await authenticatedContext(storageState, 390, 844, 2, true);
  const mobileStart = (Date.now() - mobile.epoch) / 1000;
  await mobile.page.waitForTimeout(700);
  for (const [mediaType, path, token] of [...cases].sort((a, b) => ['movie','tv','book','audiobook','album','collection','artist','person'].indexOf(a[0])-['movie','tv','book','audiobook','album','collection','artist','person'].indexOf(b[0]))) {
    if (mediaType === 'audiobook') {
      await mobile.page.evaluate(() => window.next.router.push('/search?query=Artwork&type=book&format=audiobook'));
      await mobile.page.waitForURL(url => url.search.includes('format=audiobook'));
    }
    const card = await snapshot(await loaded(mobile.page, token));
    await mobile.page.waitForTimeout(550);
    const before = counts(token);
    const detailPath = path + (mediaType === 'audiobook' ? '?format=audiobook' : '');
    await clickCard(mobile.page, detailPath, token);
    const detail = await snapshot(await loaded(mobile.page, token));
    await mobile.page.mouse.move(1, 1);
    await mobile.page.waitForTimeout(1350);
    assert.equal(detail.src, card.src, `${mediaType} reuses the card source`);
    assert.deepEqual(counts(token), before, `${mediaType} detail uses zero origin requests or bytes`);
    if (mediaType === 'movie') {
      assert.equal(detail.cssWidth, 128);
      assert.equal(detail.naturalWidth, 342);
      await mobile.page.screenshot({ path: `${OUTPUT}/02-mobile-movie-reuse.png`, scale: 'css' });
    }
    if (mediaType === 'audiobook') await mobile.page.screenshot({ path: `${OUTPUT}/03-mobile-audiobook-reuse.png`, scale: 'css' });
    await mobile.page.goBack({ waitUntil: 'domcontentloaded' });
    await loaded(mobile.page, token);
    await mobile.page.waitForTimeout(250);
    assert.deepEqual(counts(token), before, `${mediaType} back navigation uses zero origin requests or bytes`);
    report.navigation.push({ mediaType, sw: 'allow', card, detail, detailOriginDelta: { requests: 0, bytes: 0 }, backOriginDelta: { requests: 0, bytes: 0 }, resources: await timing(mobile.page, token) });
    log('CAPTURE mobile', mediaType, '0 requests, 0 bytes');
    if (mediaType === 'audiobook') {
      await mobile.page.evaluate(() => window.next.router.push('/search?query=Artwork'));
      await mobile.page.waitForURL(url => url.search === '?query=Artwork');
    }
  }
  await mobile.page.waitForTimeout(500);
  const mobileEnd = (Date.now() - mobile.epoch) / 1000;
  const mobileVideo = mobile.page.video();
  await mobile.context.close();
  await mobileVideo.saveAs(`${OUTPUT}/raw/mobile-all-media.webm`);
  report.recordings.push({ name: 'mobile-all-media', width: 390, height: 844, dpr: 2, trimStart: mobileStart, trimDuration: mobileEnd-mobileStart });

  searchOnly = 'movie';
  const desktop = await authenticatedContext(storageState, 1440, 900, 3, true);
  const desktopStart = (Date.now() - desktop.epoch) / 1000;
  const card = await snapshot(await loaded(desktop.page, 'artwork-movie'));
  const before = counts('artwork-movie');
  await desktop.page.waitForTimeout(1500);
  upgradeDelayMs = 3300;
  await clickCard(desktop.page, '/movie/9101', 'artwork-movie');
  const desktopPoster = desktop.page.locator('.media-poster img').first();
  await desktopPoster.waitFor({ state: 'visible' });
  await desktop.page.mouse.move(1, 1);
  const interim = await snapshot(desktopPoster);
  assert.equal(interim.src, card.src);
  assert.equal(interim.cssWidth, 208);
  await desktop.page.waitForTimeout(350);
  await desktop.page.screenshot({ path: `${OUTPUT}/04-desktop-before-upgrade.png`, scale: 'css' });
  await desktop.page.waitForFunction(() => document.querySelector('.media-poster img')?.currentSrc.includes('/w780/'));
  const upgraded = await snapshot(desktopPoster);
  assert.equal(upgraded.naturalWidth, 780);
  assert.equal(upgraded.cssWidth, 208);
  await desktop.page.waitForTimeout(350);
  await desktop.page.screenshot({ path: `${OUTPUT}/05-desktop-after-upgrade.png`, scale: 'css' });
  await desktop.page.waitForTimeout(2200);
  const after = counts('artwork-movie');
  assert.equal(after.requests-before.requests, 1);
  await desktop.page.goBack({ waitUntil: 'domcontentloaded' });
  await loaded(desktop.page, 'artwork-movie');
  await desktop.page.waitForTimeout(1300);
  assert.deepEqual(counts('artwork-movie'), after);
  report.upgrade.push({ sw: 'allow', delayMs: 3300, card, interim, upgraded, originDelta: { requests: after.requests-before.requests, bytes: after.bytes-before.bytes }, backOriginDelta: { requests: 0, bytes: 0 }, resources: await timing(desktop.page, 'artwork-movie') });
  const desktopEnd = (Date.now() - desktop.epoch) / 1000;
  const desktopVideo = desktop.page.video();
  await desktop.context.close();
  await desktopVideo.saveAs(`${OUTPUT}/raw/desktop-poster-upgrade.webm`);
  report.recordings.push({ name: 'desktop-poster-upgrade', width: 1440, height: 900, dpr: 3, trimStart: desktopStart, trimDuration: desktopEnd-desktopStart });
  assert.equal(report.runtimeErrors.length, 0);
  assert.equal(upstreamErrors.length, 0);
  report.success = true;
  log('CAPTURE complete', JSON.stringify(report.recordings));
} catch (error) {
  report.success = false;
  report.failure = error.stack;
  log('CAPTURE FAILED', error.stack);
  for (const context of browser.contexts()) for (const page of context.pages()) await page.screenshot({ path: `${OUTPUT}/capture-failure.png`, scale: 'css' }).catch(() => {});
  process.exitCode = 1;
} finally {
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
