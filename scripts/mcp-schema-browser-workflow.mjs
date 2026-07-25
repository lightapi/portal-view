const [pageUrl, debuggerPort] = process.argv.slice(2);
if (!pageUrl || !debuggerPort) {
  throw new Error('usage: node scripts/mcp-schema-browser-workflow.mjs <page-url> <debugger-port>');
}

const deadline = Date.now() + 20_000;
async function retry(operation) {
  let lastError;
  while (Date.now() < deadline) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw lastError ?? new Error('browser workflow timed out');
}

const target = await retry(async () => {
  const response = await fetch(
    `http://127.0.0.1:${debuggerPort}/json/new?${encodeURIComponent(pageUrl)}`,
    { method: 'PUT' },
  );
  if (!response.ok) throw new Error(`cannot create browser target: ${response.status}`);
  return response.json();
});

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let commandId = 0;
const pending = new Map();
socket.addEventListener('message', (event) => {
  const message = JSON.parse(event.data);
  const waiter = pending.get(message.id);
  if (!waiter) return;
  pending.delete(message.id);
  if (message.error) waiter.reject(new Error(message.error.message));
  else waiter.resolve(message.result);
});

function command(method, params = {}) {
  const id = ++commandId;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitFor(expression, message) {
  return retry(async () => {
    const value = await evaluate(expression);
    if (!value) throw new Error(message);
    return value;
  });
}

try {
  await command('Runtime.enable');
  await waitFor(
    `document.querySelector('[data-mcp-qualification="ready"]') !== null`,
    'generated catalog did not render',
  );
  await evaluate(`Array.from(document.querySelectorAll('button')).find((item) => item.textContent.includes('Advanced metadata')).click()`);
  await waitFor(
    `document.body.innerText.includes('eventId (conditional)') && document.body.innerText.includes('personId (conditional)')`,
    'composed variant properties were not previewed',
  );
  await waitFor(
    `Array.from(document.querySelectorAll('textarea')).some((item) => item.value.includes('"oneOf"'))`,
    'advanced editor did not preserve the generated composed schema',
  );
  await evaluate(`Array.from(document.querySelectorAll('label')).find((item) => item.textContent.includes('Reset schema to endpoint on save')).querySelector('input').click()`);
  await waitFor(
    `document.querySelector('[data-reset="true"]') !== null`,
    'reset-to-generated-schema control did not update the draft',
  );
  process.stdout.write('MCP browser qualification passed\n');
} finally {
  socket.close();
}
