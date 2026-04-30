# `and-core`

`and-core` is the standalone home for `&ND` (AEON Native Document).

> &ND is a pedantic prose language. Pronounced “amperand”… with a silent G.
> Markdown tries to be forgiving.
> &ND is not.

`&ND` is a deterministic, fail-closed document language designed for structured document content,
editor integration, canonicalization, and future conformance-tested implementations.

## Repository Layout

* [docs/spec/v1/README.md](./docs/spec/v1/README.md) — the current v1 spec bundle
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
* a smaller reference subset adapter demonstrates capability-scoped CTS participation
* CI runs the repository safety checks and both CTS adapters

## Suggested Reading Order

1. [docs/spec/v1/and-core-proposal.md](./docs/spec/v1/and-core-proposal.md)
2. [docs/spec/v1/and-canonical-rules.md](./docs/spec/v1/and-canonical-rules.md)
3. [docs/spec/v1/and-implementation-guide.md](./docs/spec/v1/and-implementation-guide.md)
4. [docs/spec/v1/and-vscode-support.md](./docs/spec/v1/and-vscode-support.md)
5. [docs/spec/v1/and-ast-contract.md](./docs/spec/v1/and-ast-contract.md)

## Near-Term Next Steps

* expand the reference parser from CTS coverage toward complete v1 coverage
* add canonical emission once the AST contract is stable enough
* expand the first-pass VS Code tooling into a fuller editor stack
* keep conformance seeds, CTS fixtures, and reference reports moving together

## Safety Scripts

* `npm test` — runs the repository safety checks, CTS adapters, adapter example, canonical checks, and CLI smoke checks
* `npm run playground` — serves the local playground at `http://localhost:4173/playground/`
* `npm run playground:check` — verifies playground wiring and parser/canonical smoke behavior
* `npm run check:html-renderer` — verifies the reference AST-to-HTML projection
* `npm run check:vscode` — verifies the VS Code prototype manifest, grammar, and language configuration
* `npm run html:report` — writes reference HTML renderer output snapshots to `cts/reports/`
* `npm run and -- check examples/minimal.and` — checks one document with the local CLI
* `npm run and -- diagnostics examples/minimal.and --json` — emits parser-backed diagnostics for editor tooling
* open the repo in VS Code and run `.vscode/launch.json` → `Run &ND VS Code Prototype` — launches the current editor prototype against `vscode/samples/`
* `npm run vscode:package` — stages a dependency-free unpacked VS Code extension bundle under `artifacts/`
* `npm run and -- parse examples/minimal.and --json` — emits a parsed AST
* `npm run and -- parse examples/minimal.and --json --spans` — emits an AST with source spans
* `npm run and -- canonical examples/minimal.and --profile standalone` — emits canonical text
* `npm run and -- render-html examples/minimal.and` — emits an escaped HTML fragment
* `npm run and -- render-html examples/minimal.and --document --out output.html` — writes a complete HTML document
* CLI failures include stable `errorCode` values and line/column diagnostics where available
* `npm run check:no-local-paths` — blocks workstation-specific path leaks in tracked files
* `npm run check:spec-layout` — verifies the expected spec bundle layout and local Markdown links
* `npm run check:cts-fixtures` — validates the CTS fixture index and fixture JSON shape
* `npm run check:cts-seed-coverage` — verifies that all normative spec seeds are represented in the CTS index
* `npm run check:canonical-emitter` — emits canonical text for supported CTS AST fixtures and reparses it
* `npm run check:html-renderer` — checks escaped HTML fragment/full-document output and fail-closed behavior
* `npm run cli:smoke` — verifies the local CLI check, parse, and canonical commands
* `npm run canonical:report` — writes canonical emitter output snapshots to `cts/reports/`
* `npm run html:report` — writes HTML renderer output snapshots to `cts/reports/`
* `npm run cts:run` — loads the CTS fixture manifest and emits the current placeholder/adapted run report
* `npm run cts:run:example` — runs the copyable baseline adapter example
* `npm run cts:run:subset` — runs the current reference subset adapter against the CTS
* `npm run cts:run:reference` — runs the first reference parser adapter against the CTS
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
* `npm run check:canonical-emitter`
