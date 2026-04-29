# CTS Fixture Schema v1

The current fixture schema is intentionally minimal.

```json
{
  "schemaVersion": "1",
  "id": "seed-example",
  "specVersion": "&ND Core v1",
  "mode": "strict",
  "options": {
    "budgets": {
      "maxLinkTargetLength": 32
    }
  },
  "source": "raw input text",
  "expected": {
    "ok": true,
    "errorCode": "optional-on-failure",
    "assertions": [
      "human-readable structural expectations"
    ],
    "document": {
      "type": "document",
      "children": []
    },
    "spans": [
      {
        "path": "$.children[0]",
        "span": {
          "startOffset": 0,
          "endOffset": 7,
          "startLine": 1,
          "startColumn": 1,
          "endLine": 1,
          "endColumn": 8
        }
      }
    ]
  }
}
```

## Notes

* `expected.ok = true` means parse success is required.
* `expected.ok = false` means parse failure is required.
* `options` is optional and carries parser configuration relevant to the fixture.
* `errorCode` is required when `expected.ok = false` and MUST name the stable diagnostic code
  expected from conforming parsers.
* `assertions` are normative human-readable expectations extracted from the spec. The first CTS
  runner MAY treat them as descriptive, then progressively promote them into machine-checked
  structural checks.
* `document` is optional and valid only when `expected.ok = true`. It defines an exact structural
  document expectation for adapters that declare `document` capability. The shape is defined by
  [`and-ast-contract.md`](../../docs/spec/v1/and-ast-contract.md).
* `spans` is optional and valid only when `expected.ok = true`. It defines selected source-span
  expectations for adapters that declare `spans` capability. `path` selects a node within the
  returned document AST using `$`, dot properties, and numeric array indexes such as
  `$.children[0].header[1].children[0]`.

The schema now supports a small exact AST expectation surface so conformance can move beyond
accept/reject behavior. Adapters that do not yet expose a document AST may still run the fixtures,
but the CTS runner marks those document checks as skipped rather than silently asserting them.
Span expectations are metadata checks and are reported separately from semantic document checks.
