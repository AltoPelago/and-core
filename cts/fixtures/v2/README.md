# v2 CTS Proposal Lane

This folder is reserved for `&ND Core v2` CTS fixtures while v2 remains in proposal stage.

Current status:

- 111 accept/reject proposal fixtures (43 accept, 68 reject) cover promoted inline image, AEON
  scalar, tag, marker, footnote, heading, first-class todo/auto-number-list, and paired-block forms,
  including nested rich content and document-wide reference integrity
- `../../contracts/aeon-inline-scalar-v1.json` pins the complete typed-value datatype/alias list,
  per-family AST, canonical, and HTML projections, annotation cases, and explicit exclusions
- `../../contracts/v2-projection-v1.json` pins 34 exact standalone/embedded canonical snapshots,
  18 inert HTML snapshots, 31 exact source-span assertions, and a 20-entry cross-form interaction
  matrix across all promoted families, nested containers, composition boundaries, and safety cases
- `npm run cts:run:v2:proposal` executes the lane in CI
- the proposal runner checks v1-header rejection, declared-v1 gating, v1-subset compatibility,
  headerless effective-version equivalence, canonical fixed points, HTML projection, nested
  contexts, resource budgets, and strict forward boundaries
- the normative v1 CTS runner remains separate
- lane metadata lives in `index.proposal.json`

Schema and field-shape guidance for this lane lives in `SCHEMA-NOTE.md`.

New proposal fixtures belong under the versioned mode directories and must be linked from
`index.proposal.json`.
