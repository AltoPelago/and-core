# Local &ND CLI

Run commands from the repository root through `npm run and --`. The CLI uses the
reference parser, canonical emitter, diagnostics, and HTML renderer exposed by
[`index.mjs`](../../index.mjs).

## Check and inspect documents

```sh
npm run and -- check examples/minimal.and
npm run and -- diagnostics examples/minimal.and --json
npm run and -- parse examples/minimal.and --json
npm run and -- parse examples/minimal.and --json --spans
```

`check` validates a document; `diagnostics` exposes parser-backed diagnostics.
`parse` emits the AST, with optional source spans. Failures include stable
`errorCode` values and line/column information where available.

The default parser is v1. Enable the v2 draft explicitly when checking a v2 document:

```sh
npm run and -- check path/to/proposal.and --version v2
```

The `--version v1|v2` option also applies to diagnostics, parsing, canonicalization,
and rendering. See the [v2 migration guide](../spec/v2/and-v1-to-v2-migration.md)
for version boundaries.

## Canonical text

```sh
npm run and -- canonical examples/minimal.and --profile standalone
npm run and -- canonical examples/minimal.and --profile embedded --out output.and
```

Canonicalization requires an explicit `standalone` or `embedded` profile. Without
`--out`, the CLI writes to standard output.

## HTML output

```sh
npm run and -- render-html examples/minimal.and
npm run and -- render-html examples/minimal.and --document --out output.html
npm run and -- render-html path/to/proposal.and --version v2 --image-base-url https://docs.example/guide/proposal.and
```

The default is an escaped HTML fragment; `--document` produces a complete document.
For v2 relative images, supply an explicit HTTP(S) document base with
`--image-base-url`. Rendering is a projection, with its own
[renderer contract](./html-renderer.md).

## Parser budgets

Use repeatable `--budget name=value` options with nonnegative integer values:

```sh
npm run and -- check examples/minimal.and --budget maxLineLength=120 --budget maxNestingDepth=16
```

Supported names are `maxDocumentSize`, `maxLineLength`, `maxNestingDepth`,
`maxInlineDepth`, `maxTableColumns`, `maxBlockSize`, `maxBlockCount`,
`maxListItemCount`, and `maxLinkTargetLength`. The same options apply to the other
CLI commands. These are parser limits, not formatting settings.
