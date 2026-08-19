# v2 CTS Proposal Lane

This folder is reserved for `&ND Core v2` CTS fixtures while v2 remains in proposal stage.

Current status:

- 94 accept/reject proposal fixtures cover promoted inline image, AEON scalar, tag, marker, heading, and paired-block forms,
  including nested rich inline content and document-local fragment-link integrity
- `../../contracts/aeon-inline-scalar-v1.json` pins the complete typed-value datatype/alias list,
  per-family AST, canonical, and HTML projections, annotation cases, and explicit exclusions
- `../../contracts/v2-projection-v1.json` pins exact standalone/embedded canonical text and inert
  HTML for all promoted node families, marker states, image modes, nested composition, and safety cases
- `npm run cts:run:v2:proposal` executes the lane in CI
- the proposal runner checks v1-header rejection, declared-v1 gating, v1-subset compatibility,
  headerless effective-version equivalence, canonical fixed points, HTML projection, nested
  contexts, resource budgets, and strict forward boundaries
- the normative v1 CTS runner remains separate
- lane metadata lives in `index.proposal.json`

Schema and field-shape guidance for this lane lives in `SCHEMA-NOTE.md`.

New proposal fixtures belong under the versioned mode directories and must be linked from
`index.proposal.json`.
