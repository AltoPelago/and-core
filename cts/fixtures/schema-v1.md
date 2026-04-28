# CTS Fixture Schema v1

The current fixture schema is intentionally minimal.

```json
{
  "schemaVersion": "1",
  "id": "seed-example",
  "specVersion": "&ND Core v1",
  "mode": "strict",
  "source": "raw input text",
  "expected": {
    "ok": true,
    "errorCode": "optional-on-failure",
    "assertions": [
      "human-readable structural expectations"
    ]
  }
}
```

## Notes

* `expected.ok = true` means parse success is required.
* `expected.ok = false` means parse failure is required.
* `errorCode` is used only when the spec names a stable error code.
* `assertions` are normative human-readable expectations extracted from the spec. The first CTS
  runner MAY treat them as descriptive, then progressively promote them into machine-checked
  structural checks.

This schema does not yet define a canonical AST interchange format.
That is deliberate: the first goal is consistent parser behavior, not premature AST lock-in.
