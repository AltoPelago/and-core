const IDENTIFIER_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;
const NUMBER_PATTERN = /^[+-]?(?:(?:\d(?:_?\d)*)\.(?:\d(?:_?\d)*)|(?:\d(?:_?\d)*)\.|\.(?:\d(?:_?\d)*)|(?:\d(?:_?\d)*))(?:[eE][+-]?\d(?:_?\d)*)?$/;
const HEX_PATTERN = /^#[0-9A-Fa-f](?:_?[0-9A-Fa-f])*$/;
const RADIX_PATTERN = /^%[+-]?(?:(?:[0-9A-Za-z&!](?:_?[0-9A-Za-z&!])*)?\.[0-9A-Za-z&!](?:_?[0-9A-Za-z&!])*|[0-9A-Za-z&!](?:_?[0-9A-Za-z&!])*)$/;
const ENCODING_PATTERN = /^&[A-Za-z0-9_-]+={0,2}$/;
const SANSA_PATTERN = /^(?:\$|\?)(?:\.|$)/;
const RESERVED_NULL_SENTINELS = new Set(['none', 'notSet', 'notApplicable', 'tombstone']);

const FAMILY_BY_DATATYPE = new Map([
  ['string', 'string'],
  ['n', 'number'], ['number', 'number'], ['int', 'number'], ['int8', 'number'],
  ['int16', 'number'], ['int32', 'number'], ['int64', 'number'], ['uint', 'number'],
  ['uint8', 'number'], ['uint16', 'number'], ['uint32', 'number'], ['uint64', 'number'],
  ['float', 'number'], ['float32', 'number'], ['float64', 'number'],
  ['infinity', 'infinity'], ['nan', 'nan'], ['null', 'null'],
  ['boolean', 'boolean'], ['bool', 'boolean'], ['toggle', 'toggle'], ['hex', 'hex'],
  ['radix', 'radix'], ['decimal', 'radix'], ['radix2', 'radix'], ['radix6', 'radix'],
  ['radix8', 'radix'], ['radix12', 'radix'],
  ['encoding', 'encoding'], ['base64', 'encoding'], ['embed', 'encoding'], ['inline', 'encoding'],
  ['date', 'date'], ['time', 'time'], ['datetime', 'datetime'], ['wtc', 'wtc'],
  ['sep', 'separator'], ['kadot', 'separator'], ['sansa', 'sansa'],
]);

const UNSUPPORTED_RESERVED_DATATYPES = new Set([
  'trimtick', 'prose', 'object', 'obj', 'o', 'envelope', 'list', 'tuple', 'triple', 'node',
]);

const GENERIC_RESERVED_DATATYPES = new Set(['null', 'nan', 'infinity']);
const MAX_GENERIC_DEPTH = 1;

export const AEON_INLINE_SCALAR_CONTRACT = Object.freeze({
  id: 'and-v2-aeon-inline-scalar-v1',
  aeonPackageVersion: '0.12.1',
  maxGenericDepth: MAX_GENERIC_DEPTH,
  datatypes: Object.freeze([...FAMILY_BY_DATATYPE.keys()]),
  unsupportedReservedDatatypes: Object.freeze([...UNSUPPORTED_RESERVED_DATATYPES]),
});

function failure() {
  return { ok: false, errorCode: 'invalid_typed_value' };
}

function skipWhitespace(source, index) {
  let i = index;
  while (source[i] === ' ' || source[i] === '\t') i += 1;
  return i;
}

function readIdentifier(source, index) {
  let i = index;
  if (!/[A-Za-z_]/.test(source[i] ?? '')) return null;
  i += 1;
  while (/[A-Za-z0-9_]/.test(source[i] ?? '')) i += 1;
  return { value: source.slice(index, i), nextIndex: i };
}

