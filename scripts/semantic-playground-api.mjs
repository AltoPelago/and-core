import fs from 'node:fs/promises';
import { fromAeon, normalizeAeon, profile, toAeon } from '../examples/v2-aeon-roundtrip/bridge.mjs';
import { queries } from '../examples/v2-aeon-roundtrip/queries.mjs';
import { renderQueryViews } from './semantic-query-output.mjs';
import { loadAeon } from '../examples/v2-aeon-roundtrip/aeon-runtime.mjs';

export const maxSourceLength = 262_144;
let runtimePromise;
const runtime = () => runtimePromise ??= loadAeon().catch((error) => { runtimePromise = undefined; throw error; });

export async function bootstrap() {
  return {
    ok: true, profile, maxSourceLength, queries,
    and: await fs.readFile(new URL('../examples/v2-aeon-roundtrip/input.and', import.meta.url), 'utf8'),
  };
}

export async function executeSemanticRequest(operation, request, engine) {
  if (!request || typeof request.source !== 'string' || request.source.length > maxSourceLength) {
    throw new Error(`Source must be text of at most ${maxSourceLength.toLocaleString()} characters.`);
  }
  const selected = engine ?? await runtime();
  if (operation === 'convert') {
    if (!['to-aeon', 'to-and'].includes(request.direction)) throw new Error('Choose a conversion direction.');
    const aeon = request.direction === 'to-aeon' ? toAeon(request.source) : request.source;
    const restored = fromAeon(aeon, selected);
    const normalized = normalizeAeon(aeon, selected);
    if (toAeon(restored.canonical) !== normalized) throw new Error('Semantic round-trip verification failed.');
    return { ok: true, and: restored.canonical, aeon: normalized, profile, verified: true };
  }
  if (operation === 'query') {
    if (typeof request.query !== 'string' || !request.query.trim() || request.query.length > 16_384) {
      throw new Error('Enter a SANSA query of at most 16,384 characters.');
    }
    // Query the editor's native AEON directly, including source-free documents.
    // No &ND-specific namespace or silent normalization is introduced here.
    const { namespace } = selected.readAeonNamespace(request.source);
    const evaluation = selected.evaluateQuery(request.query, namespace);
    return evaluation.ok ? { ...evaluation, ...renderQueryViews(evaluation, request.source, selected) } : evaluation;
  }
  throw new Error('Unknown playground operation.');
}

export async function handleSemanticApi(request, response, pathname) {
  const send = (status, value) => {
    response.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
    response.end(JSON.stringify(value));
  };
  if (request.headers.origin && request.headers.origin !== `http://${request.headers.host}`) {
    send(403, { ok: false, message: 'Requests must originate from this playground.' });
    return;
  }
  try {
    if (pathname === '/api/semantic/bootstrap' && request.method === 'GET') {
      send(200, await bootstrap());
      return;
    }
    if (request.method !== 'POST' || !['/api/semantic/convert', '/api/semantic/query'].includes(pathname)) {
      send(405, { ok: false, message: 'Unsupported playground request.' });
      return;
    }
    if (!request.headers['content-type']?.startsWith('application/json')) {
      send(415, { ok: false, message: 'Expected JSON input.' });
      return;
    }
    const chunks = [];
    let length = 0;
    for await (const chunk of request) {
      length += chunk.length;
      if (length > 2_097_152) {
        send(413, { ok: false, message: 'Request is too large.' });
        return;
      }
      chunks.push(chunk);
    }
    const body = JSON.parse(Buffer.concat(chunks).toString('utf8'));
    send(200, await executeSemanticRequest(pathname.split('/').at(-1), body));
  } catch (error) {
    send(400, { ok: false, message: error.message, code: error.code ?? 'playground_error' });
  }
}
