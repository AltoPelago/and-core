# CTS Reports

This directory contains generated CTS report artifacts.

Current intended usage:

* local implementation snapshots
* CI artifacts
* compatibility comparison between adapters

The current convenience script writes:

* `baseline-adapter-report.json`
* `reference-subset-report.json`
* `reference-parser-report.json`
* `reference-canonical-report.json`

Generated report files are not part of the normative CTS definition.
They are execution artifacts derived from the fixture suite and a chosen adapter.
Report scripts use `--quiet` so regeneration updates files without printing full JSON payloads.

## Summary Fields

Each report includes:

* `totals` — fixture count and pass/fail/error/pending counts
* `documentChecks` — structural AST expectation coverage
* `errorCodeChecks` — reject diagnostic coverage
* `results` — per-fixture adapter results

Canonical emitter reports include:

* `totals` — accept fixture count, profile count, and canonical fixed-point status counts
* `results[].profiles.embedded.canonical` — emitted headerless canonical text
* `results[].profiles.standalone.canonical` — emitted standalone canonical text with `&ND v1`
* `results[].notes` — failure or skip details, if any

For a full parser adapter with `capabilities.document = true`, document checks should be fully
matched:

```text
documentChecks expected=N checked=N matched=N skipped=0 failed=0
```

For a smoke adapter without document capability, skipped document checks are expected:

```text
documentChecks expected=N checked=0 matched=0 skipped=N failed=0
```

Error-code checks should always match for covered reject fixtures:

```text
errorCodeChecks expected=N matched=N missingActual=0 mismatched=0
```

## Regeneration

Regenerate the reports with:

```sh
npm run cts:report:all
```

Or regenerate individual reports with:

```sh
npm run cts:report:reference
npm run cts:report:subset
npm run cts:report:example
npm run canonical:report
```
