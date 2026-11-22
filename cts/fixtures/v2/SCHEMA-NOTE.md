# v2 Fixture Schema Note

The v2 draft uses the same fixture envelope as the active v1 CTS fixtures.

## Current Shape

Each v2 fixture should include:

- schemaVersion
- id
- specVersion
- mode
- source
- expected

Expected should include:

- ok (boolean)
- assertions (array of strings)
- errorCode for reject fixtures

Expected may also include:

- document (object) for successful fixtures when AST shape should be pinned

## Draft Compatibility

Field names and error-code taxonomy in this lane follow the draft grammar and AST contract.

Accepted fixture documents follow
[`docs/spec/v2/and-ast-contract.md`](../../../docs/spec/v2/and-ast-contract.md). The dedicated runner
also treats every accepted document as canonical-emitter and HTML-renderer input.
