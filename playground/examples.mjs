export const examples = {
  v1: {
    version: 'v1',
    source: `&ND v1

+++document/meta
title = "Hello World"
author = "Patrik"
date = 2026-04-01
+++

# Playground

This is [* deterministic] prose with [/ visible structure].

\`\`\`aeon
title = "Playground"
mode = "strict"
\`\`\`

\`\`\`\`aeon
title = "Playground"
mode = "ordered"
\`\`\`\`

- Parse strict documents

  > Inspect spans and canonical output

| Name | Note |
| --- | --- |
| &ND | escaped \\| pipe |
`,
  },
  v2: {
    version: 'v2',
    source: `&ND v2

# [n] v2 capabilities

[# overview]Tasks: [ ] draft, [x] parser, [,] documentation, [;] abandoned.

Flow [>] publish and [<] revise.[.]Typed value: [:date 2026-08-19].

Use [= highlighted], [- retired], [_ underlined], and [" quoted] text.

~~~=
This is a highlighted paragraph with [! proposal] status.
~~~=

===hero
Header text can carry a validated tag.
===

***notice
v2 remains proposal-stage.
***
`,
  },
};
