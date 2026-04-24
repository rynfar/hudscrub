# hudscrub

Batch PII redaction and sandbox-substitution for HUD documents, with **byte-exact preservation of dollar amounts**.

## Status

Migrating from Python CLI to TypeScript web app. The TypeScript engine lives in [`web/`](web/) and replicates the Python CLI's functionality with the same dollar-preservation guarantee. The Python CLI in `hudscrub/` remains as the reference implementation and will be archived under `legacy/python/` after the web app ships (Plan 4).

See [`docs/superpowers/specs/2026-04-24-hudscrub-web-design.md`](docs/superpowers/specs/2026-04-24-hudscrub-web-design.md) for the full design and `docs/superpowers/plans/` for implementation plans.



## What this does

Two modes for processing HUD PDFs:

- **`redact`** — replaces PII with true black-box redactions. The original text is removed from the PDF content stream (not just overlaid), so you can't recover it by selecting/copying the blacked region.
- **`sandbox`** — replaces PII with consistent fake values (same original always maps to the same fake, across every page and every file in a batch). Useful for creating demo or test fixtures from real documents.

In both modes, **dollar amounts pass through byte-identical**. This is enforced at three layers: the regex module refuses to include `DOLLAR` in the enabled pattern list for mutation, the `ValueMapper` has no `map_dollar` method and raises `ValueError` if asked, and the integration tests diff every dollar string in every input against every dollar string in every output.

## Install

```bash
pip install pymupdf reportlab faker pytest pdfplumber
```

## Quick start

Generate three sample HUD-1 PDFs to experiment with:

```bash
python -m hudscrub.cli fixtures examples/
```

Redact them:

```bash
python -m hudscrub.cli redact examples/ -o redacted/ -v
```

Sandbox them (with a seed for reproducibility):

```bash
python -m hudscrub.cli sandbox examples/ -o sandbox/ --seed 42 \
    --mapping-report mappings.json -v
```

### With a config

```json
{
  "enabled_patterns": ["SSN", "PHONE", "EMAIL", "DATE", "LOAN_NUM"],
  "custom_strings": [
    "John Q. Smith",
    "Maria Gonzalez",
    "482 Maple Ridge Drive"
  ],
  "custom_replacements": {
    "John Q. Smith": "Alex T. Doe",
    "Maria Gonzalez": "Pat W. Roe",
    "482 Maple Ridge Drive": "100 Sample Lane"
  }
}
```

```bash
python -m hudscrub.cli sandbox hud_docs/ -o sandbox/ -c config.json --seed 1
```

`custom_replacements` lets you control exactly what each known value becomes (useful for names you want matched and substituted the same way every time). `custom_strings` without an explicit replacement will be treated as literals to find but not substituted — use `custom_replacements` when you want a specific fake.

## Package structure

```
hudscrub/
├── hudscrub/
│   ├── patterns.py      # Regex patterns, DOLLAR forbidden for mutation
│   ├── mapping.py       # ValueMapper — consistent, deterministic substitution
│   ├── processor.py     # RedactProcessor, SandboxProcessor
│   ├── fixtures.py      # Fake HUD-1 PDF generator
│   └── cli.py           # Command-line interface
├── tests/
│   ├── conftest.py
│   ├── test_patterns.py     # 33 tests
│   ├── test_mapping.py      # 15 tests
│   ├── test_processor.py    # 10 tests
│   └── test_integration.py  # 16 tests
└── examples/                # Generated fake HUD PDFs
```

## Running the tests

```bash
PYTHONPATH=. python -m pytest tests/ -v
```

Should report `74 passed`. Highlights:

- `TestDollarPreservation::test_dollars_preserved_per_file[redact]` — every dollar string in every fixture survives redaction byte-for-byte
- `TestDollarPreservation::test_dollars_preserved_per_file[sandbox]` — same for sandbox mode
- `TestDollarPreservation::test_sandbox_math_still_adds_up` — the sum of borrower-charge lines still equals the disclosed gross-amount-due total after sandboxing
- `TestEndToEndSandbox::test_structural_consistency_same_fake_per_original` — if an SSN appears N times in input, its fake replacement appears exactly N times in output
- `TestSandbox::test_determinism_with_seed` — same seed + same input = byte-identical mapping reports (important for reproducible sandbox packets)

## What PII is detected

Default enabled patterns:

| Label | Example | Notes |
|---|---|---|
| `SSN` | `900-11-2233` | Fakes use 900-range (IRS-reserved for testing) |
| `EIN` | `12-3456789` | |
| `PHONE` | `(555) 555-0147` | Fakes use 555 exchange (RFC 2606) |
| `EMAIL` | `user@example.com` | Fakes use example.com (RFC 2606) |
| `DATE` | `07/15/2024` | All dates shifted by one shared offset to preserve order |
| `LOAN_NUM` | `Loan No. SMH-2024-88421` | Fake preserves length, hyphens, and digit/letter positions |
| `ZIP` | `84341` or `84341-1234` | Off by default (too many false positives); enable explicitly |

Names and street addresses aren't reliably catchable via regex. Use `custom_strings` + `custom_replacements` in your config for those — since the same parties repeat across a HUD packet, listing them once covers every occurrence.

## What does NOT get substituted

- **Dollar amounts** (`$1,234.56`) — enforced at three layers, tested in integration.
- **Property parcel IDs** unless they happen to match `LOAN_NUM` format.
- **Signatures/handwriting** if present as images (apply_redactions uses `images=2` in redact mode to black them out, `images=0` in sandbox mode to leave them alone — adjust in `processor.py` if needed).

## Using the Python API directly

```python
from hudscrub.processor import SandboxProcessor

proc = SandboxProcessor(
    custom_strings=["John Q. Smith", "482 Maple Ridge Drive"],
    custom_replacements={
        "John Q. Smith": "Alex T. Doe",
        "482 Maple Ridge Drive": "100 Sample Lane",
    },
    seed=42,
)
report = proc.process("input.pdf", "output.pdf")
print(report.counts)         # {'SSN': 2, 'PHONE': 3, ...}
print(report.dollars_seen)   # 26  (left untouched)
print(proc.get_mappings())   # full audit of originals -> fakes
```

## Limitations

- **Scanned (image-only) PDFs**: regex won't find anything because there's no text layer. OCR first with `ocrmypdf input.pdf output.pdf`, then run hudscrub.
- **Replacement text length**: if a fake name is much longer than the original, PyMuPDF auto-shrinks the font to fit the original rectangle. Visually this can look a bit off; the data is still correct.
- **Text extraction order in output**: `page.get_text()` may return redaction-replacement text in a slightly different order than the surrounding prose. Tests use substring-in-text and count-in-text checks rather than line-by-line equality for this reason.
