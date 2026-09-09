// Run against a locally seeded production build. Never injects CSS.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const fs = require("node:fs");
const assert = require("node:assert/strict");
const phase = process.env.PROOF_PHASE || "after";
const outputDir = process.env.PROOF_DIRECTORY || __dirname;
const baseURL = process.env.BASE_URL || "http://localhost:5058";
const tab = process.env.PROOF_TAB || "movies";
const mediaType = { movies: "movie", tv: "tv", books: "book" }[tab];
const width = Number(process.env.PROOF_WIDTH || 1440);
const height = 900;
const targetIndex = 73;
const fixtureCount = 160;

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    serviceWorkers: "block",
    viewport: { width, height },
    recordVideo: {
      dir: `${outputDir}/${phase}-video`,
      size: { width, height },
    },
  });
  try {
    const login = await context.request.post(`${baseURL}/api/v1/auth/local`, {
      data: { email: "admin@seerr.dev", password: "test1234" },
      headers: { "X-Forwarded-Proto": "https" },
    });
    assert.equal(login.status(), 200, "Seeded test admin must log in");
    const cookie = login
      .headers()
      ["set-cookie"].match(/connect\.sid=([^;]+)/)[1];
    await context.addCookies([
      {
        name: "connect.sid",
        value: cookie,
        domain: new URL(baseURL).hostname,
        path: "/",
        httpOnly: true,
        secure: false,
        sameSite: "Lax",
      },
    ]);
    const page = await context.newPage();
    const names = [
      "The Secret Woman",
      "Summer Temptations",
      "Ghost Stories",
      "Iron Man",
      "Spider-Man",
      "The Matrix",
      "Dune",
      "The Punisher",
      "Hoppers",
      "Kraken",
      "Toy Story",
      "Buddy",
    ];
    const items = Array.from({ length: fixtureCount }, (_, i) => ({
      id: mediaType === "book" ? `OLPROOF${i}W` : 10000 + i,
      mediaType,
      title:
        i === targetIndex
          ? tab === "movies"
            ? "Hoppers"
            : `Scroll ${mediaType} ${i + 1}`
          : `${names[i % names.length]} ${i + 1}`,
      name: `Scroll ${mediaType} ${i + 1}`,
      author: "Fixture Author",
      overview: "A local fixture for measuring discovery scroll restoration.",
      releaseDate: "2026-01-01",
      firstAirDate: "2026-01-01",
      firstPublishYear: 2026,
      posterPath: `/proof-${i}.svg`,
      voteAverage: 7,
    }));
    const target = items[targetIndex];
    const detailPath = `/${mediaType}/${target.id}`;
    const details = {
      ...target,
      originalTitle: target.title,
      credits: { cast: [], crew: [] },
      productionCompanies: [],
      productionCountries: [],
      spokenLanguages: [],
      genres: [],
      keywords: [],
      relatedVideos: [],
      externalIds: {},
      releases: { results: [] },
      contentRatings: { results: [] },
      seasons: [],
      createdBy: [],
      episodeRunTime: [],
      networks: [],
      isbnCandidates: [],
      subjects: [],
      originalLanguage: "en",
      status: "Released",
    };
    await page.route(
      new RegExp(`/api/v1/discover/${tab}(?:\\?|$)`),
      async (route) => {
        const p = Number(
          new URL(route.request().url()).searchParams.get("page") || 1,
        );
        await route.fulfill({
          json: {
            page: p,
            totalPages: fixtureCount / 20,
            totalResults: fixtureCount,
            results: items.slice((p - 1) * 20, p * 20),
          },
        });
      },
    );
    await page.route(`**/api/v1${detailPath}/*`, (route) =>
      route.fulfill({
        json: { page: 1, totalPages: 1, totalResults: 0, results: [] },
      }),
    );
    await page.route(`**/api/v1${detailPath}`, (route) =>
      route.fulfill({ json: details }),
    );
    if (mediaType !== "book")
      await page.route(`**/_next/data/**${detailPath}.json*`, (route) =>
        route.fulfill({
          json: { pageProps: { [mediaType]: details }, __N_SSP: true },
        }),
      );
    await page.route("**/*proof-*.svg*", async (route) => {
      const match = decodeURIComponent(route.request().url()).match(
        /proof-(\d+)/,
      );
      const i = Number(match?.[1] || 0);
      await route.fulfill({
        contentType: "image/svg+xml",
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="300" height="450"><rect width="300" height="450" fill="hsl(${(i * 43) % 360},45%,25%)"/><text x="20" y="220" fill="white" font-size="22">${items[i]?.title || i}</text><text x="20" y="260" fill="white" font-size="20">Card ${i + 1}</text></svg>`,
      });
    });
    await page.goto(`${baseURL}/discover/${tab}`, {
      waitUntil: "domcontentloaded",
    });
    await page.getByTestId("title-card").first().waitFor();
    for (let i = 0; i < 20; i++) {
      if ((await page.getByTestId("title-card").count()) >= 100) break;
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      await page.waitForTimeout(200);
    }
    const card = page.locator("ul.cards-vertical > li").nth(targetIndex);
    await card.scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -180));
    await page.waitForTimeout(1000);
    const measure = () =>
      card.evaluate((el) => ({
        y: el.getBoundingClientRect().y,
        h: el.getBoundingClientRect().height,
        scrollY: window.scrollY,
        count: document.querySelectorAll("[data-testid=title-card]").length,
        docHeight: document.documentElement.scrollHeight,
      }));
    const getOrder = () =>
      page
        .locator("ul.cards-vertical > li a")
        .evaluateAll((links) => links.map((link) => link.getAttribute("href")));
    const before = await measure();
    const beforeOrder = await getOrder();
    await page.screenshot({ path: `${outputDir}/${phase}-1-before-click.png` });
    const box = await card.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForURL(`**${detailPath}`);
    await page
      .getByTestId("media-title")
      .filter({ hasText: target.title })
      .waitFor();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${outputDir}/${phase}-2-details.png` });
    await page.goBack();
    await page.waitForURL(`**/discover/${tab}`);
    await card.waitFor();
    const samples = [];
    for (let i = 0; i < 10; i++) {
      await page.waitForTimeout(200);
      samples.push(await measure());
    }
    await page.screenshot({ path: `${outputDir}/${phase}-3-after-back.png` });
    const afterOrder = await getOrder();
    const output = {
      phase,
      tab,
      viewport: { width, height },
      fixtureTitle: target.title,
      browser: browser.version(),
      before,
      samples,
      deltaY: samples.at(-1).y - before.y,
      orderPreserved:
        JSON.stringify(afterOrder.slice(0, beforeOrder.length)) ===
        JSON.stringify(beforeOrder),
    };
    fs.writeFileSync(
      `${outputDir}/${phase}-measurements.json`,
      JSON.stringify(output, null, 2),
    );
    console.log(JSON.stringify(output, null, 2));
    assert.ok(output.orderPreserved, "Loaded card order must survive Back");
    if (phase !== "before")
      assert.ok(
        samples.every((sample) => Math.abs(sample.y - before.y) <= 2),
        "Card must stay within 2px of its original position",
      );
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
