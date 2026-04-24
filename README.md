# hudscrub

A browser-based tool for reviewing and redacting **HUD-1 closing documents** with on-device AI.

PDFs never leave your browser — text extraction, entity detection (regex + Transformers.js or WebLLM), human review, and PDF output all run locally.

## Why

Closing-document workflows touch real PII (names, SSNs, addresses, loan numbers) under RESPA/GLBA. Most "PDF redaction" tools either (a) make you paint black boxes by hand, or (b) upload your PDFs to a cloud service. This tool does neither: it suggests redactions with a local AI model, and you confirm or reject each one.

## Stack

- **Next.js 16** (App Router, Turbopack) on **Vercel**
- **TypeScript** end to end
- **PDF.js** for rendering and text extraction
- **mupdf.js** (WASM build of MuPDF) for true content-stream redaction
- **Transformers.js** + bert-base-NER for fast on-device entity detection
- **WebLLM** + Phi-3.5-mini / Gemma 2 2B / Qwen 2.5 7B for high-quality multi-pass detection
- **Zustand** + localStorage for state
- **Tailwind CSS v4** + Framer Motion + Geist for the UI

## Run locally

```bash
cd web
npm install --legacy-peer-deps
npm run gen-fixtures      # generates 3 sample HUD-1 PDFs
npm run dev               # http://localhost:3000
```

## Deploy

```bash
cd web
npx vercel link           # one-time
npx vercel deploy --prod
```

The included `vercel.json` sets long-cache headers for static chunks and standard security headers. Next.js + Turbopack auto-detected.

## Tests

```bash
cd web
npm test                                # 100+ unit + integration tests
RUN_NER_TESTS=1 npm test                # also runs slow real-NER integration tests
npm run test:e2e                        # Playwright privacy assertion
```

The privacy E2E asserts (in a real browser) that no PDF bytes and no PII strings ever leave the page through any network request.

## Repo layout

```
.
├── web/                  # the app
│   ├── app/              # Next.js routes
│   ├── src/
│   │   ├── detection/    # regex + NER + WebLLM detectors
│   │   ├── llm/          # WebLLM client + prompts
│   │   ├── pdf/          # PDF.js wrapper
│   │   ├── output/       # mupdf.js redactor + dollar-preservation verifier
│   │   ├── mapping/      # deterministic fake-value mapper (sandbox mode)
│   │   ├── store/        # Zustand stores
│   │   ├── processing/   # batch processing flow
│   │   ├── review/       # review UI components
│   │   ├── ui/           # design primitives
│   │   └── upload/       # drop-zone
│   └── tests/            # unit, integration, e2e
└── docs/superpowers/     # design specs and implementation plans
```

## Built-in invariants

1. **PDF bytes never cross the network.** Verified by the privacy E2E test on every commit.
2. **Dollar amounts pass through byte-identical** between input and output PDFs. Three-layer enforcement: regex never enabled for `DOLLAR`, the `ValueMapper` rejects dollar mapping, and a pre-export verifier diffs every dollar string.
3. **Detection is swappable.** Anything implementing the `Detector` interface plugs into the pipeline.

## License

MIT
