# Reference Subset Adapter

This directory contains the first executable `&ND` CTS adapter.

It is intentionally limited:

* it implements a strict subset of `&ND Core v1`
* it is designed to exercise the CTS interface early
* it is not yet a complete parser or canonical emitter

Current scope:

* selected block-boundary fixtures
* selected raw-block fixtures
* selected nesting fixtures
* selected inline fixtures
* selected rejection/error-code fixtures

Run it with:

```sh
node scripts/run-cts.mjs --adapter ./implementations/reference-subset/adapter.mjs
```

This adapter should be treated as a bootstrap implementation surface.
The long-term reference parser can replace it or evolve from it once the CTS expands.
