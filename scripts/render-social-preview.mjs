import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

// Capture the real landing components and local fonts in a fixed social layout.
const origin = process.argv[2] ?? 'http://127.0.0.1:4173';
const output = new URL('../docs-site/public/social/projection-ui.png', import.meta.url);
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1, reducedMotion: 'reduce', colorScheme: 'dark' });
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.goto(origin, { waitUntil: 'networkidle' });
  await page.locator('.landing-project-card').waitFor();
  await page.evaluate(() => document.fonts.ready);
  assert.equal(await page.locator('#landing-title').textContent(), 'Yes. Another UI library.');
  await page.addStyleTag({ content: `
    html, body { width: 1200px; height: 630px; overflow: hidden; }
    *, *::before, *::after { animation: none !important; transition: none !important; }
    .skip-link, .landing-nav nav, .nav-light, .landing-motion-control,
    .landing-main > :not(.landing-hero), .landing-footer,
    .landing-copy > :not(h1):not(.landing-lead), .landing-demo-toolbar { display: none !important; }
    .landing-shell { width: 1200px; height: 630px; }
    .landing-nav { margin: 0 60px; width: 1080px; padding: 34px 0 28px; }
    .landing-wordmark { font-size: 26px; }
    .social-address { font: 16px var(--reader-body); color: var(--landing-muted); }
    #nd-page.landing-main { width: 1200px; padding: 0 60px; }
    .landing-hero { grid-template-columns: 510px 1fr; gap: 36px; padding: 38px 0 0; }
    #nd-page .landing-copy h1 { font-size: 70px; line-height: 1.02; max-width: 8ch; margin-bottom: 28px; }
    .landing-copy .landing-lead { font-size: 23px; max-width: 27ch; line-height: 1.45; margin: 0; }
    .landing-demo { opacity: 1 !important; transform: none !important; }
    .landing-preview-backdrop { padding: 22px; }
    .landing-project-card { gap: 18px; }
    .landing-hero-wash { inset: -40px -60px 0; }
  ` });
  await page.evaluate(() => {
    const address = document.createElement('span');
    address.className = 'social-address';
    address.textContent = 'projectionui.dev';
    document.querySelector('.landing-nav').append(address);
  });
  for (const selector of ['.landing-wordmark', '#landing-title', '.landing-lead', '.landing-preview']) {
    const box = await page.locator(selector).boundingBox();
    assert.ok(box && box.x >= 0 && box.y >= 0 && box.x + box.width <= 1200 && box.y + box.height <= 630, `${selector} must fit the preview`);
  }
  mkdirSync(new URL('../docs-site/public/social/', import.meta.url), { recursive: true });
  await page.screenshot({ path: fileURLToPath(output), animations: 'disabled' });
  console.log(`Saved ${fileURLToPath(output)}`);
} finally {
  await browser.close();
}
