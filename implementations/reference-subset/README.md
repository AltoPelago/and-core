# Reference Subset Adapter

This directory contains the first executable `&ND` CTS adapter.

It is intentionally limited:

* it implements a strict subset of `&ND Core v1`
* it is designed to exercise the CTS interface early
* it is not yet a complete parser or canonical emitter

Current scope:

* selected block-boundary fixtures
* selected ordered-list sequence fixtures
* selected raw-block fixtures
* selected ordered-code-block fixtures
* selected extension fallback locality fixtures
* selected nesting fixtures
* selected list paragraph-continuation fixtures
* selected inline fixtures
* resource-budget smoke fixtures, including inclusive at-limit and over-budget cases
* selected rejection/error-code fixtures

Run it with:

```sh
node scripts/run-cts.mjs --adapter ./implementations/reference-subset/adapter.mjs
```

This adapter should be treated as a bootstrap implementation surface.
The long-term reference parser can replace it or evolve from it once the CTS expands.
