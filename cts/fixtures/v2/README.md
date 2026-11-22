# v2 Draft CTS

This folder holds the executable fixtures for the `&ND Core v2` draft.

Current status:

- 176 fixtures (62 accept, 114 reject) cover promoted inline image, AEON
  scalar, tag, marker, footnote, heading, block-caption, formatted-paragraph, first-class todo/auto-number-list, and paired-block forms,
  including nested rich content and document-wide reference integrity
- `../../contracts/aeon-inline-scalar-v1.json` pins the complete typed-value datatype/alias list,
  which the scalar contract check uses to verify per-family AST, canonical, and HTML projections
  for explicit assignments and inferred shorthand
- `../../contracts/v2-projection-v1.json` pins 58 standalone/embedded canonical snapshots,
  30 inert HTML snapshots, 48 source-span assertions, and a 39-entry cross-form interaction
  matrix across all promoted families, nested containers, composition boundaries, and safety cases
- `npm run cts:run:v2` executes the lane in CI
- the v2 runner checks v1-header rejection, declared-v1 gating, v1-subset compatibility,
  headerless effective-version equivalence, canonical fixed points, HTML projection, nested
  contexts, resource budgets, and strict forward boundaries
- the normative v1 CTS runner remains separate
- lane metadata lives in `index.json`

Schema and field-shape guidance for this lane lives in `SCHEMA-NOTE.md`.

New fixtures belong under the versioned mode directories and must be linked from
`index.json`.
