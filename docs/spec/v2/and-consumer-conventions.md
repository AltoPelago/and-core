# &ND Core v2 Consumer-Conventions Boundary

## Status And Purpose

This proposal-stage companion note separates the fixed `&ND Core v2` language contract from meanings
that belong to applications, rendering profiles, workflow systems, and trust policies.

“Consumer-owned” does not mean optional grammar. Core always parses the listed forms into stable AST
fields and emits their canonical spelling. It means Core does not standardize the vocabulary,
presentation, workflow effect, network behavior, or execution policy layered on those fields.

## Ownership Rule

A conforming consumer must apply this order:

1. Parse and validate the document under its declared or host-selected Core version.
2. Retain the Core AST without reinterpreting its fields.
3. Apply an explicitly selected consumer convention or product policy.

A consumer registry must not make otherwise-invalid Core syntax valid, reject valid Core syntax as a
parse error, rewrite Core canonical text, or infer the document grammar version.

## Supported Convention Surfaces

| Surface | Core guarantees | Consumer owns |
| :------ | :-------------- | :------------ |
| `[! ...]` | `admonition_tag` with rich inline `children` | Severity vocabulary, colors, icons, labels, accessibility phrasing, and workflow effects |
| `[? ...]` | `question_tag` with rich inline `children` | Whether it is a question, hint, review request, expandable help, or task prompt in a product |
| `- [?] ...` / `- [!] ...` | Stable advisory kind plus leading-unordered-item bullet-replacement intent; item content stays visible | Marker glyphs, labels, colors, and list styling |
| `~~~?` / `~~~!` | Visible rich hint/question or attention/admonition paragraph structure | Iconography, severity vocabulary, colors, layout, and accessibility phrasing |
| `~~~'` | Preserved rich `comment_block` children | Visibility, reviewer identity, export/redaction policy, and collaboration workflow |
| `[^ ...]` / `~~~^` | Rich inline or block disclaimer content | Exact size, placement, color, and accessibility presentation |
| `~~~#` | Rich header-text content | Exact weight, size, placement, and relationship to a preceding heading |
| `[(id) content]` / `~~~(id)` | Portable `id` plus rich children; the reference HTML exposes only content | ID vocabulary, semantic interpretation, alternate styling, and product behavior |
| `[+ value]` | `plus_tag` with one preserved scalar `value` | Value registry, action mapping, analytics, workflow, and UI |
| Custom `[:type = scalar]` | Structured datatype label/adornments and a validated inline scalar | Datatype registry, domain validation, units, display formatting, and business meaning |
| heading `[n]` and `auto_number_list` | Stable contextual auto-number intent | Number sequence, scope, format, restart rules, localization, and displayed labels |
| Footnote definitions and references | Rich definition content, optional authored ID, declaration order, and reference resolution | Superscript numbers or symbols, hover/callout/endnote presentation, placement, backlinks, and accessibility phrasing |
| `[~ source | alt | mode]` | Preserved source and alt text plus `inline`/`half`/`full` display intent | Base resolution, fetching, caching, MIME validation, intrinsic dimensions, layout details, and failure UI |
| External `[@ target | label]` | Preserved target and rich label under inherited link syntax | Allowed schemes, navigation, new-window behavior, redirects, previews, tracking, and trust prompts |
| `+++name` extension blocks | Opaque inherited extension name and payload | Extension registry, interpretation, sandboxing, permissions, and any execution |
| `todo_list` / `todo_item` | First-class list structure and stable item-state enum | Controls, mutation workflow, progress calculation, icons, labels, and persistence |
| Directional markers | Stable direction enum and leading-unordered-item bullet-replacement intent | Navigation or workflow meaning, arrow styling, labels, and interaction |
| Inline comments | Preserved rich `comment_tag` children | Visibility, reviewer identity, export policy, redaction, and collaboration workflow |

