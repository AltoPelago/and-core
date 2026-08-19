# v2 CTS Proposal Lane

This folder is reserved for `&ND Core v2` CTS fixtures while v2 remains in proposal stage.

Current status:

- 78 accept/reject proposal fixtures cover promoted inline, marker, heading, and paired-block forms
- `npm run cts:run:v2:proposal` executes the lane in CI
- the proposal runner checks v1-header rejection, declared-v1 gating, and v1-subset compatibility
- the normative v1 CTS runner remains separate
- lane metadata lives in `index.proposal.json`

Schema and field-shape guidance for this lane lives in `SCHEMA-NOTE.md`.

New proposal fixtures belong under the versioned mode directories and must be linked from
`index.proposal.json`.
