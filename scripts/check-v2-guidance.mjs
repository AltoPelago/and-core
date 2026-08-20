import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docsRoot = path.join(repoRoot, 'docs/spec/v2');

const migrationRequirements = [
  ['v1 rejection of v2', 'a v1 parser rejects a document declared as `&ND v2`'],
  ['v2 acceptance of v1', 'a v2-capable parser accepts valid v1 documents'],
  ['declaration authority', 'A v2-capable parser does not infer v2 from body syntax'],
  ['headerless host selection', 'both capability and effective version'],
  ['canonical version forwarding', 'version: result.version'],
  ['local anchor', '[# installation]'],
  ['local fragment link', '[@ #installation | Installation]'],
  ['experimental anchor migration', '[@ anchor:installation | ...]'],
  ['image form', '[~ image.jpg | Descriptive alternative text]'],
  ['image modes', '`inline`, `half`, or `full`'],
  ['AEON assignment', '[:date = 2026-08-20]'],
  ['equals-free replacement', '[:date 2026-08-20]  ->  [:date = 2026-08-20]'],
  ['first-class todo list', 'This parses as `todo_list` containing `todo_item` nodes'],
  ['todo inline rejection', 'Bare `[x] parser`'],
  ['auto-number list', 'list parses as `auto_number_list` containing inherited'],
  ['footnote named reuse', 'hello [% (A1) reusable context], again [% (A1)]'],
  ['footnote forward rejection', 'unresolved or forward'],
  ['directional list marker', '- [>] advance while [<] remains inline'],
  ['downgrade limit', 'There is no automatic downgrade'],
  ['consumer companion link', './and-consumer-conventions.md'],
];

const consumerRequirements = [
  ['processing order', '## Ownership Rule'],
  ['admonition ownership', '| `[! ...]` |'],
  ['question ownership', '| `[? ...]` |'],
  ['plus ownership', '| `[+ value]` |'],
  ['custom datatype ownership', '| Custom `[:type = scalar]` |'],
  ['paired-block tag ownership', '| `===tag` and `***tag` |'],
  ['numbering ownership', '| heading `[n]` and `auto_number_list` |'],
  ['footnote ownership', '| Footnote definitions and references |'],
  ['directional-list ownership', 'leading-unordered-item bullet-replacement intent'],
  ['image ownership', '| `[~ source | alt | mode]` |'],
  ['external navigation ownership', '| External `[@ target | label]` |'],
  ['extension ownership', '| `+++name` extension blocks |'],
  ['todo-list ownership', '| `todo_list` / `todo_item` |'],
  ['non-execution', 'Core documents are non-executable'],
  ['separate conformance', 'must be tested and versioned separately'],
  ['no grammar mutation', 'must not make otherwise-invalid Core syntax valid'],
];

async function checkDocument(fileName, requirements) {
  const source = await fs.readFile(path.join(docsRoot, fileName), 'utf8');
  for (const [label, text] of requirements) {
    assert.ok(source.includes(text), `${fileName}: missing ${label}`);
  }
}

await checkDocument('and-v1-to-v2-migration.md', migrationRequirements);
await checkDocument('and-consumer-conventions.md', consumerRequirements);

console.log(
  `v2Guidance migrationRequirements=${migrationRequirements.length} consumerRequirements=${consumerRequirements.length} failed=0`,
);
