'use strict';

const path = require('node:path');
const vscode = require('vscode');

let diagnosticsModulePromise = null;
const QUICK_FIX_KIND = vscode.CodeActionKind.QuickFix;

function isAndDocument(document) {
  return document?.languageId === 'and' || document?.fileName?.endsWith('.and');
}

function diagnosticsModule() {
  if (diagnosticsModulePromise === null) {
    const modulePath = path.join(__dirname, '..', 'implementations', 'reference-parser', 'diagnostics.mjs');
    diagnosticsModulePromise = import(modulePath);
  }
  return diagnosticsModulePromise;
}

async function publishDiagnostics(collection, document) {
  if (!isAndDocument(document)) return;

  const { collectDiagnostics } = await diagnosticsModule();
  const result = collectDiagnostics(document.getText());
  const diagnostics = result.diagnostics.map((entry) => {
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(
        entry.range.start.line,
        entry.range.start.character,
        entry.range.end.line,
        entry.range.end.character
      ),
      entry.message,
      vscode.DiagnosticSeverity.Error
    );
    diagnostic.code = entry.code;
    diagnostic.source = entry.source;
    return diagnostic;
  });

  collection.set(document.uri, diagnostics);
}

function clearDiagnostics(collection, document) {
  if (!isAndDocument(document)) return;
  collection.delete(document.uri);
}

function diagnosticExplanation(code) {
  switch (code) {
    case 'invalid_header':
      return 'The first line must be exactly `&ND v1` in strict Core v1 documents.';
    case 'block_opener_on_paragraph_continuation':
      return 'A block opener cannot continue a paragraph directly. Insert a blank line before the new block.';
    case 'missing_blank_line_before_nested_block':
      return 'Nested blocks are structural in `&ND`. Insert a blank line before the nested block and keep exact margin alignment.';
    case 'unknown_inline_type':
      return 'This inline tag is not part of Core v1. Reserved tags stay fail-closed unless a future version adopts them.';
    case 'invalid_extension_name':
      return 'Extension names must be lowercase and use the strict `+++name` form.';
    case 'orphan_fallback_block':
      return 'A `+++fallback` block only applies to the immediately preceding extension block, with no blank line or intervening block.';
    default:
      return null;
  }
}

function reservedSyntaxHover(lineText, positionCharacter) {
  const patterns = [
    {
      token: '[x]',
      message: '`[x]` is reserved in Core v1 and is currently invalid. Use normal prose or a future extension/versioned feature instead.',
    },
    {
      token: '[_]',
      message: '`[_]` is not assigned in Core v1 and is currently invalid.',
    },
    {
      token: '[<]',
      message: '`[<]` is not assigned in Core v1 and is currently invalid.',
    },
    {
      token: '[#',
      message: '`[# ...]` is reserved in Core v1 and is currently invalid.',
    },
  ];

  for (const pattern of patterns) {
    const index = lineText.indexOf(pattern.token);
    if (index !== -1 && positionCharacter >= index && positionCharacter < index + pattern.token.length) {
      return pattern.message;
    }
  }

  return null;
}

