import { attachEditor, renderOutput } from './highlighting.mjs';

const $ = (id) => document.getElementById(id);
const ui = {
  and: $('and-source'), aeon: $('aeon-source'), query: $('query'), preset: $('query-preset'),
  toAeon: $('to-aeon'), toAnd: $('to-and'), restore: $('restore'), run: $('run-query'),
  showMetadata: $('show-result-metadata'), help: $('query-help'),
  conversion: $('conversion-status'), queryStatus: $('query-status'), results: $('results'), count: $('result-count'),
};
const refreshEditors = [attachEditor(ui.and, 'and'), attachEditor(ui.aeon, 'aeon'), attachEditor(ui.query, 'sansa')];
function refreshHighlighting() { for (const refresh of refreshEditors) refresh(); }

const workspace = {
  shell: $('playground-shell'), and: $('and-pane'), query: $('query-pane'), results: $('results-pane'),
  actions: $('conversion-actions'), note: $('view-note'),
  buttons: [...document.querySelectorAll('[data-workspace-view]')],
};
function setView(view) {
  const query = view === 'query';
  workspace.shell.dataset.view = query ? 'query' : 'convert';
  workspace.and.hidden = query;
  workspace.query.hidden = workspace.results.hidden = !query;
  workspace.actions.hidden = query;
  workspace.note.textContent = query ? 'Queries the current Aeon source · Ctrl/Cmd+Enter to run' : 'Semantic round-trip conversion';
  for (const button of workspace.buttons) {
    const active = button.dataset.workspaceView === workspace.shell.dataset.view;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-pressed', String(active));
  }
}
for (const button of workspace.buttons) button.addEventListener('click', () => {
  setView(button.dataset.workspaceView);
  save();
});

let bootstrap;
let conversionPending = false;
let queryPending = false;
let lastQueryResult = null;
const draftKey = 'and-semantic-playground-2';

