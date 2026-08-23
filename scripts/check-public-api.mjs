import { collectDiagnostics, emitCanonical, parseAnd, parseInline, renderHtml } from '../index.mjs';

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const source = `&ND v1

# Public API

This is [* deterministic] prose.
`;

const parsed = parseAnd(source, { includeSpans: true });
assert(parsed.ok, `public parse should succeed: ${parsed.errorCode ?? 'unknown_error'}`);
assert(parsed.version === 'v1', 'public parse should report the effective v1 version');
assert(parsed.document.type === 'document', 'public parse should return a document root');
assert(parsed.document.children[0].type === 'heading', 'public parse should expose block nodes');
const dollarCodeV1 = parseAnd('&ND v1\n\n~~~$ aeon\nplain\n~~~$\n');
assert(
  dollarCodeV1.ok
    && dollarCodeV1.document.children[0]?.type === 'code_block'
    && dollarCodeV1.document.children[0]?.ordered === false
    && dollarCodeV1.document.children[0]?.language === 'aeon',
  'public v1 parse should accept unnumbered dollar code fences',
);
const numberedDollarCodeV1 = parseAnd('&ND v1\n\n~~~$ [n] aeon\nnumbered\n~~~$\n');
assert(
  !numberedDollarCodeV1.ok && numberedDollarCodeV1.errorCode === 'invalid_code_fence',
  'public v1 parse should reject v2-only dollar-fence numbering',
);

const inline = parseInline('Hello [* world]');
assert(inline.ok, `public inline parse should succeed: ${inline.errorCode ?? 'unknown_error'}`);
assert(inline.children.length === 2, 'public inline parse should expose inline children');

const semanticInline = parseInline('[(term) visible]', { allowV2: true, version: 'v2' });
assert(
  semanticInline.ok
    && semanticInline.children[0]?.type === 'semantic_tag'
    && semanticInline.children[0]?.id === 'term',
  'public inline parse should expose semantic IDs to consumers',
);

const sharedV2Id = '1.shared_id-part:section';
const sharedAnchorInline = parseInline(`[# ${sharedV2Id}]`, { allowV2: true, version: 'v2' });
const sharedFootnoteInline = parseInline(`[% (${sharedV2Id})]`, { allowV2: true, version: 'v2' });
const sharedSemanticInline = parseInline(`[(${sharedV2Id}) visible]`, { allowV2: true, version: 'v2' });
assert(
  sharedAnchorInline.ok
    && sharedFootnoteInline.ok
    && sharedSemanticInline.ok
    && sharedAnchorInline.children[0]?.id === sharedV2Id
    && sharedFootnoteInline.children[0]?.id === sharedV2Id
    && sharedSemanticInline.children[0]?.id === sharedV2Id,
  'public inline parsing should apply one shared v2 identifier grammar across constructs',
);
const invalidSharedAnchor = parseInline('[# bad/id]', { allowV2: true, version: 'v2' });
const invalidSharedFootnote = parseInline('[% (bad/id)]', { allowV2: true, version: 'v2' });
const invalidSharedSemantic = parseInline('[(bad/id) visible]', { allowV2: true, version: 'v2' });
assert(
  !invalidSharedAnchor.ok
    && invalidSharedAnchor.errorCode === 'invalid_anchor_tag'
    && !invalidSharedFootnote.ok
    && invalidSharedFootnote.errorCode === 'invalid_footnote_id'
    && !invalidSharedSemantic.ok
    && invalidSharedSemantic.errorCode === 'invalid_semantic_tag',
  'shared lexical rejection should retain construct-specific diagnostics',
);