function createReplaceHeaderAction(document, diagnostic) {
  const action = new vscode.CodeAction('Replace with "&ND v1" header', QUICK_FIX_KIND);
  const edit = new vscode.WorkspaceEdit();
  const firstLine = document.lineAt(0);
  edit.replace(document.uri, firstLine.range, '&ND v1');
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

function createInsertBlankLineAction(document, diagnostic, title) {
  const action = new vscode.CodeAction(title, QUICK_FIX_KIND);
  const edit = new vscode.WorkspaceEdit();
  const position = new vscode.Position(diagnostic.range.start.line, 0);
  edit.insert(document.uri, position, '\n');
  action.edit = edit;
  action.diagnostics = [diagnostic];
  action.isPreferred = true;
  return action;
}

function codeActionsForDiagnostic(document, diagnostic) {
  if (!diagnostic?.code || !isAndDocument(document)) return [];

  switch (diagnostic.code) {
    case 'invalid_header':
      if (document.lineCount === 0) return [];
      return [createReplaceHeaderAction(document, diagnostic)];
    case 'block_opener_on_paragraph_continuation':
      return [createInsertBlankLineAction(document, diagnostic, 'Insert blank line before block opener')];
    case 'missing_blank_line_before_nested_block':
      return [createInsertBlankLineAction(document, diagnostic, 'Insert blank line before nested block')];
    default:
      return [];
  }
}

function registerCodeActions(context) {
  const provider = vscode.languages.registerCodeActionsProvider(
    { language: 'and' },
    {
      provideCodeActions(document, _range, context) {
        return context.diagnostics.flatMap((diagnostic) => codeActionsForDiagnostic(document, diagnostic));
      },
    },
    {
      providedCodeActionKinds: [QUICK_FIX_KIND],
    }
  );

  context.subscriptions.push(provider);
}

function registerHoverSupport(context) {
  const provider = vscode.languages.registerHoverProvider({ language: 'and' }, {
    provideHover(document, position) {
      const lineText = document.lineAt(position.line).text;
      const diagnostics = vscode.languages
        .getDiagnostics(document.uri)
        .filter((diagnostic) => diagnostic.range.contains(position));

      for (const diagnostic of diagnostics) {
        const explanation = diagnosticExplanation(diagnostic.code);
        if (explanation !== null) {
          return new vscode.Hover(new vscode.MarkdownString(`**${diagnostic.code}**\n\n${explanation}`));
        }
      }

      const reserved = reservedSyntaxHover(lineText, position.character);
      if (reserved !== null) {
        return new vscode.Hover(new vscode.MarkdownString(reserved));
      }

      return null;
    },
  });

  context.subscriptions.push(provider);
}

function snippetCompletion(label, detail, snippet, options = {}) {
  const item = new vscode.CompletionItem(label, options.kind ?? vscode.CompletionItemKind.Snippet);
  item.detail = detail;
  item.insertText = new vscode.SnippetString(snippet);
  item.documentation = options.documentation ? new vscode.MarkdownString(options.documentation) : undefined;
  return item;
}

function addInlineCompletions(items) {
  items.push(
    snippetCompletion('[* strong]', 'Strong inline content', '[* ${1:text}]', {
      documentation: 'Insert a Core v1 `strong` inline node.',
    }),
    snippetCompletion('[/ emphasis]', 'Emphasis inline content', '[/ ${1:text}]', {
      documentation: 'Insert a Core v1 `emphasis` inline node.',
    }),
    snippetCompletion('[@ link | label]', 'Link inline content', '[@ ${1:https://example.com} | ${2:label}]', {
      documentation: 'Insert a Core v1 link with explicit target and non-empty label.',
    }),
    snippetCompletion('[$ code]', 'Inline code', '[$ ${1:code}]', {
      documentation: 'Insert a Core v1 inline code span.',
    })
  );
}

function isRawFenceLine(text) {
  return /^```/.test(text.trim());
}

function isExtensionFenceLine(text) {
  return /^\+\+\+/.test(text.trim());
}

function isFallbackFenceLine(text) {
  return text.trim() === '+++fallback';
}

function isBlockStarterLine(text) {
  const trimmed = text.trim();
  return (
    /^# /.test(trimmed) ||
    /^- /.test(trimmed) ||
    /^\d+\. /.test(trimmed) ||
    /^> /.test(trimmed) ||
    /^```/.test(trimmed) ||
    /^````/.test(trimmed) ||
    /^\+\+\+/.test(trimmed)
  );
}