function parseUnicodeEscape(source, index) {
  if (source[index] === '{') {
    const end = source.indexOf('}', index + 1);
    if (end === -1) return null;
    const digits = source.slice(index + 1, end);
    if (!/^[0-9A-Fa-f]{1,6}$/.test(digits)) return null;
    const codePoint = Number.parseInt(digits, 16);
    if (codePoint > 0x10ffff || (codePoint >= 0xd800 && codePoint <= 0xdfff)) return null;
    return { value: String.fromCodePoint(codePoint), nextIndex: end + 1 };
  }

  const digits = source.slice(index, index + 4);
  if (!/^[0-9A-Fa-f]{4}$/.test(digits)) return null;
  const first = Number.parseInt(digits, 16);
  if (first >= 0xdc00 && first <= 0xdfff) return null;
  if (first >= 0xd800 && first <= 0xdbff) {
    if (source.slice(index + 4, index + 6) !== '\\u') return null;
    const lowDigits = source.slice(index + 6, index + 10);
    if (!/^[0-9A-Fa-f]{4}$/.test(lowDigits)) return null;
    const second = Number.parseInt(lowDigits, 16);
    if (second < 0xdc00 || second > 0xdfff) return null;
    const codePoint = 0x10000 + ((first - 0xd800) << 10) + (second - 0xdc00);
    return { value: String.fromCodePoint(codePoint), nextIndex: index + 10 };
  }
  return { value: String.fromCharCode(first), nextIndex: index + 4 };
}

function parseQuotedString(source, index = 0, allowedQuotes = ['"', "'", '`']) {
  const quote = source[index];
  if (!allowedQuotes.includes(quote)) return null;
  let i = index + 1;
  let value = '';

  while (i < source.length) {
    const char = source[i];
    if (char === quote) return { value, nextIndex: i + 1 };
    if (char === '\n' || char === '\r') return null;
    if (quote === '`') {
      value += char;
      i += 1;
      continue;
    }
    if (char !== '\\') {
      value += char;
      i += 1;
      continue;
    }

    const escaped = source[i + 1];
    const simple = {
      '\\': '\\', '"': '"', "'": "'", '`': '`', n: '\n', r: '\r', t: '\t', b: '\b', f: '\f',
    };
    if (Object.hasOwn(simple, escaped)) {
      value += simple[escaped];
      i += 2;
      continue;
    }
    if (escaped === 'u') {
      const unicode = parseUnicodeEscape(source, i + 2);
      if (!unicode) return null;
      value += unicode.value;
      i = unicode.nextIndex;
      continue;
    }
    return null;
  }
  return null;
}

function formatString(value) {
  let output = '"';
  for (const char of value) {
    if (char === '"') output += '\\"';
    else if (char === '\\') output += '\\\\';
    else if (char === '\n') output += '\\n';
    else if (char === '\r') output += '\\r';
    else if (char === '\t') output += '\\t';
    else if (char === '\b') output += '\\b';
    else if (char === '\f') output += '\\f';
    else if (char.codePointAt(0) < 0x20) output += `\\u${char.codePointAt(0).toString(16).padStart(4, '0')}`;
    else output += char;
  }
  return `${output}"`;
}

function canonicalNumber(raw) {
  let value = raw.replaceAll('_', '').replaceAll('E', 'e');
  if (value.startsWith('.')) value = `0${value}`;
  if (value.startsWith('-.')) value = value.replace('-.', '-0.');
  if (value.startsWith('+.')) value = value.replace('+.', '0.');
  if (value.startsWith('+') && /\d/.test(value[1] ?? '')) value = value.slice(1);
  const [rawMantissa = '', rawExponent] = value.split('e');
  let mantissa = rawMantissa;
  if (mantissa.includes('.')) {
    const [integer = '', fraction = ''] = mantissa.split('.');
    const trimmed = fraction.replace(/0+$/, '');
    mantissa = rawExponent !== undefined && trimmed.length === 0
      ? integer
      : `${integer}.${trimmed || '0'}`;
  }
  if (rawExponent === undefined) return mantissa;
  const negative = rawExponent.startsWith('-');
  const digits = (negative ? rawExponent.slice(1) : rawExponent.replace(/^\+/, '')).replace(/^0+/, '') || '0';
  return `${mantissa}e${negative && digits !== '0' ? '-' : ''}${digits}`;
}

function parseClarifierValue(source, index) {
  const i = skipWhitespace(source, index);
  if (source[i] === '"' || source[i] === "'") {
    const parsed = parseQuotedString(source, i, ['"', "'"]);
    return parsed ? { value: parsed.value, nextIndex: parsed.nextIndex } : null;
  }
  let end = i;
  while (end < source.length && source[end] !== ',' && source[end] !== ']') end += 1;
  const raw = source.slice(i, end).trim();
  if (!NUMBER_PATTERN.test(raw)) return null;
  return { value: Number(canonicalNumber(raw)), nextIndex: end };
}