Local anchors are different: Core owns their identifier grammar, uniqueness, case-sensitive matching,
and full-document fragment resolution. A consumer owns scrolling, focus, history updates, and other
navigation UI after resolution succeeds.

Inline `[? ...]` and `[! ...]` content may be projected as hover/focus callouts, always-visible
annotations, review affordances, or another accessible UI. Core does not require the literal labels
“hint” or “warning.” The reference playground uses focusable circled `?` and `!` controls and calls
the broad `!` category “Attention”; that projection is illustrative, not additional grammar.

## No Implicit Vocabulary

Core does not assign special meaning to values such as:

```and
[+ priority:high]
[! security]
[^ legal text]
[:temperature = 21.5]
```

A product may define those conventions, but it must identify the selected convention separately from
the Core document. Another product may preserve the same AST while presenting it differently or not
acting on it at all.

Convention identifiers and registries are intentionally outside the first v2 Core draft. If an
ecosystem later standardizes one, it should be versioned independently and must not silently change
the underlying Core grammar.

## Numbering

Heading `[n]` and `auto_number_list` record author intent only. Core does not calculate a number.
Consumers should define, at minimum:

- the nodes participating in one sequence;
- document-wide versus container-local scope;
- restart and nesting rules;
- decimal, alphabetic, symbolic, or localized formatting;
- whether hidden or filtered nodes consume a number.

Calculated numbers belong to a projection or derived model and must not be written into the Core AST
as though they were parsed source.

## Footnotes

Core distinguishes anonymous definitions, named definitions, and references to already-declared
named definitions. The authored ID is an identity key, not a requested display label. A consumer may
render footnotes as numeric or symbolic superscripts, hover details, callouts, document-end notes, or
another accessible projection. It owns sequence scope, label choice, placement, backlinks, and the
behavior of repeated references. Those choices must not change reference resolution or rewrite the
Core AST as though calculated labels appeared in source.

## Images

The three image modes are portable display intents, not exact CSS geometry:

- `inline`: align image height with surrounding text;
- `half`: request half the source's original height;
- `full`: request the source's original height.

When intrinsic height is unknown or unavailable, the consumer defines the fallback. Core does not
read files, perform network requests, authenticate, inspect image bytes, or determine safety. The
reference HTML renderer's URL filtering and `imageBaseUrl` option are a non-normative projection
policy, not additional Core semantics.

Alt text remains mandatory even when a source is rejected or cannot be loaded. Consumers should keep
that text available to accessibility and failure-state UI.

## Links And External Resources

Core distinguishes resolved document-local `#id` targets from other link targets. For external
targets, a consumer must define an allowlist or equivalent navigation policy before making a link
active. Parsing a target does not establish that it is safe, reachable, trustworthy, or appropriate
to open.

The `[+]` tag may describe an external resource in a consumer vocabulary, but it is not a substitute
for Core link syntax and must not acquire implicit navigation behavior merely from its value.

## Extensions And Execution

Core documents are non-executable. Opaque extension blocks preserve forward-compatible data; they do
not authorize evaluation. A consumer that interprets or executes an extension must use an explicit
registry and trust policy, isolate effects, validate payloads, and obtain any permissions required by
its environment.

Unknown extensions remain data. Unknown `[+]` values and custom datatypes must likewise remain
preservable without triggering behavior.

Semantic wrapper IDs are also inert data until a consumer explicitly interprets them. The reference
HTML projection intentionally emits no visible ID, DOM `id`, class, or `data-*` attribute for either
semantic form; consumers that opt into a vocabulary may choose a different projection.

## Conformance Boundary

Core conformance covers:

- acceptance and rejection under the selected grammar version;
- AST node types and fields;
- local-anchor integrity;
- canonical spelling;
- source spans and resource budgets where requested.

Consumer-convention conformance, if defined by another profile, covers only behavior after a valid
Core parse. It must be tested and versioned separately. The inert reference HTML projection is useful
evidence of one safe rendering approach, but its class names, styling, and interaction behavior are
not normative Core requirements.
