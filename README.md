# `and-core`

`and-core` is the standalone home for `&ND` (AEON Native Document): a deterministic,
fail-closed language for structured prose, with a reference parser, canonical emitter,
HTML renderer, playgrounds, editor tooling, and conformance tests.

> &ND is a pedantic prose language. Pronounced “amperand”… with a silent G.
> Markdown tries to be forgiving.
> &ND is not.

Both **v1 and v2 are draft**. Semantics may change before formal publication by
`aeonite-org`. Current work develops v2 while maintaining its v1 compatibility
boundary. See the [specification tracks](./docs/spec/README.md).

## Get started

Use Node.js 22, matching [CI](./.github/workflows/ci.yml). Run these commands from
the repository root; the root tools need no dependency installation.

```sh
npm test
npm run playground
```

`npm test` runs the main local checks. The playground opens at
<http://localhost:4173/playground/>. Stop its server with Ctrl+C.

The separate [&ND ↔ Aeon + SANSA workspace](./docs/tooling/playground.md) runs
on the same server at `/playground/semantic/` and needs its example dependencies
installed first. Its guide covers setup and focused checks.

## Common commands

| Command | Purpose |
| --- | --- |
| `npm run and -- check examples/minimal.and` | Validate a document with the local CLI. |
| `npm run and -- canonical examples/minimal.and --profile standalone` | Print canonical text. |
| `npm run precommit:check` | Run repository safety and public API checks. |
| `npm run cts:run:v2` | Run the dedicated v2 draft conformance lane. |

For CLI options, budgets, AST output, and HTML rendering, see the
[CLI guide](./docs/tooling/cli.md). For targeted checks and report regeneration,
see [Contributing](./CONTRIBUTING.md). The complete script list lives in
[`package.json`](./package.json).

## Find your way around

| Area | Start here |
| --- | --- |
| Language, AST, and public API contracts | [Specification tracks](./docs/spec/README.md): [v1](./docs/spec/v1/README.md), [v2](./docs/spec/v2/README.md) |
| Parser and emitter implementations | [Implementations](./implementations/README.md); root API in [`index.mjs`](./index.mjs) |
| Conformance fixtures and adapters | [CTS guide](./cts/README.md) and [fixture authoring](./cts/AUTHORING.md) |
| Examples and AEON interoperability | [Examples](./examples/README.md) |
| Browser playgrounds | [Playground guide](./docs/tooling/playground.md) |
| VS Code prototype | [Editor guide](./vscode/README.md) |
| HTML projection | [Renderer contract](./docs/tooling/html-renderer.md) |
| Development and maintenance | [Contributing](./CONTRIBUTING.md) |

Changes should keep the specification, fixtures, and implementation behavior
aligned. CI's exact checks are maintained in its [workflow](./.github/workflows/ci.yml).
