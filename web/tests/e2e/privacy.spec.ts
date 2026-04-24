import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FIXTURE = path.resolve(__dirname, '../fixtures/hud1_garcia.pdf');

// Sample sensitive strings present in our HUD-1 fixture.
// Should never appear in any outgoing network request body or URL.
const SENSITIVE = [
  'Maria L. Garcia',
  'David Garcia',
  '521-44-9012',
  '522-45-9013',
  '1428 Oak Hollow Lane',
  'm.garcia@example.com',
  'GAR-2024-77310',
];

test('privacy: PDF bytes and PII never leave the browser', async ({ page }) => {
  test.skip(!fs.existsSync(FIXTURE), 'Run `npm run gen-fixtures` first.');

  // Capture every outgoing request
  interface Outgoing {
    url: string;
    method: string;
    postData: string | null;
  }
  const outgoing: Outgoing[] = [];
  page.on('request', (req) => {
    outgoing.push({ url: req.url(), method: req.method(), postData: req.postData() });
  });

  await page.goto('/');
  await page.getByRole('link', { name: /get started/i }).click();

  // Skip onboarding (don't download the model in this test — speeds it up massively)
  await page.getByRole('button', { name: /skip/i }).click();

  // Upload the fixture via the file input
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles(FIXTURE);

  await page.waitForURL(/\/review\//, { timeout: 30_000 });
  await page.locator('canvas').first().waitFor({ state: 'visible', timeout: 30_000 });
  // Give a beat for any incidental fetches to fire
  await page.waitForTimeout(2_000);

  // Filter to outgoing requests that target external (non-localhost) origins.
  // Local-network requests are app assets, _next/* chunks, etc. — those are fine.
  const isInternal = (u: string) => {
    try {
      const url = new URL(u);
      return (
        url.hostname === 'localhost' ||
        url.hostname === '127.0.0.1' ||
        url.hostname.endsWith('.local')
      );
    } catch {
      return true;
    }
  };

  const externalRequests = outgoing.filter((r) => !isInternal(r.url));
  // Only allow specific external origins we expect.
  // - huggingface.co + subdomains: NER model + tokenizer
  // - xethub.hf.co + subdomains: HuggingFace's CAS bridge for large model weights
  // - cdn.jsdelivr.net: occasionally used by transformers.js for tokenizer assets
  const allowedExternalOrigins = [
    'huggingface.co',
    'cdn-lfs.huggingface.co',
    'xethub.hf.co',
    'cdn.jsdelivr.net',
  ];
  for (const req of externalRequests) {
    const host = new URL(req.url).hostname;
    expect(
      allowedExternalOrigins.some((h) => host === h || host.endsWith(`.${h}`)),
      `Unexpected external origin: ${host} (${req.url})`,
    ).toBe(true);
  }

  // Assert no outgoing request body or URL contains any sensitive string
  for (const req of outgoing) {
    for (const s of SENSITIVE) {
      expect(req.url, `URL contained sensitive string "${s}"`).not.toContain(s);
      if (req.postData) {
        expect(req.postData, `POST body contained sensitive string "${s}"`).not.toContain(s);
      }
    }
  }
});
