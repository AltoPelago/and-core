# v2 CTS Proposal Lane

This folder is reserved for `&ND Core v2` CTS fixtures while v2 remains in proposal stage.

Current status:

- first-slice v2 proposal fixtures are now authored for anchor and line-break markers
- no v2 fixtures are executed by the default CTS runner
- lane metadata lives in `index.proposal.json`

Schema and field-shape guidance for this lane lives in `SCHEMA-NOTE.md`.

When v2 seeds become stable enough for repeatable checks, fixtures should be added under versioned
mode directories and linked from `index.proposal.json`.