const v2Source = '&ND v2\n\n# [n] Public API\n\nStart[# api][.]End\n';
const parsedV2 = parseAnd(v2Source, { allowV2: true, includeSpans: true });
assert(parsedV2.ok && parsedV2.version === 'v2', 'public parse should expose opt-in v2 capability');
const embeddedV2 = parseAnd('[# embedded]\n', { allowV2: true, version: 'v2' });
assert(embeddedV2.ok && embeddedV2.version === 'v2', 'host-selected headerless v2 should require capability and version');
const capabilityOnlyV2 = parseAnd('[# embedded]\n', { allowV2: true });
assert(
  !capabilityOnlyV2.ok && capabilityOnlyV2.errorCode === 'unknown_inline_type',
  'v2 capability alone should leave headerless input governed by v1',
);
const versionOnlyV2 = parseAnd('[# embedded]\n', { version: 'v2' });
assert(
  !versionOnlyV2.ok && versionOnlyV2.errorCode === 'unsupported_version',
  'headerless v2 selection without capability should fail closed',
);
const declaredV1Precedence = parseAnd('&ND v1\n\nText\n', { allowV2: true, version: 'v2' });
assert(
  declaredV1Precedence.ok && declaredV1Precedence.version === 'v1',
  'declared v1 should take precedence over a conflicting host-selected version',
);
const declaredV2Precedence = parseAnd(v2Source, { allowV2: true, version: 'v1' });
assert(
  declaredV2Precedence.ok && declaredV2Precedence.version === 'v2',
  'declared v2 should take precedence over a conflicting host-selected version',
);
const inlineV2 = parseInline('[# api]', { allowV2: true, version: 'v2' });
assert(inlineV2.ok && inlineV2.children[0].type === 'anchor_tag', 'public inline parse should expose explicit v2');
const deniedInlineV2 = parseInline('[# api]', { version: 'v2' });
assert(
  !deniedInlineV2.ok && deniedInlineV2.errorCode === 'unsupported_version',
  'public inline parse should enforce the same host capability boundary',
);
const inlineImageV2 = parseInline('[~ image.jpg | Sample image]', { allowV2: true, version: 'v2' });
assert(inlineImageV2.ok && inlineImageV2.children[0].type === 'image_tag', 'public inline parse should expose v2 images');
const inlineTypedV2 = parseInline('[:date = 2026-08-20]', { allowV2: true, version: 'v2' });
assert(inlineTypedV2.ok && inlineTypedV2.children[0].value.type === 'DateLiteral', 'public inline parse should expose AEON scalar families');
const todoV2 = parseAnd('&ND v2\n\n- [x] parser\n', { allowV2: true });
assert(
  todoV2.ok
    && todoV2.document.children[0]?.type === 'todo_list'
    && todoV2.document.children[0].items[0]?.type === 'todo_item'
    && todoV2.document.children[0].items[0].state === 'checked',
  'public parse should expose first-class v2 todo lists',
);
const inlineTodoV2 = parseInline('[x] parser', { allowV2: true, version: 'v2' });
assert(
  !inlineTodoV2.ok && inlineTodoV2.errorCode === 'unknown_inline_type',
  'todo state markers should not remain generic inline nodes',
);
const autoNumberListV2 = parseAnd('&ND v2\n\n- [n] first\n- [n] second\n', { allowV2: true });
assert(
  autoNumberListV2.ok
    && autoNumberListV2.document.children[0]?.type === 'auto_number_list'
    && autoNumberListV2.document.children[0].items[0]?.type === 'list_item',
  'public parse should expose first-class v2 auto-number lists',
);
const dollarCodeV2 = parseAnd('&ND v2\n\n~~~$ [n] aeon\none\ntwo\n~~~$\n', { allowV2: true });
assert(
  dollarCodeV2.ok
    && dollarCodeV2.document.children[0]?.type === 'code_block'
    && dollarCodeV2.document.children[0]?.ordered === true
    && dollarCodeV2.document.children[0]?.language === 'aeon',
  'public parse should expose v2 dollar code-block language and numbered-line intent',
);
const inheritedBacktickV2 = parseAnd('&ND v2\n\n```json\nlegacy\n```\n', { allowV2: true });
assert(inheritedBacktickV2.ok, 'v2 readers should retain inherited backtick code fences');
const removedTildeLanguageV2 = parseAnd('&ND v2\n\n~~~aeon\nremoved\n~~~\n', { allowV2: true });
assert(
  !removedTildeLanguageV2.ok && removedTildeLanguageV2.errorCode === 'deprecated_code_fence',
  'removed tilde-language code fences should fail with a stable diagnostic',
);
const tableV2 = parseAnd(
  '&ND v2\n\n| left | center | right |\n| <-- | -=- | --> |\n|> A+B | C |\n|~ Table 1: [* aligned] values\n',
  { allowV2: true },
);
assert(
  tableV2.ok
    && tableV2.document.children[0]?.type === 'table'
    && tableV2.document.children[0]?.alignments?.join(',') === 'left,center,right'
    && tableV2.document.children[0]?.rows?.[0]?.[0]?.colSpan === 2
    && tableV2.document.children[0]?.caption?.[1]?.type === 'strong',
  'public parse should expose v2 table alignments, horizontal spans, and rich captions',
);
const escapedAlignedTableV2 = parseAnd(
  '&ND v2\n\n\\| A | B |\n| <-- | --> |\n| a | b |\n',
  { allowV2: true },
);
assert(escapedAlignedTableV2.ok, 'public parse should preserve structurally escaped aligned-table text');
assert(
  emitCanonical(escapedAlignedTableV2.document, { profile: 'standalone', version: 'v2' })
    .includes('\\| A | B |\n| <-- | --> |'),
  'v2 canonical emission should restore the escape before aligned-table-shaped paragraph text',
);
const cardsV2 = parseAnd(
  '&ND v2\n\n~~~|\nStandard.\n~~~|\n\n~~~| [* Details]\n# Inside\n~~~|\n',
  { allowV2: true },
);
assert(
  cardsV2.ok
    && cardsV2.document.children[0]?.type === 'card_block'
    && cardsV2.document.children[0]?.title === undefined
    && cardsV2.document.children[1]?.type === 'card_block'
    && cardsV2.document.children[1]?.title?.[0]?.type === 'strong'
    && cardsV2.document.children[1]?.children?.[0]?.type === 'heading',
  'public parse should expose unnamed and rich-titled card block containers',
);
const cardsV2Canonical = emitCanonical(cardsV2.document, { profile: 'standalone', version: 'v2' });
assert(
  cardsV2Canonical.includes('~~~| [* Details]\n# Inside\n~~~|'),
  'public canonical emission should preserve named card syntax and nested blocks',
);
const escapedCardV2 = parseAnd('&ND v2\n\n\\~~~|\n', { allowV2: true });
assert(
  escapedCardV2.ok
    && escapedCardV2.document.children[0]?.type === 'paragraph'
    && escapedCardV2.document.children[0]?.children?.[0]?.value === '~~~|',
  'public parse should decode a structurally escaped card opener as paragraph text',
);
assert(
  emitCanonical(escapedCardV2.document, { profile: 'standalone', version: 'v2' }).includes('\\~~~|'),
  'public canonical emission should restore a structural escape before card-shaped paragraph text',
);
const directionalListV2 = parseAnd('&ND v2\n\n- [>] advance while [<] remains inline\n', { allowV2: true });
assert(
  directionalListV2.ok
    && directionalListV2.document.children[0]?.type === 'list'
    && directionalListV2.document.children[0].items[0]?.children?.[0]?.children?.[0]?.type === 'directional_marker'
    && directionalListV2.document.children[0].items[0].children[0].children[2]?.type === 'directional_marker',
  'public parse should retain leading and later directional markers in inherited list ASTs',
);
const formattedParagraphsV2 = parseAnd(
  '&ND v2\n\n~~~*\nStrong\n~~~*\n\n~~~/\nEmphasis\n~~~/\n\n~~~_\nUnderline\n~~~_\n',
  { allowV2: true },
);
assert(
  formattedParagraphsV2.ok
    && formattedParagraphsV2.document.children[0]?.type === 'strong_paragraph_block'
    && formattedParagraphsV2.document.children[1]?.type === 'emphasis_paragraph_block'
    && formattedParagraphsV2.document.children[2]?.type === 'underline_paragraph_block',
  'public parse should expose all formatted paragraph block families',
);
const footnoteV2 = parseAnd('&ND v2\n\nhello [% (A1) world] again [% (A1)]\n', { allowV2: true });
assert(
  footnoteV2.ok
    && footnoteV2.document.children[0]?.children?.[1]?.type === 'footnote_definition'
    && footnoteV2.document.children[0]?.children?.[3]?.type === 'footnote_reference',
  'public parse should expose v2 footnote definitions and shorthand references',
);
const inlineFootnoteV2 = parseInline('[% (A1)]', { allowV2: true, version: 'v2' });
assert(inlineFootnoteV2.ok && inlineFootnoteV2.children[0]?.type === 'footnote_reference', 'public inline parse should expose unresolved footnote-reference shape');

