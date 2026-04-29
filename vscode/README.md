# `&ND` VS Code Prototype

This directory contains the first lexical VS Code support prototype for `&ND Core v1`.

Current scope:

* language registration for `.and`
* TextMate grammar for the current v1 lexical surface
* conservative language configuration for bracket and indentation behavior
* reserved-or-invalid highlighting for non-v1 inline tags such as `[x]`, `[_]`, and `[<]`
* sample token snapshots in `samples/` to keep scope coverage stable as the grammar evolves
* a parser-backed diagnostics adapter shape for future editor integration

This prototype is intentionally lexical only. Structural validity still belongs to the parser and
future language-server layer.

To try it locally:

1. Open this `vscode/` directory as a VS Code extension workspace.
2. Run the `Developer: Install Extension from Location...` flow or use the Extension Development Host.
3. Open an `.and` file and inspect the tokenization.

The sample file at `samples/reference.and` and its expectation manifest at
`samples/reference.tokens.json` act as the current lexical coverage target for the prototype.

The repository also exposes a parser-backed diagnostics shape that editors can consume today:

```sh
npm run and -- diagnostics path/to/file.and --json
```

It emits zero-based ranges, stable `errorCode` values, a fixed `source`, and one strict diagnostic
entry per failed parse.
