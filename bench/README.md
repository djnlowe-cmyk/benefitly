# Parse-quality benchmark

The Day-1 commitment ([ALI-108][cto-strategy]) is **≤15% per-field
correction rate on every Day-1 document category**. This directory holds the
code and contract for measuring it, plus the regression net we run on every
relevant PR and on a nightly schedule.

[cto-strategy]: ../docs/  "see ALI-108 in Paperclip"

## Day-1 categories (ceiling-enforced)

| key                    | description                          |
|------------------------|--------------------------------------|
| `home`                 | UK home insurance (buildings, contents, combined) |
| `auto`                 | UK motor insurance                   |
| `travel`               | UK travel insurance                  |
| `mobile-warranty`      | Mobile / device warranty (e.g. AppleCare+) |
| `whitegoods-warranty`  | White-goods warranty                 |
| `creditcard`           | Credit-card benefits / Section 75    |
| `employer-benefits`    | Employer benefits PDF                |

Adding a new category requires bumping `manifestVersion` in
`bench/types.ts` — old baselines stop being comparable.

## Layout

```
bench/
  types.ts            # field/category lists + ceiling
  scoring.ts          # pure: comparison + per-category aggregation
  report.ts           # report assembly, diff vs baseline, markdown summary
  storage.ts          # corpus storage adapters (local FS, GCS)
  piiRules.ts         # pure PII detection rules (used by anonymise.ts + tests)
  anonymise.ts        # CLI: verify a PDF is anonymised (refuses a doc otherwise)
  run.ts              # CLI: run the harness, write report, exit non-zero on fail
  manifest.json       # the corpus index — what docs to score, which category
  ground-truth/       # human-labelled correct extraction per doc id
  fixtures/           # pre-recorded parser responses for fixture-mode CI smoke
  corpus/             # local cache of the GCS PDFs (gitignored)
  reports/            # latest run output (gitignored)
  baselines/          # the report committed as the "current production" line
```

## Running the harness

```bash
# Fixture mode (default) — no network, no cost, deterministic.
# Used by CI on every PR that touches src/lib/ai/** or prisma/schema.prisma.
npx tsx bench/run.ts

# Live mode — pulls real PDFs from GCS, calls Claude, costs real money.
# Used by the nightly schedule and `--update-baseline` runs.
ANTHROPIC_API_KEY=sk-... \
BENCH_STORAGE=gcs \
BENCH_GCS_BUCKET=benefitly-bench-corpus \
npx tsx bench/run.ts --mode=live

# Override the model (use this to cost-test Haiku for a specific sub-task).
npx tsx bench/run.ts --mode=live --model=claude-haiku-4-5-20251001

# Update the committed baseline.
npx tsx bench/run.ts --mode=live --update-baseline
```

Exit codes: `0` = pass, `1` = at least one Day-1 category exceeded the
ceiling, `2` = harness error (manifest invalid, ground-truth missing, etc).

## Cost per full benchmark run

A full live run hits Claude once per corpus document. Sonnet 4 list pricing
is **$3/MTok input, $15/MTok output**; a typical UK policy PDF is ~12k input
tokens and the parser caps the response at 2k output tokens.

| corpus size | input tokens | output tokens | est. USD | est. GBP   |
|---:|---:|---:|---:|---:|
|  20 docs |   240,000 |   40,000 | $1.32 | ~£1.05 |
|  40 docs |   480,000 |   80,000 | $2.64 | ~£2.10 |
|  80 docs |   960,000 |  160,000 | $5.28 | ~£4.20 |

PR runs use the **fixture** harness — zero cost. The nightly run pays this
on `main` once a day; `--update-baseline` runs add one more spend per
prompt change. Keep an eye on the cost line in the markdown summary.

## How scoring works

For each manifest entry the harness:

1. Loads the ground truth (`bench/ground-truth/<key>.json`).
2. Calls the production parse pipeline (`src/lib/ai/parseDocument.ts`) on
   the PDF (live mode) or loads a pre-recorded response (fixture mode).
3. For every field annotated in the ground truth, compares using the rule
   for that field type (see `bench/scoring.ts`):
   - **strings**: case-insensitive, whitespace-collapsed, currency-stripped
   - **numbers**: equal within £0.005
   - **arrays**: order-insensitive set equality of normalised strings
   - **null** in ground truth ⇔ field absent or empty in extraction
4. Aggregates to a per-category, per-field correction rate.
5. Diffs against the committed baseline and renders a markdown summary
   (which CI posts on the triggering PR).
6. Exits non-zero if any category with `≥5` scored docs exceeds the
   15% ceiling on any field.

Categories with fewer than 5 docs are reported but not enforced — see
`MIN_DOCS_FOR_CEILING_ENFORCEMENT` in `bench/types.ts`.

## Privacy

Real customer documents from the concierge cohort are **never** ingested
into the benchmark — those users have not consented to their docs being
used as a regression target. Corpus sources are limited to:

- Founder-owned documents the founder has signed off on.
- Public sample policies (insurer specimen PDFs, regulator reference docs).

Every PDF is anonymised before it lands in GCS:

1. The contributor redacts the source PDF (Acrobat or equivalent).
2. The contributor runs `tsx bench/anonymise.ts <pdf> --deny-list <json>`
   with a deny-list of literal strings that must not survive (their name,
   address, policy number).
3. The verifier exits non-zero on any blocking finding (UK postcode, NI
   number, sort code, deny-list hit, email).
4. Only after a clean verifier run does the doc enter the corpus + manifest.

The corpus directory is gitignored and the GCS bucket is a private project.

## Updating the baseline

The committed baseline (`bench/baselines/baseline.json`) is the "current
production" line — every PR diff is computed against it. Bump it whenever
we **intentionally** change quality:

- Production prompt change merged.
- New category added.
- Ground truth re-labelled.

Don't bump it to silence a regression; the entire point of the harness is
that an unintended quality drop fails the build.

```bash
npx tsx bench/run.ts --mode=live --update-baseline
git add bench/baselines/baseline.json
git commit -m "bench: refresh baseline after <reason>"
```

## What is NOT here (yet)

- The real corpus (≥40 anonymised UK PDFs across all 7 categories) — the
  long pole. Tracked as a child issue of [ALI-123].
- Provisioning of the GCS bucket — needs CEO approval, tracked separately.
- Ground-truth labelling for the real corpus + CTO calibration on the
  first 10 docs — tracked separately.
- Live customer-facing quality score — out of scope for this ticket.