const diagnostics = collectDiagnostics('&ND v2\n');
assert(!diagnostics.ok, 'public diagnostics should surface invalid input');
assert(diagnostics.diagnostics[0].code === 'invalid_header', 'public diagnostics should retain stable codes');
const embeddedV2Diagnostics = collectDiagnostics('[# diagnostic]\n', { allowV2: true, version: 'v2' });
assert(embeddedV2Diagnostics.ok, 'public diagnostics should accept host-selected headerless v2');

const canonical = emitCanonical(parsed.document, { profile: 'standalone' });
assert(canonical.startsWith('&ND v1\n\n# Public API\n\n'), 'public canonical emission should succeed');
const canonicalV2 = emitCanonical(parsedV2.document, { profile: 'standalone', version: parsedV2.version });
assert(canonicalV2 === v2Source, 'public canonical emission should preserve v2 syntax and declaration');
const inheritedCodeCanonicalV2 = emitCanonical(inheritedBacktickV2.document, {
  profile: 'standalone',
  version: inheritedBacktickV2.version,
});
assert(
  inheritedCodeCanonicalV2.includes('~~~$ json\nlegacy\n~~~$'),
  'v2 canonical emission should normalize inherited backtick code blocks to dollar fences',
);

const html = renderHtml(parsed.document);
assert(html.includes('<h1>Public API</h1>'), 'public HTML projection should succeed');
const htmlV2 = renderHtml(parsedV2.document);
assert(htmlV2.includes('data-auto-number="true"'), 'public HTML projection should render v2 intent');
assert(renderHtml(todoV2.document).includes('class="and-todo-list"'), 'public HTML projection should expose first-class todo lists');
assert(renderHtml(autoNumberListV2.document).includes('class="and-auto-number-list"'), 'public HTML projection should expose first-class auto-number lists');
const tableV2Html = renderHtml(tableV2.document);
assert(tableV2Html.includes('style="text-align:left"'), 'public HTML projection should expose table alignment');
assert(tableV2Html.includes('colspan="2"'), 'public HTML projection should expose native table colspans');
assert(
  tableV2Html.includes('<caption class="and-block-caption">Table 1: <strong>aligned</strong> values</caption>'),
  'public HTML projection should expose a native rich table caption',
);
const cardsV2Html = renderHtml(cardsV2.document);
assert(cardsV2Html.includes('<aside class="and-card">'), 'public HTML projection should expose unnamed cards');
assert(cardsV2Html.includes('<details class="and-card and-card-collapsible">'), 'public HTML projection should expose named cards as collapsible');
assert(cardsV2Html.includes('<summary><strong>Details</strong></summary>'), 'public HTML projection should preserve rich card titles');
const directionalListHtml = renderHtml(directionalListV2.document);
assert(directionalListHtml.includes('class="and-directional-list-marker"'), 'public HTML projection should replace a leading directional-list bullet');
assert(directionalListHtml.includes('class="and-directional-marker"'), 'public HTML projection should keep later directional markers inline');
const formattedParagraphsHtml = renderHtml(formattedParagraphsV2.document);
assert(formattedParagraphsHtml.includes('class="and-strong-paragraph"'), 'public HTML projection should expose strong paragraph blocks');
assert(formattedParagraphsHtml.includes('class="and-emphasis-paragraph"'), 'public HTML projection should expose emphasis paragraph blocks');
assert(formattedParagraphsHtml.includes('class="and-underline-paragraph"'), 'public HTML projection should expose underline paragraph blocks');
assert(renderHtml(footnoteV2.document).includes('class="and-footnotes"'), 'public HTML projection should expose linked endnotes');
const imageDocument = {
  type: 'document',
  children: [{ type: 'paragraph', children: [inlineImageV2.children[0]] }],
};
const resolvedImageHtml = renderHtml(imageDocument, { imageBaseUrl: 'https://docs.example/guide/page.and' });
assert(
  resolvedImageHtml.includes('src="https://docs.example/guide/image.jpg"'),
  'public HTML projection should expose explicit image-base resolution',
);

console.log('Public API checks passed.');
