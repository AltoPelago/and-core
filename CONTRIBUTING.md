# Contributing

`and-core` is spec-and-CTS first. Changes should keep the language prose, machine-readable
fixtures, and implementation behavior moving together.

## Development Loop

Use the full local check before opening or updating a PR:

```sh
npm test
```

This runs repository safety checks plus both CTS adapters.

For a faster documentation-only check:

```sh
npm run precommit:check
```

## Spec Changes

When changing normative language in `docs/spec/v1/and-core-proposal.md`:

1. Add or update named conformance seeds in the spec.
2. Add or update matching fixtures under `cts/fixtures/`.
3. Update `cts/fixtures/index.json`.
4. Update the reference parser if the behavior is implementation-covered.
5. Regenerate report artifacts when expected output changes.

The seed coverage check fails when named spec seeds and indexed CTS fixtures drift apart.

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

Regenerate CTS reports with:

```sh
npm run cts:report:reference
npm run cts:report:subset
```

Reports are execution artifacts, not normative definitions. The fixture suite and spec seeds remain
the source of truth.