function parseTypeAnnotationAt(source, index = 0, depth = 0) {
  if (depth > MAX_GENERIC_DEPTH) return null;
  const identifier = readIdentifier(source, index);
  if (!identifier || !IDENTIFIER_PATTERN.test(identifier.value)) return null;
  let i = identifier.nextIndex;
  const genericArgs = [];
  const clarifiers = [];

  if (source[i] === '<') {
    i += 1;
    while (true) {
      i = skipWhitespace(source, i);
      let argument;
      const numberEnd = source.slice(i).match(/^\d+/)?.[0];
      if (numberEnd) {
        argument = numberEnd;
        i += numberEnd.length;
      } else {
        const nested = parseTypeAnnotationAt(source, i, depth + 1);
        if (!nested) return null;
        argument = formatAeonDatatype(nested.datatype);
        i = nested.nextIndex;
      }
      genericArgs.push(argument);
      i = skipWhitespace(source, i);
      if (source[i] === ',') {
        i += 1;
        continue;
      }
      if (source[i] !== '>') return null;
      i += 1;
      break;
    }
  }

  if (source[i] === '[') {
    i += 1;
    while (true) {
      const clarifier = parseClarifierValue(source, i);
      if (!clarifier) return null;
      clarifiers.push(clarifier.value);
      i = skipWhitespace(source, clarifier.nextIndex);
      if (source[i] === ',') {
        i += 1;
        continue;
      }
      if (source[i] !== ']') return null;
      i += 1;
      break;
    }
    if (source[i] === '[') return null;
  }

  if (FAMILY_BY_DATATYPE.has(identifier.value) && genericArgs.length > 0 && !GENERIC_RESERVED_DATATYPES.has(identifier.value)) {
    return null;
  }
  if (identifier.value === 'radix' && genericArgs.length > 0) return null;
  return {
    datatype: { name: identifier.value, genericArgs, clarifiers },
    nextIndex: i,
  };
}

export function formatAeonDatatype(datatype) {
  if (!datatype || !IDENTIFIER_PATTERN.test(datatype.name ?? '')) throw new Error('invalid_typed_value');
  const genericArgs = Array.isArray(datatype.genericArgs) ? datatype.genericArgs : [];
  const clarifiers = Array.isArray(datatype.clarifiers) ? datatype.clarifiers : [];
  if (FAMILY_BY_DATATYPE.has(datatype.name) && genericArgs.length > 0 && !GENERIC_RESERVED_DATATYPES.has(datatype.name)) {
    throw new Error('invalid_typed_value');
  }
  const canonicalGenericArgs = genericArgs.map((entry) => {
    const argument = String(entry);
    if (/^\d+$/.test(argument)) return argument;
    const parsed = parseTypeAnnotationAt(argument, 0, 1);
    if (!parsed || parsed.nextIndex !== argument.length) throw new Error('invalid_typed_value');
    return formatAeonDatatype(parsed.datatype);
  });
  const generics = canonicalGenericArgs.length > 0 ? `<${canonicalGenericArgs.join(', ')}>` : '';
  const clarifierText = clarifiers.length > 0
    ? `[${clarifiers.map((entry) => {
      if (typeof entry === 'string') return formatString(entry);
      if (typeof entry !== 'number' || !Number.isFinite(entry)) throw new Error('invalid_typed_value');
      return canonicalNumber(String(entry));
    }).join(', ')}]`
    : '';
  return `${datatype.name}${generics}${clarifierText}`;
}

function isValidDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split('-').map(Number);
  if (month < 1 || month > 12 || day < 1) return false;
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return day <= days[month - 1];
}

function isValidClock(value, allowHourMarker = true) {
  if (allowHourMarker && /^\d{2}:$/.test(value)) return Number(value.slice(0, 2)) <= 23;
  if (/^\d{2}:\d{2}$/.test(value)) {
    return Number(value.slice(0, 2)) <= 23 && Number(value.slice(3, 5)) <= 59;
  }
  if (/^\d{2}:\d{2}:\d{2}$/.test(value)) {
    return Number(value.slice(0, 2)) <= 23
      && Number(value.slice(3, 5)) <= 59
      && Number(value.slice(6, 8)) <= 59;
  }
  return false;
}

function isValidTime(value, datetime = false) {
  let core = value;
  if (core.endsWith('Z')) core = core.slice(0, -1);
  else {
    const match = core.match(/([+-])(\d{2}):(\d{2})$/);
    if (match) {
      if (Number(match[2]) > 23 || Number(match[3]) > 59) return false;
      core = core.slice(0, -match[0].length);
    }
  }
  if (datetime && /^\d{2}$/.test(core)) return Number(core) <= 23;
  return isValidClock(core, true);
}

