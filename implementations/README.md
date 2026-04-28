# `and-core` Implementations

This directory is reserved for `&ND` implementations.

Expected future contents include:

* reference parser implementations
* canonical emitters
* shared AST and diagnostic models
* editor-facing recovery-mode adapters

Current contents:

* `reference-subset/` — a small CTS-facing strict subset adapter used to bootstrap the runner

Recommended sequencing:

1. define CTS fixtures
2. implement a strict parser
3. implement canonical emission
4. add recovery and `forward_compat` modes only after strict behavior is CTS-backed
