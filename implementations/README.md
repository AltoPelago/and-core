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
* `reference-canonical/` — the first canonical-emission scaffold for the current CTS AST contract

Recommended sequencing:

1. keep strict parser behavior covered by CTS fixtures
2. expand the reference parser toward complete v1 coverage
3. implement canonical emission from the AST contract
4. add recovery and `forward_compat` modes only after strict behavior is CTS-backed
