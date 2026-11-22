# &ND Core v2 Draft

The reference implementation supports explicit v2 selection, canonical output, HTML projection,
and v1 document compatibility. The v2 CTS checks accepted and rejected inputs, AST shape, and
projection behavior.

- [Core v2 draft](https://github.com/aeonite-org/aeonite-specs/blob/main/sources/and/v2/and-core-v2.aeon) defines the language syntax and version boundary.
- [AST contract](./and-ast-contract.md) defines the v2 nodes and canonical output.
- [Public API](./and-public-api.md) covers parser options, diagnostics, and projection.
- [Migration guide](./and-v1-to-v2-migration.md) explains the changes from v1.
- [Consumer conventions](./and-consumer-conventions.md) covers behavior owned by integrations.
- [V2 CTS](../../../cts/fixtures/v2/README.md) lists the executable fixtures and how to run them.
- [First-draft readiness audit](./and-core-v2-first-draft-readiness.md) records the promotion evidence.
