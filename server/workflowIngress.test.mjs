import assert from 'node:assert/strict';
import { test } from 'node:test';
import http from 'node:http';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createIngress, ingressHeaders, workflowIngressPlugin } from './workflowIngress.mjs';

const origin = 'https://localhost:3000';
const headers = { origin, cookie: 'accessToken=test; csrf=c', 'x-csrf-token': 'c',
  'content-type': 'application/json', 'mcp-session-id': 'session' };
const request = h => ({ headers: h, rawHeaders: Object.entries(h).flat() });
test('only explicit enablement; session and token-bound CSRF remain Gateway responsibilities', () => {
  assert.equal(workflowIngressPlugin(''), null);
  assert.equal(ingressHeaders(request(headers), origin, 'Bearer app')['x-scope-token'], 'Bearer app');
});
test('reject absent session, missing CSRF, foreign/missing Origin and supplied identities', () => {
  for (const patch of [{ cookie: '' }, { 'x-csrf-token': '' }, { origin: '' },
    { origin: 'https://evil.test' }, { authorization: 'Bearer user' },
    { 'x-scope-token': 'Bearer workflow' }, { 'x-workflow-action': 'action' },
    { 'content-type': 'text/plain' }]) {
    assert.equal(ingressHeaders(request({ ...headers, ...patch }), origin, 'Bearer app'), null);
  }
});
test('duplicate credential-bearing headers are rejected; forwarded assertions are not copied', () => {
  const r = request(headers); r.rawHeaders.push('Cookie', 'accessToken=other');
  assert.equal(ingressHeaders(r, origin, 'Bearer app'), null);
  const h = ingressHeaders(request({ ...headers, 'x-forwarded-client-cert': 'forged',
    'x-user-id': 'forged' }), origin, 'Bearer app');
  assert.equal(h['x-forwarded-client-cert'], undefined);
  assert.equal(h['x-user-id'], undefined);
});
test('HTTP/2 split cookie fields are joined, but duplicate session names remain denied', () => {
  const r = request({ ...headers, cookie: 'accessToken=test' });
  r.httpVersionMajor = 2;
  r.rawHeaders.push('cookie', 'csrf=c');
  assert.equal(ingressHeaders(r, origin, 'Bearer app').cookie, 'accessToken=test; csrf=c');
  r.rawHeaders.push('cookie', 'accessToken=other');
  assert.equal(ingressHeaders(r, origin, 'Bearer app'), null);
});
test('fixed destination, no retries, response headers filtered and cookies preserved', async () => {
  let calls = 0;
  const send = (target, options, callback) => {
    calls++;
    assert.equal(target, 'https://localhost/mcp');
    assert.equal(options.headers['x-scope-token'], 'Bearer app');
    const upstream = new EventEmitter(); upstream.destroy = () => {};
    upstream.end = () => {
      const response = Readable.from([Buffer.from('{}')]);
      response.statusCode = 200;
      response.headers = { 'content-type': 'application/json', 'mcp-session-id': 's',
        'set-cookie': ['accessToken=renewed; Secure; HttpOnly'], 'x-scope-token': 'never-forward' };
      callback(response);
    };
    return upstream;
  };
  const middleware = createIngress({ origin, target: 'https://localhost/mcp', scope: 'Bearer app' }, send);
  const server = http.createServer((req, res) => middleware(req, res, () => res.writeHead(404).end()));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const r = await fetch(base + '/mcp', { method: 'POST', headers, body: '{}' });
    assert.equal(r.status, 200); assert.equal(r.headers.get('mcp-session-id'), 's');
    assert.equal(r.headers.get('x-scope-token'), null);
    assert.match(r.headers.get('set-cookie'), /renewed/);
    assert.equal((await fetch(base + '/mcp?target=other', { method: 'POST', headers, body: '{}' })).status, 404);
    assert.equal((await fetch(base + '/mcp', { headers })).status, 405);
    assert.equal((await fetch(base + '/mcp', { method: 'POST', body: '{}' })).status, 403);
    assert.equal(calls, 1);
  } finally { await new Promise(resolve => server.close(resolve)); }
});

for (const failure of ['transport', 'oversized response']) {
  test(`${failure} fails closed without retry or partial response`, async () => {
    let calls = 0;
    const send = (_target, _options, callback) => {
      calls++;
      const upstream = new EventEmitter(); upstream.destroy = () => {};
      upstream.end = () => {
        if (failure === 'transport') { upstream.emit('error', new Error('private detail')); return; }
        const response = Readable.from([Buffer.alloc(2 * 1024 * 1024 + 1)]);
        response.statusCode = 200; response.headers = {};
        callback(response);
      };
      return upstream;
    };
    const middleware = createIngress({ origin, target: 'https://localhost/mcp', scope: 'Bearer app' }, send);
    const server = http.createServer((req, res) => middleware(req, res, () => res.writeHead(404).end()));
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    try {
      const r = await fetch(`http://127.0.0.1:${server.address().port}/mcp`, { method: 'POST', headers, body: '{}' });
      assert.equal(r.status, 502); assert.equal(await r.text(), ''); assert.equal(calls, 1);
    } finally { await new Promise(resolve => server.close(resolve)); }
  });
}
