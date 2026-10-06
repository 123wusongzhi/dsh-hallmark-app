/** Capture the helen-margin source component at wide and narrow widths using the repo preview server. */
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { startSourcePreview } from '../../../scripts/source-preview.mjs';

const directory = resolve(import.meta.dirname, '..');
const data = resolve(directory, 'artifacts/helen-on-sale.json');
const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const require = createRequire(resolve(directory, 'package.json'));
const playwright = await import(pathToFileURL(require.resolve('playwright')).href);
const chromium = playwright.chromium ?? playwright.default?.chromium;
if (!chromium) throw new Error('playwright chromium unavailable');

const outDir = resolve(directory, '.preview');
await mkdir(outDir, { recursive: true });
const preview = await startSourcePreview({ directory, data });
let browser;
try { browser = await chromium.launch({ headless: true, executablePath: chrome }); }
catch { browser = await chromium.launch({ headless: true }); }

const report = { buildId: preview.manifest.buildId, url: preview.url, views: [] };
try {
  for (const [width, height] of [[1100, 1000], [380, 900]]) {
    const page = await browser.newPage({ viewport: { width, height }, colorScheme: 'light' });
    const errors = [];
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('pageerror', (error) => errors.push(String(error.message)));
    await page.goto(preview.url, { waitUntil: 'networkidle' });
    const frame = page.frameLocator('iframe[title="源码组件预览"]');
    await frame.locator('.margin-app[data-ready="ready"]').waitFor({ timeout: 30000 });
    await page.waitForTimeout(400);

    const interactions = [];
    if (width === 1100) {
      const run = async (label, fn) => { try { interactions.push({ label, result: await fn() }); } catch (error) { interactions.push({ label, error: String(error.message).split('\n')[0] }); } };
      await run('search клемм', async () => { await frame.locator('input[aria-label="搜索商品"]').fill('клемм'); await page.waitForTimeout(250); return (await frame.locator('.tool-meta').first().innerText()).replace(/\s+/g, ' '); });
      await run('search 无结果', async () => { await frame.locator('input[aria-label="搜索商品"]').fill('zzzz-not-found'); await page.waitForTimeout(250); return await frame.locator('.empty-state h2').first().innerText(); });
      await run('清除搜索', async () => { await frame.locator('button[aria-label="清除搜索"]').click(); await page.waitForTimeout(250); return (await frame.locator('.tool-meta').first().innerText()).replace(/\s+/g, ' '); });
      await run('排序采购价', async () => { await frame.locator('button[aria-label="采购价，点击排序"]').click(); await page.waitForTimeout(250); return (await frame.locator('tbody tr').first().innerText()).replace(/\s+/g, ' ').slice(0, 80); });
      await run('选择控件状态（预览限制）', async () => {
        const disabled = await frame.locator('.desktop-table thead .selection-box').isDisabled();
        const attachTitle = await frame.locator('.attach-button').getAttribute('title');
        return `headerCheckboxDisabled=${disabled} attachTitle=${attachTitle ?? 'null'}`;
      });
    }

    const file = resolve(outDir, `helen-${width}.png`);
    await page.screenshot({ path: file });
    const facts = await frame.locator('body').evaluate((body) => ({
      rows: body.querySelectorAll('.desktop-table tbody tr, .mobile-product').length,
      headers: [...body.querySelectorAll('th')].map((node) => node.innerText.trim()).filter(Boolean),
      kpi: [...body.querySelectorAll('.kpi-value')].map((node) => node.textContent),
      firstRow: (body.querySelector('tbody tr')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 160),
      footer: (body.querySelector('.data-caption')?.innerText ?? '').slice(0, 160),
    }));
    report.views.push({ width, height, file, errors, interactions, facts });
    await page.close();
  }
} finally {
  await browser.close();
  await preview.close();
}
console.log(JSON.stringify(report, null, 2));
