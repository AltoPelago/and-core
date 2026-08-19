# `and-core`

`and-core` is the standalone home for `&ND` (AEON Native Document).

> &ND is a pedantic prose language. Pronounced “amperand”… with a silent G.
> Markdown tries to be forgiving.
> &ND is not.

`&ND` is a deterministic, fail-closed document language designed for structured document content,
editor integration, canonicalization, and future conformance-tested implementations.

## Repository Layout

* [docs/spec/README.md](./docs/spec/README.md) — version-stage index for `&ND` spec tracks
* [docs/spec/v1/README.md](./docs/spec/v1/README.md) — the current v1 spec bundle
* [docs/spec/v2/README.md](./docs/spec/v2/README.md) — the active v2 proposal track
* [docs/spec/v1/and-implementation-guide.md](./docs/spec/v1/and-implementation-guide.md) — parser-author guidance and recommended architecture
* [docs/spec/v1/and-public-api.md](./docs/spec/v1/and-public-api.md) — proposed stable package surface for external consumers
* [docs/spec/v1/fmt-and-reference.md](./docs/spec/v1/fmt-and-reference.md) — proposed AES-facing `fmt.and` vocabulary and model boundary
* [docs/tooling/playground.md](./docs/tooling/playground.md) — local playground direction and usage
* [docs/tooling/html-renderer.md](./docs/tooling/html-renderer.md) — AST-to-HTML projection contract
* [vscode/](./vscode/) — first-pass VS Code language prototype
* [playground/](./playground/) — static parser/canonical/preview playground prototype
* [cts/README.md](./cts/README.md) — conformance test suite plan and fixture layout
* [implementations/README.md](./implementations/README.md) — future parser/emitter implementation home
* [examples/README.md](./examples/README.md) — future example documents and interoperability samples
* [CONTRIBUTING.md](./CONTRIBUTING.md) — contribution workflow for spec, CTS, and implementation changes

## Current Status

The repository is currently spec-and-CTS first:

* the v1 language spec has been migrated in from the design workspace
* canonical, implementation, and editor-support documents are present
* CTS fixtures are machine-readable and indexed
* a reference parser adapter validates strict accept/reject fixtures, expected ASTs, and expected error codes
* an executable v2 proposal lane validates promoted syntax, cross-version boundaries, canonical
  round trips, resource budgets, and HTML projection
* a smaller reference subset adapter demonstrates capability-scoped CTS participation
* an initial root package surface is available through [`index.mjs`](./index.mjs)
* CI runs the repository safety checks and both CTS adapters

## Version Stages

The repository currently tracks two active language stages:

* `&ND Core v1` is in **draft** stage
* `&ND Core v2` is in **proposal** stage

Stage meanings in this repository:

* **draft**: semantics and behavior may still change, including breaking changes, while design and CTS pressure continue
* **proposal**: exploratory design work where shape and boundaries are intentionally fluid

Current working focus is v2 proposal development. v1 remains editable and may still change until
it is formally published by `aeonite-org`.

## Suggested Reading Order

1. [docs/spec/v1/and-core-proposal.md](./docs/spec/v1/and-core-proposal.md)
2. [docs/spec/v1/and-canonical-rules.md](./docs/spec/v1/and-canonical-rules.md)
3. [docs/spec/v1/and-implementation-guide.md](./docs/spec/v1/and-implementation-guide.md)
4. [docs/spec/v1/and-vscode-support.md](./docs/spec/v1/and-vscode-support.md)
5. [docs/spec/v1/and-ast-contract.md](./docs/spec/v1/and-ast-contract.md)

## Common Entry Paths

If you are here to understand the language itself:

1. [docs/spec/v1/and-core-proposal.md](./docs/spec/v1/and-core-proposal.md)
2. [docs/spec/v1/and-canonical-rules.md](./docs/spec/v1/and-canonical-rules.md)

If you want to contribute to ongoing design direction:

1. [docs/spec/README.md](./docs/spec/README.md)
2. [docs/spec/v2/README.md](./docs/spec/v2/README.md)
3. [docs/spec/v2/and-core-v2-proposal.md](./docs/spec/v2/and-core-v2-proposal.md)
4. [docs/spec/v2/and-ast-contract.md](./docs/spec/v2/and-ast-contract.md)

If you want to build a parser or canonical emitter:

1. [docs/spec/v1/and-core-proposal.md](./docs/spec/v1/and-core-proposal.md)
2. [docs/spec/v1/and-implementation-guide.md](./docs/spec/v1/and-implementation-guide.md)
3. [docs/spec/v1/and-ast-contract.md](./docs/spec/v1/and-ast-contract.md)
4. [cts/README.md](./cts/README.md)
5. [implementations/README.md](./implementations/README.md)

If you want to connect `&ND` into the AES ecosystem:

1. [docs/spec/v1/and-public-api.md](./docs/spec/v1/and-public-api.md)
2. [docs/spec/v1/fmt-and-reference.md](./docs/spec/v1/fmt-and-reference.md)
3. [docs/spec/v1/and-ast-contract.md](./docs/spec/v1/and-ast-contract.md)

If you want to work on editor tooling:

