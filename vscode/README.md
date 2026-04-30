# `&ND` VS Code Prototype

This directory contains the first lexical VS Code support prototype for `&ND Core v1`.

Current scope:

* language registration for `.and`
* TextMate grammar for the current v1 lexical surface
* conservative language configuration for bracket and indentation behavior
* reserved-or-invalid highlighting for non-v1 inline tags such as `[x]`, `[_]`, and `[<]`
* sample token snapshots in `samples/` to keep scope coverage stable as the grammar evolves
* a parser-backed diagnostics adapter shape for future editor integration
* a minimal extension entrypoint that publishes strict parser diagnostics live for `.and` documents
* first-pass quick fixes for a few stable strict-mode errors
* first-pass hovers that explain a few common diagnostics and reserved non-v1 syntax
* first-pass completions for common structural starters, with light context awareness

This prototype is still intentionally lightweight. Tokenization is lexical, while structural
validity comes from the parser-backed diagnostics adapter rather than a full language server.

For a dependency-free local install bundle, run:

```sh
npm run vscode:package
```

This stages an unpacked extension bundle under `artifacts/and-vscode-<version>/` that can be used
with VS Code's `Developer: Install Extension from Location...` flow.

To try it locally:

1. Open the repository root in VS Code.
2. Run the `Run &ND VS Code Prototype` launch config from `.vscode/launch.json`.
3. In the Extension Development Host, open `vscode/samples/reference.and` to inspect highlighting.
4. Open `vscode/samples/diagnostics-demo.and` to see strict parser diagnostics surface live.
5. Use the lightbulb / quick-fix action on supported diagnostics to apply a local repair.
6. Hover supported diagnostics or reserved inline tokens to see brief Core v1 guidance.
7. Trigger completions on empty lines to insert common document structures quickly.
8. Notice that `+++fallback` is only suggested immediately after an extension block, and inline snippets are suppressed inside opaque raw payloads.

For a direct local install instead of the dev host:

1. Run `npm run vscode:package`.
2. In VS Code, use `Developer: Install Extension from Location...`.
3. Select the staged folder under `artifacts/and-vscode-<version>/`.

The sample file at `samples/reference.and` and its expectation manifest at
`samples/reference.tokens.json` act as the current lexical coverage target for the prototype.
The companion file at `samples/diagnostics-demo.and` is intentionally invalid and exists to make
the diagnostics path easy to exercise during local extension development.

The repository also exposes a parser-backed diagnostics shape that editors can consume today:

```sh
npm run and -- diagnostics path/to/file.and --json
```

It emits zero-based ranges, stable `errorCode` values, a fixed `source`, and one strict diagnostic
entry per failed parse.

The extension prototype now uses that same diagnostics surface directly from `extension.cjs` and
publishes errors through a VS Code `DiagnosticCollection` on open, change, and save.

Current quick fixes:

* replace an invalid header with `&ND v1`
* insert a blank line before a block opener that illegally continues a paragraph
* insert a blank line before a nested block that requires structural separation

Current hover guidance:

* explanations for a few common strict parser diagnostics such as `invalid_header`
* explanations for reserved or unassigned Core v1 inline tokens such as `[x]`, `[_]`, `[<]`, and `[# ...]`

Current completions:

* `&ND v1` header completion on the first empty line
* empty-line structure starters for headings, lists, blockquotes, code fences, and extension blocks
* `+++fallback` only when the current position is immediately after a closed extension block
* inline completions for `strong`, `emphasis`, links, and inline code
* inline completions suppressed inside opaque code-block and extension payload regions
* block-starter completions suppressed when typing them would immediately continue a paragraph without the required blank-line separation
