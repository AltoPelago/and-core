# &ND Core v1

This folder contains the current `&ND Core v1` specification bundle.

## Documents

- [`and-core-proposal.md`](./and-core-proposal.md)
  Normative core language specification for `&ND Core v1`, including parsing model, security
  limits, grammar summary, and conformance seeds.
- [`and-canonical-rules.md`](./and-canonical-rules.md)
  Canonical serialization rules for `&ND Core v1`.
- [`and-ast-contract.md`](./and-ast-contract.md)
  CTS AST interchange contract for `expected.document` fixtures, including stable node fields and
  provisional areas.
- [`and-vscode-support.md`](./and-vscode-support.md)
  Visual Studio Code support proposal covering highlighting, language configuration, diagnostics,
  and embedded-language support.
- [`and-implementation-guide.md`](./and-implementation-guide.md)
  Non-normative implementation guide covering parser architecture, scanners, AST design, budgets,
  canonical emission, and conformance strategy.
- [`and-public-api.md`](./and-public-api.md)
  Non-normative plan for promoting the current reference entrypoints into a stable consumer package
  surface.
- [`fmt-and-reference.md`](./fmt-and-reference.md)
  Non-normative proposal for the future AES-facing `fmt.and.aes` / `fmt.and.aeon` node vocabulary
  and model boundary.

## Suggested Reading Order

1. [`and-core-proposal.md`](./and-core-proposal.md)
2. [`and-canonical-rules.md`](./and-canonical-rules.md)
3. [`and-ast-contract.md`](./and-ast-contract.md)
4. [`and-implementation-guide.md`](./and-implementation-guide.md)
5. [`and-public-api.md`](./and-public-api.md)
6. [`fmt-and-reference.md`](./fmt-and-reference.md)
7. [`and-vscode-support.md`](./and-vscode-support.md)

## By Goal

If you want to understand the language:

1. [`and-core-proposal.md`](./and-core-proposal.md)
2. [`and-canonical-rules.md`](./and-canonical-rules.md)

If you want to implement a parser:

1. [`and-core-proposal.md`](./and-core-proposal.md)
2. [`and-implementation-guide.md`](./and-implementation-guide.md)
3. [`and-ast-contract.md`](./and-ast-contract.md)

If you want to implement canonical emission:

1. [`and-canonical-rules.md`](./and-canonical-rules.md)
2. [`and-implementation-guide.md`](./and-implementation-guide.md)
3. [`and-ast-contract.md`](./and-ast-contract.md)

If you want to connect `&ND` into the AES ecosystem:

1. [`and-public-api.md`](./and-public-api.md)
2. [`fmt-and-reference.md`](./fmt-and-reference.md)
3. [`and-ast-contract.md`](./and-ast-contract.md)

If you want to work on editor support:

1. [`and-vscode-support.md`](./and-vscode-support.md)
2. [`and-implementation-guide.md`](./and-implementation-guide.md)

## Scope

Together, these documents define:

- the core `&ND` language
- its parse-mode model (`strict`, `recovery`, and `forward_compat`)
- its canonical text form
- its CTS AST interchange shape
- its recommended implementation strategy
- its intended IDE/editor support model