function status(element, message, error = false) {
  element.textContent = message;
  element.classList.toggle('error', error);
}
function buttons() {
  ui.toAeon.disabled = ui.toAnd.disabled = ui.restore.disabled = !bootstrap || conversionPending;
  ui.run.disabled = !bootstrap || conversionPending || queryPending || !ui.aeon.value.trim();
  ui.preset.disabled = !bootstrap;
}
function save() {
  try { localStorage.setItem(draftKey, JSON.stringify({ and: ui.and.value, aeon: ui.aeon.value, query: ui.query.value, view: workspace.shell.dataset.view, showMetadata: ui.showMetadata.checked })); } catch {}
}
function stale() {
  lastQueryResult = null;
  ui.count.textContent = '—';
  ui.results.textContent = 'Run the query to inspect the current Aeon document.';
  status(ui.queryStatus, 'Results need refreshing.');
}
async function api(operation, body) {
  const response = await fetch(`/api/semantic/${operation}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const value = await response.json();
  if (!response.ok || !value.ok) {
    throw new Error(value.message ?? value.errors?.map((error) => error.message ?? error.code).join('\n') ?? 'The operation failed.');
  }
  return value;
}
async function convert(direction) {
  if (conversionPending) return;
  conversionPending = true;
  buttons();
  status(ui.conversion, 'Converting and verifying the semantic round trip…');
  const before = { and: ui.and.value, aeon: ui.aeon.value };
  try {
    const result = await api('convert', { direction, source: direction === 'to-aeon' ? before.and : before.aeon });
    if (ui.and.value !== before.and || ui.aeon.value !== before.aeon) {
      status(ui.conversion, 'Editors changed during conversion. Run it again to use the latest text.');
      return;
    }
    if (direction === 'to-aeon') { ui.aeon.value = result.aeon; stale(); }
    else ui.and.value = result.and;
    refreshHighlighting();
    status(ui.conversion, `${direction === 'to-aeon' ? 'Aeon' : '&ND'} updated. Semantic round trip verified.`);
    save();
  } catch (error) { status(ui.conversion, error.message, true); }
  finally { conversionPending = false; buttons(); }
}
function showQueryHelp() {
  ui.help.textContent = bootstrap?.queries.find(({ query }) => query === ui.query.value)?.description
    ?? 'Select values directly for a flat result list. Use exists(selector) to test for matches.';
}
function showQueryResult() {
  if (lastQueryResult) renderOutput(ui.results, ui.showMetadata.checked ? lastQueryResult.aeon : lastQueryResult.aeonValues);
}
ui.showMetadata.addEventListener('change', () => { showQueryResult(); save(); });

async function runQuery() {
  if (queryPending) return;
  queryPending = true;
  buttons();
  status(ui.queryStatus, 'Running SANSA against the Aeon editor…');
  const before = { source: ui.aeon.value, query: ui.query.value };
  try {
    const result = await api('query', before);
    if (ui.aeon.value !== before.source || ui.query.value !== before.query) {
      stale();
      return;
    }
    ui.count.textContent = `${result.valueCount} value${result.valueCount === 1 ? '' : 's'}`;
    status(ui.queryStatus, result.valueCount ? 'Query succeeded.' : 'Query succeeded. No matches.');
    lastQueryResult = result;
    showQueryResult();
    save();
  } catch (error) {
    ui.count.textContent = '—';
    lastQueryResult = null;
    ui.results.textContent = 'No current results.';
    status(ui.queryStatus, error.message, true);
  } finally { queryPending = false; buttons(); }
}
ui.toAeon.addEventListener('click', () => convert('to-aeon'));
ui.toAnd.addEventListener('click', () => convert('to-and'));
ui.run.addEventListener('click', runQuery);
ui.restore.addEventListener('click', async () => {
  ui.and.value = bootstrap.and;
  ui.aeon.value = '';
  ui.preset.value = '0';
  ui.query.value = bootstrap.queries[0].query;
  refreshHighlighting();
  showQueryHelp();
  stale();
  save();
  await convert('to-aeon');
});
ui.preset.addEventListener('change', () => {
  ui.query.value = bootstrap.queries[Number(ui.preset.value)].query;
  refreshHighlighting();
  showQueryHelp();
  stale(); save();
});
for (const element of [ui.and, ui.aeon, ui.query]) element.addEventListener('input', () => {
  if (element !== ui.query) status(ui.conversion, 'Edited. Choose a direction to convert.');
  if (element !== ui.and) stale();
  if (element === ui.query) showQueryHelp();
  save(); buttons();
});
ui.query.addEventListener('keydown', (event) => {
  if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) { event.preventDefault(); runQuery(); }
});
try {
  const response = await fetch('/api/semantic/bootstrap');
  if (!response.ok) throw new Error('Could not load the playground example.');
  bootstrap = await response.json();
  ui.and.maxLength = ui.aeon.maxLength = bootstrap.maxSourceLength;
  ui.query.maxLength = 16_384;
  ui.preset.replaceChildren(...bootstrap.queries.map(({ name }, index) => {
    const option = document.createElement('option'); option.value = String(index); option.textContent = name; return option;
  }));
  let draft;
  try { draft = JSON.parse(localStorage.getItem(draftKey)); } catch {}
  if (draft && ['and', 'aeon', 'query'].every((key) => typeof draft[key] === 'string')) {
    setView(draft.view);
    ui.showMetadata.checked = draft.showMetadata === true;
    ui.and.value = draft.and; ui.aeon.value = draft.aeon; ui.query.value = draft.query;
    const presetIndex = bootstrap.queries.findIndex(({ query }) => query === draft.query);
    ui.preset.selectedIndex = presetIndex;
    status(ui.conversion, 'Local draft restored. Convert either editor when ready.');
  } else {
    ui.and.value = bootstrap.and; ui.query.value = bootstrap.queries[0].query;
    await convert('to-aeon');
  }
  refreshHighlighting();
  showQueryHelp();
  buttons();
} catch (error) { status(ui.conversion, error.message, true); }
