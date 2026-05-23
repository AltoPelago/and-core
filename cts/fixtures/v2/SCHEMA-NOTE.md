# v2 Fixture Schema Note

This lane uses the same fixture envelope shape as the active v1 CTS fixtures while v2 remains in
proposal stage.

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

## Proposal Caveat

Field names and error-code taxonomy in this lane are still proposal-scoped and may evolve as v2
grammar and AST contracts stabilize.
