const $ = (id) => document.getElementById(id);
const ui = {
  and: $('and-source'), aeon: $('aeon-source'), query: $('query'), preset: $('query-preset'),
  toAeon: $('to-aeon'), toAnd: $('to-and'), restore: $('restore'), run: $('run-query'),
  conversion: $('conversion-status'), queryStatus: $('query-status'), results: $('results'), count: $('result-count'),
};
let bootstrap;
let conversionPending = false;
let queryPending = false;
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
  try { localStorage.setItem(draftKey, JSON.stringify({ and: ui.and.value, aeon: ui.aeon.value, query: ui.query.value })); } catch {}
}
function stale() {
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
    status(ui.conversion, `${direction === 'to-aeon' ? 'Aeon' : '&ND'} updated. Semantic round trip verified.`);
    save();
  } catch (error) { status(ui.conversion, error.message, true); }
  finally { conversionPending = false; buttons(); }
}
function bindingSummary(binding) {
  const result = { address: binding.address, kind: binding.representationKind };
  if (binding.nodeTag !== undefined) result.tag = binding.nodeTag;
  if (binding.datatype !== undefined) result.datatype = binding.datatype;
  if (binding.value !== undefined) result.value = binding.value;
  if (binding.children?.length) result.children = binding.children.map(bindingSummary);
  if (binding.attributeSpace?.children?.length) result.attributes = binding.attributeSpace.children.map(bindingSummary);
  return result;
}
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
    ui.count.textContent = `${result.results.length} result${result.results.length === 1 ? '' : 's'}`;
    status(ui.queryStatus, result.results.length ? 'Query succeeded.' : 'Query succeeded. No matches.');
    const summarized = result.results.map((entry) => ({
      address: entry.valueAddress ?? entry.candidateAddress,
      value: entry.value.type === 'bindingSet' ? entry.value.bindings.map(bindingSummary) : entry.value,
    }));
    ui.results.textContent = JSON.stringify(summarized, null, 2);
    save();
  } catch (error) {
    ui.count.textContent = '—';
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
  stale();
  save();
  await convert('to-aeon');
});
ui.preset.addEventListener('change', () => {
  ui.query.value = bootstrap.queries[Number(ui.preset.value)].query;
  stale(); save();
});
for (const element of [ui.and, ui.aeon, ui.query]) element.addEventListener('input', () => {
  if (element !== ui.query) status(ui.conversion, 'Edited. Choose a direction to convert.');
  if (element !== ui.and) stale();
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
    ui.and.value = draft.and; ui.aeon.value = draft.aeon; ui.query.value = draft.query;
    const presetIndex = bootstrap.queries.findIndex(({ query }) => query === draft.query);
    ui.preset.selectedIndex = presetIndex;
    status(ui.conversion, 'Local draft restored. Convert either editor when ready.');
  } else {
    ui.and.value = bootstrap.and; ui.query.value = bootstrap.queries[0].query;
    await convert('to-aeon');
  }
  buttons();
} catch (error) { status(ui.conversion, error.message, true); }