function temporalFamily(source) {
  if (isValidDate(source)) return 'date';
  if (isValidTime(source)) return 'time';
  const t = source.indexOf('T');
  if (t === -1 || !isValidDate(source.slice(0, t))) return null;
  const rest = source.slice(t + 1);
  const amp = rest.indexOf('&');
  if (amp === -1) return isValidTime(rest, true) ? 'datetime' : null;
  const clock = rest.slice(0, amp);
  const reference = rest.slice(amp + 1);
  if (!isValidTime(clock, true) || !/^[A-Za-z0-9_.+-]+(?:\/[A-Za-z0-9_.+-]+)*$/.test(reference)) return null;
  return 'wtc';
}

function validateBalancedSansa(source) {
  if (!SANSA_PATTERN.test(source) || /[\s,]/.test(source)) return false;
  const pairs = { '[': ']', '(': ')', '<': '>' };
  const stack = [];
  let quote = false;
  let escaped = false;
  for (const char of source) {
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') quote = false;
      continue;
    }
    if (char === '/' || char === '\\') return false;
    if (char === '"') quote = true;
    else if (pairs[char]) stack.push(pairs[char]);
    else if (Object.values(pairs).includes(char) && stack.pop() !== char) return false;
  }
  return !quote && stack.length === 0 && !source.endsWith('.') && !source.includes('..');
}

