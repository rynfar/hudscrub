# hudscrub-web

Browser-based HUD-1 redaction tool with human review and on-device AI detection.

This is the engine library for the upcoming web app. See `../docs/superpowers/specs/2026-04-24-hudscrub-web-design.md` for the full design.

## Develop

```bash
npm install --legacy-peer-deps
npm run gen-fixtures   # generates test PDFs (one-time)
npm test
```

## Sanity-check the engine

Regex-only (fast, deterministic):

```bash
npm run redact -- --mode redact --in tests/fixtures/hud1_garcia.pdf --out /tmp/out.pdf
```

With NER (catches names and addresses):

```bash
npm run redact -- --mode redact --in tests/fixtures/hud1_garcia.pdf --out /tmp/out.pdf --detector both
```

The first NER run downloads ~110MB (Xenova/bert-base-NER); cached on disk afterwards.

Sandbox mode (deterministic fake replacements):

```bash
npm run redact -- --mode sandbox --in tests/fixtures/hud1_garcia.pdf --out /tmp/out.pdf --seed 42
```

## Test commands

```bash
npm test                                 # all unit + fast integration
RUN_NER_TESTS=1 npm test                 # also runs slow NER integration tests
```
