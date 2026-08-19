# `and-core` Implementations

This directory contains `&ND` implementations and implementation-facing adapters.

Expected contents include:

* reference parser implementations
* canonical emitters
* shared AST and diagnostic models
* editor-facing recovery-mode adapters

Current contents:

* `reference-subset/` — a small CTS-facing strict subset adapter used to bootstrap the runner
* `reference-parser/` — the first parser-shaped implementation, currently guarded by the CTS
* `reference-canonical/` — canonical v1 and proposal-v2 emission from the current AST contracts
* `reference-html/` — inert v1 and proposal-v2 AST-to-HTML projection used by tooling such as the playground

Recommended sequencing:

1. keep strict parser behavior covered by CTS fixtures
2. keep v1-as-a-subset-of-v2 behavior guarded by version-boundary checks
3. keep canonical and HTML projections aligned with the executable AST contracts
4. promote proposal behavior only after strict parsing and fixed-point emission are CTS-backed
5. add recovery and `forward_compat` modes only after their strict boundaries are explicit