function scanDocumentContext(document, upToLineExclusive) {
  let rawMode = null;
  let lastClosedBlockType = null;
  let blankAfterLastClosedBlock = false;

  for (let index = 0; index < upToLineExclusive; index += 1) {
    const trimmed = document.lineAt(index).text.trim();

    if (rawMode === 'code') {
      if (trimmed === '```' || trimmed === '````') {
        rawMode = null;
        lastClosedBlockType = 'code';
        blankAfterLastClosedBlock = false;
      }
      continue;
    }

    if (rawMode === 'extension') {
      if (trimmed === '+++') {
        rawMode = null;
        lastClosedBlockType = 'extension';
        blankAfterLastClosedBlock = false;
      }
      continue;
    }

    if (trimmed.length === 0) {
      if (lastClosedBlockType !== null) {
        blankAfterLastClosedBlock = true;
      }
      continue;
    }

    if (isRawFenceLine(trimmed)) {
      rawMode = 'code';
      lastClosedBlockType = null;
      blankAfterLastClosedBlock = false;
      continue;
    }

    if (isExtensionFenceLine(trimmed) && trimmed !== '+++') {
      rawMode = 'extension';
      lastClosedBlockType = null;
      blankAfterLastClosedBlock = false;
      continue;
    }

    lastClosedBlockType = null;
    blankAfterLastClosedBlock = false;
  }

  return {
    rawMode,
    canOfferFallback: rawMode === null && lastClosedBlockType === 'extension' && blankAfterLastClosedBlock === false,
  };
}

function previousNonEmptyLineInfo(document, lineIndex) {
  for (let index = lineIndex - 1; index >= 0; index -= 1) {
    const text = document.lineAt(index).text;
    if (text.trim().length > 0) {
      return {
        line: index,
        text,
      };
    }
  }

  return null;
}

function canOfferBlockStarters(document, position, linePrefix, context) {
  if (context.rawMode !== null) return false;
  if (!/^\s*$/.test(linePrefix)) return false;

  const previous = previousNonEmptyLineInfo(document, position.line);
  if (previous === null) return true;

  if (position.line - previous.line > 1) return true;

  return isBlockStarterLine(previous.text);
}

function registerCompletions(context) {
  const provider = vscode.languages.registerCompletionItemProvider(
    { language: 'and' },
    {
      provideCompletionItems(document, position) {
        const linePrefix = document.lineAt(position.line).text.slice(0, position.character);
        const items = [];
        const context = scanDocumentContext(document, position.line);

        if (position.line === 0 && linePrefix.trim().length === 0) {
          items.push(
            snippetCompletion('&ND v1', 'Strict Core v1 document header', '&ND v1', {
              documentation: 'Required strict Core v1 document header.',
              kind: vscode.CompletionItemKind.Keyword,
            })
          );
        }

        if (canOfferBlockStarters(document, position, linePrefix, context)) {
          items.push(
            snippetCompletion('# Heading', 'Section heading', '# ${1:Heading}'),
            snippetCompletion('- List item', 'Bullet list item', '- ${1:item}'),
            snippetCompletion('1. Ordered item', 'Ordered list item', '1. ${1:item}'),
            snippetCompletion('> Blockquote', 'Blockquote paragraph', '> ${1:quoted text}'),
            snippetCompletion('``` code block', 'Code block', '```$1\n$2\n```'),
            snippetCompletion('```` ordered code block', 'Ordered code block with line numbers intent', '````$1\n$2\n````'),
            snippetCompletion('+++extension', 'Opaque extension block', '+++${1:extension/name}\n$2\n+++')
          );

          if (context.canOfferFallback) {
            items.push(
              snippetCompletion('+++fallback', 'Fallback for the immediately preceding extension block', '+++fallback\n${1:Fallback content}\n+++')
            );
          }
        }

        if (context.rawMode === null && !isFallbackFenceLine(linePrefix.trim())) {
          addInlineCompletions(items);
        }

        return items;
      },
    }
  );

  context.subscriptions.push(provider);
}

function registerDocumentDiagnostics(context, collection) {
  const subscriptions = [
    vscode.workspace.onDidOpenTextDocument((document) => {
      void publishDiagnostics(collection, document);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      void publishDiagnostics(collection, event.document);
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      void publishDiagnostics(collection, document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      clearDiagnostics(collection, document);
    }),
  ];

  for (const document of vscode.workspace.textDocuments) {
    void publishDiagnostics(collection, document);
  }

  context.subscriptions.push(...subscriptions);
}

function activate(context) {
  const collection = vscode.languages.createDiagnosticCollection('and');
  context.subscriptions.push(collection);
  registerDocumentDiagnostics(context, collection);
  registerCodeActions(context);
  registerHoverSupport(context);
  registerCompletions(context);
}

function deactivate() {}

module.exports = {
  activate,
  deactivate,
};
