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

~~~aeon
title = "Playground"
mode = "strict"
~~~

~~~~aeon
title = "Playground"
mode = "ordered"
~~~~

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

- [n] first numbered item
- [n] second numbered item
  - [n] nested numbered item

## [n] Numbered subsection

\\# This is literal heading text, not a heading

[# overview]Tasks:

- [ ] draft
- [x] parser
- [,] documentation
- [;] abandoned

Directional steps:

- [>] advance, while [<] still works inline
- [<] revisit, while [>] still works inline

Advisory items:

- [?] this is a visible hint item
- [!] this item asks for attention

Jump to [@ #overview | overview].

Footnotes can be anonymous [% supporting context] or named [% (A1) reusable context], then reused [% (A1)].

Flow [>] publish and [<] revise.[.]Typed value: [:date = 2026-08-20].

Inline image: [~ ./image-example.svg | Ampersand ND sample].

Rich content nests: [= highlighted with [* emphasis]], [- retired [/ wording]],
[_ underlined], and [" quoted [* text]].

Hello world [? used to describe the most basic way to print text in a programming language].
Review this carefully [! proposal syntax can still change].
Inline disclaimer: [^ this text is typically shown smaller].
Semantic inline content appears [(consumer-term) like ordinary rich text] by default.

~~~=
This is a highlighted paragraph with [! proposal] status.
~~~=

~~~*
This entire paragraph is strong, with [/ nested emphasis].
~~~*

~~~/
This entire paragraph is emphasized, with [* nested strong].
~~~/

~~~_
This entire paragraph is underlined, with [? rich content].
~~~_

~~~?
This paragraph is a visible hint with [* rich content].
~~~?

~~~!
This paragraph calls for attention, with [/ rich content].
~~~!

~~~'
This block comment is preserved but hidden from the preview.
~~~'

~~~(consumer-tone)
This semantic block appears like an ordinary paragraph unless the consumer interprets its ID.
~~~

~~~#
This is header text and appears slightly stronger than body text.
~~~#

~~~^
v2 remains proposal-stage.
~~~
`,
  },
};
