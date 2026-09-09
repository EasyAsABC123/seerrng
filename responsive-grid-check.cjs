// Standalone Chromium proof of the poster-grid responsive sizing correction.
// Requires Playwright with Chromium installed. Run:
//   node responsive-grid-check.cjs
// Or set PLAYWRIGHT_MODULE to an installed Playwright module's absolute path.
// This test uses generated HTML only: no server, credentials, or network.
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || "playwright");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const outputDirectory = process.env.PROOF_OUTPUT || __dirname;
const sampleIndices = [0, 12, 48, 80, 199];

async function paint(page) {
  await page.evaluate(
    () =>
      new Promise((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(resolve));
      }),
  );
}

async function measure(page) {
  return page.evaluate(
    (indices) =>
      indices.map((index) => {
        const item = document.querySelectorAll("li")[index];
        const bounds = item.getBoundingClientRect();
        return {
          index,
          width: bounds.width,
          height: bounds.height,
          expectedHeight: bounds.width * 1.5,
          heightError: bounds.height - bounds.width * 1.5,
          viewportTop: bounds.top,
          containIntrinsicSize: getComputedStyle(item).containIntrinsicSize,
          minHeight: getComputedStyle(item).minHeight,
        };
      }),
    sampleIndices,
  );
}

(async () => {
  fs.mkdirSync(outputDirectory, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const proof = {
    description:
      "Previously visited offscreen poster rows must adopt their new 2:3 height after a three-column to four-column resize.",
    browser: await browser.version(),
    initialViewport: { width: 640, height: 900 },
    resizedViewport: { width: 650, height: 900 },
    variants: {},
  };

  try {
    for (const [name, minimumHeight] of [
      ["baseline-auto-none", "auto"],
      ["fixed-min-height-zero", "0"],
    ]) {
      const page = await browser.newPage({ viewport: proof.initialViewport });
      await page.setContent(`
        <style>
          body { margin: 0; }
          ul.cards-vertical { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
          ul.cards-vertical > li { content-visibility: auto; contain-intrinsic-size: auto 20rem; }
          ul.cards-vertical.poster-grid > li { aspect-ratio: 2 / 3; min-height: ${minimumHeight}; contain-intrinsic-size: auto none; }
          .card { width: 100%; padding-bottom: 150%; background: #3b4662; }
        </style>
        <ul class="cards-vertical poster-grid">${Array.from({ length: 200 }, () => '<li><div class="card"></div></li>').join("")}</ul>
      `);
      // Paint earlier rows before scrolling them out of view. This is the
      // prerequisite that makes Chromium remember their original heights.
      for (let position = 0; position < 6000; position += 500) {
        await page.evaluate((top) => window.scrollTo(0, top), position);
        await paint(page);
      }
      const beforeResize = await measure(page);
      await page.setViewportSize(proof.resizedViewport);
      await paint(page);
      const afterResize = await measure(page);
      proof.variants[name] = { beforeResize, afterResize };
      await page.close();
    }
  } finally {
    await browser.close();
  }

  const baseline = proof.variants["baseline-auto-none"].afterResize;
  const fixed = proof.variants["fixed-min-height-zero"].afterResize;
  const baselineMaximumError = Math.max(
    ...baseline.map((item) => Math.abs(item.heightError)),
  );
  const fixedMaximumError = Math.max(
    ...fixed.map((item) => Math.abs(item.heightError)),
  );
  proof.result = { baselineMaximumError, fixedMaximumError };
  fs.writeFileSync(
    path.join(outputDirectory, "responsive-grid-measurements.json"),
    `${JSON.stringify(proof, null, 2)}\n`,
  );
  console.log(JSON.stringify(proof.result, null, 2));
  assert(
    baselineMaximumError > 50,
    "Baseline must reproduce stale offscreen row heights",
  );
  assert(
    fixedMaximumError < 1,
    "Every fixed row must match its responsive 2:3 ratio",
  );
  console.log(
    "PASS: baseline reproduces the stale height; min-height: 0 eliminates it.",
  );
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
