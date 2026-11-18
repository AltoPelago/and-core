# SANSA query metadata API snapshot

This local, unpublished npm package is built with `npm pack --ignore-scripts`
from the SANSA checkout at `da76789aff29025affe180196e79ba5749c9e0a2`
plus the public query metadata accessor change in `src/query-metadata.js`,
`src/query-metadata.d.ts`, `package.json`, `docs/api-contract.md`, and `CHANGELOG.md`.
It includes the MIT license. No registry release or push was performed.

The example pins this snapshot so a clean standalone `npm ci` uses the public
`getQueryValueMetadata` and `getQueryObjectFieldMetadata` APIs without requiring
a sibling checkout or reading private properties. Replace the file dependency
with a released SANSA version once those APIs ship; the playground fails clearly
if the chosen runtime does not expose them. The source change and accessor tests
are retained in the SANSA repository.

Package integrity: `sha512-ggmrk+jeSSk3m94btKzf9g/fivDmz6xksO7OS9zi2vMk310L8QBv1UhbedxUkwFc0kV4yX9MzRZNSYSQynSkeg==`
