export { emitCanonical } from './implementations/reference-canonical/emitter.mjs';
export { renderHtml } from './implementations/reference-html/renderer.mjs';
export { collectDiagnostics } from './implementations/reference-parser/diagnostics.mjs';
export { parseAnd } from './implementations/reference-parser/parser.mjs';

import { parseInline as referenceParseInline } from './implementations/reference-parser/parser.mjs';

export function parseInline(text, options = {}, baseOffset = 0, context = null) {
  const result = referenceParseInline(text, options, baseOffset, context);
  if (!result.ok) return result;
  return {
    ok: true,
    children: result.nodes,
  };
}
