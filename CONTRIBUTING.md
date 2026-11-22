# Contributing

`and-core` is spec-and-CTS first. Changes should keep the language prose, machine-readable
fixtures, and implementation behavior moving together.

## Version Stage Policy

Current stage assignments:

1. `&ND Core v1` is **draft**.
2. `&ND Core v2` is **draft**.

Practical implications:

1. v1 is not yet frozen and may still accept breaking changes while it remains draft.
2. v2 grammar changes require coordinated specification, CTS, and implementation updates.
3. Any behavior changes should state which version they target and whether they are intentionally
	breaking within that stage.
4. No version is treated as published/final in this repository until formal publication by
	`aeonite-org`.

## Development Loop

Use the full local check before opening or updating a PR:

```sh
npm test
```

This runs the main repository safety, parser CTS, canonicalization, HTML,
editor-package, public API, CLI, and parser-playground checks. The exact chain is
maintained in [`package.json`](./package.json).

For a faster documentation-only check:

```sh
npm run precommit:check
```

Additional checks depend on the area you change:

| Area | Check / guide |
| --- | --- |
| v2 draft behavior | `npm run cts:run:v2`; [v2 contracts](./docs/spec/v2/README.md) |
| CTS fixtures, adapter runs, and coverage | [CTS guide](./cts/README.md) |
| Parser playground | `npm run playground:check`; [playground guide](./docs/tooling/playground.md) |
| Semantic AEON/SANSA workspace | [Setup and runtime checks](./docs/tooling/playground.md) |
| VS Code grammar and local bundle | [Editor guide](./vscode/README.md) |
| CLI commands and parser budgets | [CLI guide](./docs/tooling/cli.md) |

Some CI checks, including the v2 lane and semantic workspace, run separately from
`npm test`. See [the workflow](./.github/workflows/ci.yml) for the complete CI roster.

## Spec Changes

When changing normative language in `docs/spec/v1/and-core-proposal.md`:

1. Add or update named conformance seeds in the spec.
2. Add or update matching fixtures under `cts/fixtures/`.
3. Update `cts/fixtures/index.json`.
4. Update the reference parser if the behavior is implementation-covered.
5. Regenerate report artifacts when expected output changes.

The seed coverage check fails when named spec seeds and indexed CTS fixtures drift apart.

For v2, update the [authoritative draft](https://github.com/aeonite-org/aeonite-specs/blob/main/sources/and/v2/and-core-v2.aeon)
with the grammar or compatibility change. Add accepted and rejected cases to the v2 CTS index,
including expected ASTs or diagnostics, and run `npm run cts:run:v2`.

## CTS Changes

Follow [cts/AUTHORING.md](./cts/AUTHORING.md) for fixture shape, expected documents, and expected
error codes.

Strict accept fixtures should include `expected.document` once the AST shape is covered by
the contract. Strict reject fixtures must include `expected.errorCode`.

## Implementation Changes

The reference parser is a CTS-guarded implementation, not a place to silently invent behavior.

When adding parser behavior:

1. Prefer adding or updating CTS coverage first.
2. Keep emitted AST nodes aligned with [docs/spec/v1/and-ast-contract.md](./docs/spec/v1/and-ast-contract.md).
3. Use stable diagnostic codes for strict-mode rejection cases.
4. Run `npm run cts:run:reference`.

Subset adapters may skip document checks by omitting document capability, but full parser adapters
should declare document capability when they emit AST output.

## Generated Reports

Regenerate the parser, canonical, and HTML reports with:

```sh
npm run cts:report:all
npm run check:reports
```

Review the generated diffs before committing. To regenerate only one parser report:

```sh
npm run cts:report:reference
npm run cts:report:subset
```

Reports record runner outcomes. The versioned CTS indexes enumerate the executable fixtures.
