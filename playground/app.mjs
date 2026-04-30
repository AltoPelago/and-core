import { emitCanonical } from '../implementations/reference-canonical/emitter.mjs';
import { renderHtml } from '../implementations/reference-html/renderer.mjs';
import { parseAnd } from '../implementations/reference-parser/parser.mjs';

const sample = `&ND v1

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
`;

const elements = {
  source: document.querySelector('#source'),
  reset: document.querySelector('#reset'),
  status: document.querySelector('#status'),
  badge: document.querySelector('#badge'),
  canonical: document.querySelector('#canonical'),
  ast: document.querySelector('#ast'),
  diagnostics: document.querySelector('#diagnostics'),
  html: document.querySelector('#html'),
  preview: document.querySelector('#preview'),
  budgetInputs: [...document.querySelectorAll('[data-budget]')],
  tabs: [...document.querySelectorAll('.tab')],
  panels: [...document.querySelectorAll('.tab-panel')],
};

function formatJson(value) {
  return JSON.stringify(value, null, 2);
}

function budgetLabel(name) {
  return {
    maxDocumentSize: 'Doc',
    maxLineLength: 'Line',
    maxNestingDepth: 'Depth',
    maxInlineDepth: 'Inline',
    maxTableColumns: 'Columns',
    maxBlockSize: 'Raw',
    maxBlockCount: 'Blocks',
    maxListItemCount: 'Items',
    maxLinkTargetLength: 'Link',
  }[name] ?? name;
}

function readBudgets() {
  const budgets = {};
  for (const input of elements.budgetInputs) {
    const rawValue = input.value.trim();
    if (rawValue === '') continue;

    const value = Number(rawValue);
    if (!Number.isInteger(value) || value < 0) {
      return {
        ok: false,
        error: {
          ok: false,
          errorCode: 'invalid_budget_option',
          message: `${budgetLabel(input.dataset.budget)} budget must be a non-negative integer.`,
        },
      };
    }

    budgets[input.dataset.budget] = value;
  }
  return { ok: true, options: Object.keys(budgets).length > 0 ? { budgets } : {} };
}

function friendlyDiagnostic(result, parseOptions = {}) {
  if (result.ok) return null;
  if (result.errorCode === 'invalid_budget_option') {
    return result.message;
  }
  if (result.errorCode === 'nd_budget_exceeded') {
    const active = Object.entries(parseOptions.budgets ?? {})
      .map(([name, value]) => `${budgetLabel(name)}=${value}`)
      .join(', ');
    return `The document exceeded an explicit parser budget${
      active ? ` (${active})` : ''
    }. Increase the matching budget field or clear it to use the default unrestricted playground parse.`;
  }
  if (result.diagnostic?.line && result.diagnostic?.column) {
    return `${result.errorCode} at line ${result.diagnostic.line}, column ${result.diagnostic.column}.`;
  }
  return result.errorCode;
}

function diagnosticMessage(result, parseOptions = {}) {
  if (result.ok) {
    return {
      ok: true,
      message: 'Parse succeeded in strict mode.',
      budgets: parseOptions.budgets ?? null,
      details: {
        blocks: result.document.children.length,
      },
    };
  }

  return {
    ok: false,
    errorCode: result.errorCode,
    message: friendlyDiagnostic(result, parseOptions),
    budgets: parseOptions.budgets ?? null,
    diagnostic: result.diagnostic ?? null,
  };
}

function updatePreview(result) {
  elements.preview.replaceChildren();
  if (!result.ok) {
    const paragraph = document.createElement('p');
    paragraph.className = 'empty-preview';
    paragraph.textContent = 'Preview is available after the document parses successfully.';
    elements.preview.append(paragraph);
    return;
  }

  try {
    elements.preview.innerHTML = renderHtml(result.document);
  } catch (error) {
    const paragraph = document.createElement('p');
    paragraph.className = 'empty-preview';
    paragraph.textContent = `Preview failed: ${error.code ?? 'html_render_failed'}`;
    elements.preview.append(paragraph);
  }
}

function update() {
  const budgetRead = readBudgets();
  const parseOptions = budgetRead.ok ? budgetRead.options : {};
  const result = budgetRead.ok
    ? parseAnd(elements.source.value, { ...parseOptions, includeSpans: true })
    : budgetRead.error;
  const diagnostics = diagnosticMessage(result, parseOptions);

  elements.status.textContent = result.ok ? 'Parsed' : 'Parse error';
  elements.badge.textContent = result.ok ? 'strict: ok' : 'strict: failed';
  elements.badge.classList.toggle('is-error', !result.ok);
  elements.ast.textContent = formatJson(result);
  elements.diagnostics.textContent = formatJson(diagnostics);

  if (!result.ok) {
    elements.canonical.textContent = 'Canonical output is available after a successful parse.';
    elements.html.textContent = 'HTML output is available after a successful parse.';
    updatePreview(result);
    return;
  }

  try {
    elements.canonical.textContent = emitCanonical(result.document, { profile: 'standalone' });
  } catch (error) {
    elements.canonical.textContent = formatJson({
      ok: false,
      errorCode: error.code ?? 'canonical_emit_failed',
      message: error.message,
    });
  }

  try {
    elements.html.textContent = renderHtml(result.document);
  } catch (error) {
    elements.html.textContent = formatJson({
      ok: false,
      errorCode: error.code ?? 'html_render_failed',
      message: error.message,
    });
  }

  updatePreview(result);
}

function activateTab(name) {
  for (const tab of elements.tabs) {
    const active = tab.dataset.tab === name;
    tab.classList.toggle('is-active', active);
    tab.setAttribute('aria-selected', String(active));
  }
  for (const panel of elements.panels) {
    const active = panel.dataset.panel === name;
    panel.classList.toggle('is-active', active);
    panel.hidden = !active;
  }
}

elements.source.value = sample;
elements.source.addEventListener('input', update);
for (const input of elements.budgetInputs) {
  input.addEventListener('input', update);
}
elements.reset.addEventListener('click', () => {
  elements.source.value = sample;
  for (const input of elements.budgetInputs) {
    input.value = '';
  }
  update();
});

for (const tab of elements.tabs) {
  tab.addEventListener('click', () => activateTab(tab.dataset.tab));
}

update();
