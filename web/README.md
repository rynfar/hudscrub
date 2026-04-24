# hudscrub-web

Browser-based HUD-1 PII redaction with human review and on-device AI detection.

PDFs never leave the browser. Detection runs locally via regex + Transformers.js NER. Output is true content-stream redaction (or fake-value sandbox) via mupdf.js — same engine as the original Python CLI.

See [`../docs/superpowers/specs/2026-04-24-hudscrub-web-design.md`](../docs/superpowers/specs/2026-04-24-hudscrub-web-design.md) for the design and [`../docs/superpowers/plans/`](../docs/superpowers/plans/) for the implementation plans.

## Develop

```bash
npm install --legacy-peer-deps
npm run gen-fixtures   # one-time: generate sample HUD-1 PDFs for testing
npm run dev            # http://localhost:3000
```

## Tests

```bash
npm test                                 # unit + fast integration (107 tests)
RUN_NER_TESTS=1 npm test                 # adds slow NER integration tests
npm run test:e2e                         # Playwright privacy assertion (requires `npm run test:e2e:install` once)
```

## Sanity-check the engine via CLI

```bash
# Regex-only (instant)
npm run redact -- --mode redact --in tests/fixtures/hud1_garcia.pdf --out /tmp/out.pdf

# Regex + NER (downloads ~110MB on first run, cached)
npm run redact -- --mode redact --in tests/fixtures/hud1_garcia.pdf --out /tmp/out.pdf --detector both

# Sandbox mode (deterministic fake replacements)
npm run redact -- --mode sandbox --in tests/fixtures/hud1_garcia.pdf --out /tmp/out.pdf --seed 42
```

## Deploy to Vercel

One-time setup:

```bash
npx vercel login                         # if not logged in
cd web
npx vercel link                          # link to a project (creates one if needed)
```

Then deploy:

```bash
cd web
npx vercel deploy                        # preview deploy
npx vercel deploy --prod                 # production deploy
```

The included `vercel.json` sets long-cache headers for static chunks and standard security headers. Next.js 16 + Turbopack is auto-detected.

## What's in the box

- **Detection:** swappable `Detector` interface (regex + Transformers.js bert-base-NER); WebLLM (Phi/Gemma) is stubbed for v2
- **Output:** mupdf.js applies true redactions (content stream rewrite, not overlay) with the same `applyRedactions` API as PyMuPDF
- **Privacy:** 1 Playwright test asserts no PII strings or PDF bytes ever cross the network in the full upload→detect→export flow
- **Invariants:** dollar amounts pass through byte-identical; verified on every export and in 6 integration tests

## Known limitations

- WebLLM models (Phi-4-mini, Gemma 3 4B, Qwen 2.5 7B) are listed in the model picker but currently fall back to bert-NER — real WebLLM integration is the next milestone
- Sandbox mode replacement text uses FreeText annotations (renders visibly in any PDF viewer; appears in copy/paste from Preview but not all viewers) — see Plan 1's known limitation note
- Mobile not supported (desktop keyboard workflow assumed)
