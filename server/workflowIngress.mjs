// Development-only trusted Portal ingress. Never import this module from src/.
import fs from 'node:fs';
import https from 'node:https';
import path from 'node:path';

const requestLimit = 1024 * 1024;
const responseLimit = 2 * 1024 * 1024;
const allowedHeaders = ['cookie', 'x-csrf-token', 'origin', 'content-type', 'accept',
  'mcp-protocol-version', 'mcp-method', 'mcp-name', 'x-workflow-grant'];
const responseHeaders = ['content-type', 'mcp-protocol-version',
  'set-cookie', 'retry-after'];

export function ingressHeaders(req, origin, scope, rejected = () => {}) {
  const deny = reason => { rejected(reason); return null; };
  const names = req.rawHeaders.filter((_, i) => i % 2 === 0).map(v => v.toLowerCase());
  if (allowedHeaders.some(n => !(n === 'cookie' && req.httpVersionMajor === 2) &&
      names.filter(v => v === n).length > 1)) return deny('duplicate headers');
  if (names.some(n => ['authorization', 'x-scope-token', 'x-workflow-action'].includes(n))) return deny('supplied service identity');
  // RFC 9113 section 8.2.3 permits split Cookie fields in HTTP/2. Join those
  // fields, but still reject ambiguous duplicate session/CSRF cookie names.
  const cookie = req.rawHeaders.filter((_, i) => i % 2 === 1 && names[(i - 1) / 2] === 'cookie').join('; ');
  const cookieNames = cookie.split(';').map(pair => pair.trim().split('=')[0]);
  if (['accessToken', 'refreshToken', 'csrf'].some(n => cookieNames.filter(v => v === n).length > 1)) {
    return deny('duplicate headers');
  }
  const h = { ...req.headers, cookie };
  if (h.origin !== origin) return deny('Origin mismatch');
  if (!h['x-csrf-token']) return deny('missing CSRF');
  if (!/^application\/json(?:\s*;|$)/i.test(h['content-type'] || '')) return deny('non-JSON request');
  // Cookie presence is NOT authentication. Gateway validates the signed session
  // and token-bound CSRF before it authenticates our dedicated application.
  if (!/(?:^|;\s*)(accessToken|refreshToken)=[^;]+/.test(h.cookie || '')) return deny('missing session');
  return { ...Object.fromEntries(allowedHeaders.filter(n => h[n] !== undefined).map(n => [n, h[n]])),
    'x-scope-token': scope };
}

export function createIngress({ origin, target, agent, scope }, send = https.request) {
  return async (req, res, next) => {
    if (req.url !== '/mcp') {
      if (/^\/mcp(?:[/?]|$)/.test(req.url || '')) {
        res.writeHead(404).end();
      } else next();
      return;
    }
    const fail = status => {
      if (!res.headersSent && !res.destroyed) res.writeHead(status, { 'Cache-Control': 'no-store' }).end();
    };
    if (req.method !== 'POST') { fail(405); return; }
    let rejection;
    const headers = ingressHeaders(req, origin, scope, reason => { rejection = reason; });
    if (!headers) {
      res.writeHead(403, { 'Cache-Control': 'no-store', 'Content-Type': 'application/json' })
        .end(JSON.stringify({ error: `Portal ingress: ${rejection}` }));
      return;
    }
    let upstream;
    const timer = setTimeout(() => { upstream?.destroy(); fail(504); req.destroy(); }, 30000);
    res.once('close', () => { clearTimeout(timer); upstream?.destroy(); });
    try {
      const chunks = [];
      let length = 0;
      for await (const chunk of req) {
        length += chunk.length;
        if (length > requestLimit) { fail(413); return; }
        chunks.push(chunk);
      }
      if (res.destroyed) return;
      const body = Buffer.concat(chunks);
      // Fixed destination and exact path: no redirect following or supplied URL.
      upstream = send(target, { method: 'POST', agent, headers: {
        ...headers, 'content-length': String(body.length),
      } }, async response => {
        try {
          const parts = [];
          let size = 0;
          for await (const part of response) {
            size += part.length;
            if (size > responseLimit) { response.destroy(); fail(502); return; }
            parts.push(part);
          }
          if (res.destroyed) return;
          const selected = Object.fromEntries(responseHeaders
            .filter(n => response.headers[n] !== undefined).map(n => [n, response.headers[n]]));
          res.writeHead(response.statusCode, { ...selected, 'Cache-Control': 'no-store' });
          res.end(Buffer.concat(parts));
        } catch { fail(502); }
      });
      upstream.on('error', () => fail(502));
      upstream.end(body);
    } catch { fail(400); }
  };
}

export function workflowIngressPlugin(configFile) {
  if (!configFile) return null;
  return {
    name: 'local-workflow-ingress', apply: 'serve',
    configureServer(server) {
      const file = path.resolve(configFile);
      const c = JSON.parse(fs.readFileSync(file, 'utf8'));
      // Deliberately local-only. Managed deployments need a packaged BFF.
      if (c.origin !== 'https://localhost:3000' || c.target !== 'https://localhost/mcp') {
        throw new Error('Invalid local Workflow ingress destination');
      }
      const read = name => fs.readFileSync(path.resolve(path.dirname(file), c[name]));
      const scope = read('scopeTokenFile').toString().trim();
      if (!/^Bearer [A-Za-z0-9_.-]+$/.test(scope)) throw new Error('Invalid ingress app credential');
      const agent = new https.Agent({ ca: read('caFile'), cert: read('certificateFile'),
        key: read('keyFile'), rejectUnauthorized: true, keepAlive: true, maxSockets: 8 });
      server.middlewares.use(createIngress({ origin: c.origin, target: c.target, scope, agent }));
      server.httpServer?.once('close', () => agent.destroy());
    },
  };
}