1. [docs/spec/v1/and-vscode-support.md](./docs/spec/v1/and-vscode-support.md)
2. [docs/spec/v1/and-implementation-guide.md](./docs/spec/v1/and-implementation-guide.md)
3. [vscode/](./vscode/)
4. [playground/](./playground/)

If you want to extend or audit the CTS:

1. [cts/README.md](./cts/README.md)
2. [cts/AUTHORING.md](./cts/AUTHORING.md)
3. [docs/spec/v1/and-core-proposal.md](./docs/spec/v1/and-core-proposal.md)

## Near-Term Next Steps

* complete v2 source-span and cross-form combination coverage
* publish v1-to-v2 migration and consumer-convention companion guidance
* keep the executable v2 proposal lane independent from the normative v1 fixture index
* continue validating and refining v1 draft behavior under implementation pressure
* keep conformance seeds, CTS fixtures, and reference reports moving together

## Safety Scripts

* `npm test` — runs the repository safety checks, CTS adapters, adapter example, canonical checks, and CLI smoke checks
* `npm run playground` — serves the local playground at `http://localhost:4173/playground/`
* `npm run playground:check` — verifies playground wiring, parser budgets, and parser/canonical smoke behavior
* `npm run check:html-renderer` — verifies the reference AST-to-HTML projection
* `npm run check:vscode` — verifies the VS Code prototype manifest, grammar, and language configuration
* `npm run html:report` — writes reference HTML renderer output snapshots to `cts/reports/`
* `npm run and -- check examples/minimal.and` — checks one document with the local CLI
* `npm run and -- check examples/minimal.and --budget maxLineLength=120` — checks with an explicit parser budget
* `npm run and -- check path/to/proposal.and --version v2` — opts the CLI into the v2 proposal parser
* `npm run and -- diagnostics examples/minimal.and --json` — emits parser-backed diagnostics for editor tooling
* open the repo in VS Code and run `.vscode/launch.json` → `Run &ND VS Code Prototype` — launches the current editor prototype against `vscode/samples/`
* `npm run vscode:package` — stages a dependency-free unpacked VS Code extension bundle under `artifacts/`
* `npm run and -- parse examples/minimal.and --json` — emits a parsed AST
* `npm run and -- parse examples/minimal.and --json --spans` — emits an AST with source spans
* `npm run and -- canonical examples/minimal.and --profile standalone` — emits canonical text
* `npm run and -- render-html examples/minimal.and` — emits an escaped HTML fragment
* `npm run and -- render-html examples/minimal.and --document --out output.html` — writes a complete HTML document
* `npm run and -- render-html path/to/proposal.and --version v2 --image-base-url https://docs.example/guide/proposal.and` — resolves relative image sources against an explicit HTTP(S) document base
* CLI parser budgets use repeatable `--budget name=value` flags. Supported names are `maxDocumentSize`,
  `maxLineLength`, `maxNestingDepth`, `maxInlineDepth`, `maxTableColumns`, `maxBlockSize`,
  `maxBlockCount`, `maxListItemCount`, and `maxLinkTargetLength`.
* CLI failures include stable `errorCode` values and line/column diagnostics where available
* `npm run check:no-local-paths` — blocks workstation-specific path leaks in tracked files
* `npm run check:spec-layout` — verifies the expected spec bundle layout and local Markdown links
* `npm run check:cts-fixtures` — validates the CTS fixture index and fixture JSON shape
* `npm run check:cts-seed-coverage` — verifies that all normative spec seeds are represented in the CTS index
* `npm run check:reports` — verifies generated CTS/canonical/HTML report artifacts are fresh
* `npm run check:canonical-emitter` — emits canonical text for supported CTS AST fixtures and reparses it
* `npm run check:html-renderer` — checks escaped HTML fragment/full-document output and fail-closed behavior
* `npm run check:public-api` — verifies the root package surface for parse, inline parse, diagnostics, canonical emission, and HTML projection
* `npm run cli:smoke` — verifies the local CLI check, parse, and canonical commands
* `npm run canonical:report` — writes canonical emitter output snapshots to `cts/reports/`
* `npm run html:report` — writes HTML renderer output snapshots to `cts/reports/`
* `npm run cts:run` — loads the CTS fixture manifest and emits the current placeholder/adapted run report
* `npm run cts:run:example` — runs the copyable baseline adapter example
* `npm run cts:run:subset` — runs the current reference subset adapter against the CTS
* `npm run cts:run:reference` — runs the first reference parser adapter against the CTS
* `npm run cts:run:v2:proposal` — runs v2 proposal fixtures plus v1/v2 version-boundary checks
* `npm run cts:report:example` — writes a JSON CTS report artifact for the baseline adapter example
* `npm run cts:report:subset` — writes a JSON CTS report artifact for the reference subset adapter
* `npm run cts:report:reference` — writes a JSON CTS report artifact for the reference parser adapter
* `npm run cts:report:all` — regenerates all parser and canonical report artifacts
* `npm run precommit:check` — runs the current repository safety checks together

## Continuous Integration

The GitHub Actions workflow in [`.github/workflows/ci.yml`](./.github/workflows/ci.yml) runs:

* `npm run precommit:check`
* `npm run cts:run:reference`
* `npm run cts:run:subset`
* `npm run cts:run:v2:proposal`
* `npm run check:canonical-emitter`
