# hudscrub-web

Browser-based HUD-1 redaction tool with human review and on-device AI detection.

This is the foundation library — the engine that powers the upcoming web app. See `../docs/superpowers/specs/2026-04-24-hudscrub-web-design.md` for the full design.

## Develop

```bash
npm install
npm run gen-fixtures   # generates test PDFs (one-time)
npm test
```

## Sanity-check the engine

```bash
npm run redact -- --mode redact --in tests/fixtures/hud1_garcia.pdf --out /tmp/out.pdf
```