function validateSeparator(source) {
  if (!source.startsWith('^') || source.length === 1) return false;
  let i = 1;
  let sawPayload = false;
  while (i < source.length) {
    if (source[i] === '"' || source[i] === "'") {
      const quoted = parseQuotedString(source, i, ['"', "'"]);
      if (!quoted) return false;
      i = quoted.nextIndex;
      sawPayload = true;
      continue;
    }
    if (!/[A-Za-z0-9!#$%&*+\-.:;=?@^_|~<>]/.test(source[i])) return false;
    sawPayload = true;
    i += 1;
  }
  return sawPayload;
}

function parseScalar(source) {
  if (source.startsWith('"') || source.startsWith("'") || source.startsWith('`')) {
    const quoted = parseQuotedString(source);
    if (!quoted || quoted.nextIndex !== source.length) return null;
    return { type: 'StringLiteral', value: quoted.value };
  }
  if (source.startsWith('!')) {
    const sentinel = source.slice(1);
    if (RESERVED_NULL_SENTINELS.has(sentinel)) {
      return { type: 'NullLiteral', mode: 'reserved', value: sentinel };
    }
    const quoted = parseQuotedString(source, 1, ['"', "'"]);
    if (
      !quoted
      || quoted.nextIndex !== source.length
      || quoted.value.length === 0
      || /^[ \t\r\n]+$/.test(quoted.value)
      || RESERVED_NULL_SENTINELS.has(quoted.value)
    ) return null;
    return { type: 'NullLiteral', mode: 'reason', value: quoted.value };
  }
  if (source === 'Infinity' || source === '-Infinity') return { type: 'InfinityLiteral', value: source };
  if (source === 'NaN' || source === '-NaN') return { type: 'NaNLiteral', value: source };
  if (source === 'true' || source === 'false') return { type: 'BooleanLiteral', value: source === 'true' };
  if (['yes', 'no', 'on', 'off'].includes(source)) return { type: 'ToggleLiteral', value: source };
  if (HEX_PATTERN.test(source)) return { type: 'HexLiteral', value: source.slice(1).replaceAll('_', '').toLowerCase() };
  if (RADIX_PATTERN.test(source)) return { type: 'RadixLiteral', value: source.slice(1).replaceAll('_', '') };
  if (ENCODING_PATTERN.test(source)) return { type: 'EncodingLiteral', value: source.slice(1) };
  if (validateSeparator(source)) return { type: 'SeparatorLiteral', value: source.slice(1) };
  if (validateBalancedSansa(source)) return { type: 'SansaAddressLiteral', value: source };
  const temporal = temporalFamily(source);
  if (temporal === 'date') return { type: 'DateLiteral', value: source };
  if (temporal === 'time') return { type: 'TimeLiteral', value: source };
  if (temporal === 'datetime' || temporal === 'wtc') return { type: 'DateTimeLiteral', value: source, temporalKind: temporal };
  if (NUMBER_PATTERN.test(source)) return { type: 'NumberLiteral', value: canonicalNumber(source) };
  return null;
}

function scalarFamily(value) {
  const families = {
    StringLiteral: 'string', NumberLiteral: 'number', InfinityLiteral: 'infinity', NaNLiteral: 'nan',
    NullLiteral: 'null', BooleanLiteral: 'boolean', ToggleLiteral: 'toggle', HexLiteral: 'hex',
    RadixLiteral: 'radix', EncodingLiteral: 'encoding', DateLiteral: 'date', TimeLiteral: 'time',
    SeparatorLiteral: 'separator', SansaAddressLiteral: 'sansa',
  };
  if (value.type === 'DateTimeLiteral') return value.temporalKind;
  return families[value.type] ?? null;
}

function validateCompatibility(datatype, value) {
  if (UNSUPPORTED_RESERVED_DATATYPES.has(datatype.name)) return false;
  const expected = FAMILY_BY_DATATYPE.get(datatype.name);
  if (!expected) return true;
  return expected === scalarFamily(value);
}

export function parseAeonInlineTypedValue(source) {
  const datatypeResult = parseTypeAnnotationAt(source, 0);
  if (!datatypeResult) return failure();
  let i = skipWhitespace(source, datatypeResult.nextIndex);
  if (source[i] !== '=') return failure();
  i = skipWhitespace(source, i + 1);
  const scalarSource = source.slice(i).trimEnd();
  if (scalarSource.length === 0) return failure();
  const value = parseScalar(scalarSource);
  if (!value || !validateCompatibility(datatypeResult.datatype, value)) return failure();
  return { ok: true, datatype: datatypeResult.datatype, value };
}

function emitAeonScalarUnchecked(value) {
  if (!value || typeof value !== 'object') throw new Error('invalid_typed_value');
  switch (value.type) {
    case 'StringLiteral': return formatString(String(value.value));
    case 'NumberLiteral': return canonicalNumber(String(value.value));
    case 'InfinityLiteral':
      if (!['Infinity', '-Infinity'].includes(value.value)) throw new Error('invalid_typed_value');
      return value.value;
    case 'NaNLiteral':
      if (!['NaN', '-NaN'].includes(value.value)) throw new Error('invalid_typed_value');
      return value.value;
    case 'NullLiteral':
      if (value.mode === 'reserved' && RESERVED_NULL_SENTINELS.has(value.value)) return `!${value.value}`;
      if (value.mode === 'reason' && typeof value.value === 'string' && value.value.trim().length > 0) return `!${formatString(value.value)}`;
      throw new Error('invalid_typed_value');
    case 'BooleanLiteral': return value.value === true ? 'true' : value.value === false ? 'false' : (() => { throw new Error('invalid_typed_value'); })();
    case 'ToggleLiteral':
      if (!['yes', 'no', 'on', 'off'].includes(value.value)) throw new Error('invalid_typed_value');
      return value.value;
    case 'HexLiteral': return `#${String(value.value).replaceAll('_', '').toLowerCase()}`;
    case 'RadixLiteral': return `%${String(value.value).replaceAll('_', '')}`;
    case 'EncodingLiteral': return `&${value.value}`;
    case 'SeparatorLiteral': return `^${value.value}`;
    case 'SansaAddressLiteral': return String(value.value);
    case 'DateLiteral':
    case 'TimeLiteral':
    case 'DateTimeLiteral': return String(value.value);
    default: throw new Error('invalid_typed_value');
  }
}

export function emitAeonScalar(value) {
  const emitted = emitAeonScalarUnchecked(value);
  const reparsed = parseScalar(emitted);
  if (
    !reparsed
    || reparsed.type !== value.type
    || reparsed.value !== value.value
    || (value.type === 'NullLiteral' && reparsed.mode !== value.mode)
    || (value.type === 'DateTimeLiteral' && reparsed.temporalKind !== value.temporalKind)
  ) {
    throw new Error('invalid_typed_value');
  }
  return emitted;
}

export function emitAeonInlineTypedValue(datatype, value) {
  const datatypeText = formatAeonDatatype(datatype);
  if (!validateCompatibility(datatype, value)) throw new Error('invalid_typed_value');
  return `${datatypeText} = ${emitAeonScalar(value)}`;
}

export function displayAeonScalar(value) {
  if (value?.type === 'StringLiteral') return value.value;
  if (value?.type === 'NullLiteral' && value.mode === 'reason') return value.value;
  return emitAeonScalar(value);
}
