# AEON highlight renderer snapshot

`aeon-token-highlight.mjs` and `presentation-highlight.mjs` are unmodified copies
from `AltoPelago/aeon`, `implementations/typescript/packages/highlight/src/`,
revision `5b72ba9f484e0e6716b9c849df6e436578154b56` (MIT; see LICENSE).

The highlighter is not yet published on npm. This local snapshot keeps the
standalone playground independent of sibling checkouts. Its lexer is supplied
by the example's pinned `@altopelago/aeon-lexer` package. Standalone &ND v2 and
SANSA presentation are owned by `../highlighting.mjs`; the vendored documentation
comment renderer is not used as a standalone &ND v2 validator.
