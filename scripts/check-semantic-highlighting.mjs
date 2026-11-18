import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

// The alternate module is only for replaying these regressions against the
// reviewed revision; the playground itself always imports highlighting.mjs.
const moduleUrl = process.env.AND_HIGHLIGHTING_TEST_MODULE ?? new URL('../playground/semantic/highlighting.mjs', import.meta.url).href;
const { attachEditor, highlightAnd } = await import(moduleUrl);
const visible = (html) => html.replace(/<[^>]+>/g, '').replaceAll('&lt;', '<').replaceAll('&gt;', '>').replaceAll('&amp;', '&');

test('incomplete &ND inline values preserve every editable source prefix', () => {
  for (const source of ['[:', '[:number = 1', '[:string = "<&', '[:[:', '[:\n[:number = 1', '[:number = 1]', '[x]', '\\[:number = 1']) {
    for (let end = 0; end <= source.length; end++) {
      const prefix = source.slice(0, end);
      assert.equal(visible(highlightAnd(prefix)), prefix, JSON.stringify(prefix));
    }
  }
});

test('repeated incomplete inline openers complete within a bounded subprocess at the source cap', () => {
  // A timeout contains the original quadratic regression. Complexity is also
  // established by the scanner's advancing intervals: every closer search
  // consumes its interval, including the full suffix on a miss. This budget
  // is a regression backstop, not a general browser responsiveness guarantee.
  const probe = spawnSync(process.execPath, ['--input-type=module', '-e', `
    import assert from 'node:assert/strict';
    import { highlight } from ${JSON.stringify(moduleUrl)};
    for (const n of [131072, 1000, 2000, 4000]) {
      const source = '[:'.repeat(n);
      const output = highlight(source, 'and').replace(/<[^>]+>/g, '');
      assert.equal(output.length, source.length);
      assert.equal(output, source);
    }
  `], { timeout: 10_000, maxBuffer: 2048 });
  assert.equal(probe.error, undefined, probe.error?.message);
  assert.equal(probe.status, 0, probe.stderr?.toString());
});

test('editor gutters refresh 131073 lines and can shrink without wide argument calls', (t) => {
  const previous = globalThis.document;
  t.after(() => {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  });
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.events = {}; this.scrollTop = this.scrollLeft = 0; }
    append(...nodes) {
      for (const node of nodes) {
        if (node.tag === 'fragment') { for (const child of node.children) this.children.push(child); }
        else this.children.push(node);
      }
    }
    before(editor) { this.wrapper = editor; }
    setAttribute() {}
    addEventListener(name, listener) { this.events[name] = listener; }
    replaceChildren(...nodes) { this.children = []; this.replaceArgumentCount = nodes.length; this.append(...nodes); }
  }
  globalThis.document = {
    createElement: (tag) => new Element(tag),
    createDocumentFragment: () => new Element('fragment'),
  };
  const textarea = new Element('textarea');
  textarea.value = '\n'.repeat(131072);
  const sync = attachEditor(textarea, 'and');
  const [backdrop, gutter] = textarea.wrapper.children;
  assert.equal(gutter.children.length, 131073);
  assert.equal(gutter.children[0].textContent, 1);
  assert.equal(gutter.children.at(-1).textContent, 131073);
  assert.ok(gutter.replaceArgumentCount <= 1);
  assert.equal(backdrop.children[0].innerHTML, textarea.value + '\n');
  textarea.value = '[:number = 1';
  textarea.scrollTop = 42; textarea.scrollLeft = 17;
  sync();
  assert.equal(gutter.children.length, 1);
  assert.equal(visible(backdrop.children[0].innerHTML), textarea.value + '\n');
  assert.equal(gutter.scrollTop, 42);
  assert.equal(backdrop.scrollTop, 42);
  assert.equal(backdrop.scrollLeft, 17);
});
