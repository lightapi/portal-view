import Cookies from 'universal-cookie';
import { BASE_URL } from '../../utils/fetchClient';

const protocolVersion = '2025-03-26';
const maximumResponseBytes = 2 * 1024 * 1024;

export type GatewayWorkflowTool = {
    name: string;
    description?: string;
    inputSchema: Record<string, unknown>;
};

export function workflowArguments(raw: string): Record<string, unknown> {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Arguments must be a JSON object.');
    }
    if (new TextEncoder().encode(raw).length > 65536) {
        throw new Error('Arguments exceed the 64 KiB operator limit.');
    }
    return value as Record<string, unknown>;
}

/** Session credentials stay inside the ordinary browser/BFF boundary. No token input,
 * credential export, arbitrary target URL, or automatic invocation retry is exposed. */
export function createWorkflowToolClient() {
    let sessionId: string | null = null;
    let initialized = false;
    const endpoint = import.meta.env.DEV ? '/mcp' : `${BASE_URL}/mcp`;

    async function request(method: string, params: Record<string, unknown>, grantId?: string) {
        const id = crypto.randomUUID();
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
            'MCP-Protocol-Version': protocolVersion,
        };
        const csrf: unknown = new Cookies().get('csrf');
        if (typeof csrf === 'string' && csrf) headers['X-CSRF-TOKEN'] = csrf;
        if (sessionId) headers['Mcp-Session-Id'] = sessionId;
        if (grantId) {
            if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(grantId)) {
                throw new Error('Workflow grant reference must be a UUID, not a token.');
            }
            headers['X-Workflow-Grant'] = grantId;
        }
        const response = await fetch(endpoint, {
            method: 'POST', credentials: 'include', headers,
            body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
            signal: AbortSignal.timeout(30000),
        });
        const reader = response.body?.getReader();
        if (!reader) throw new Error('Gateway returned no response body.');
        const chunks: Uint8Array[] = [];
        let size = 0;
        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                size += value.length;
                if (size > maximumResponseBytes) {
                    await reader.cancel();
                    throw new Error('Gateway response exceeds the 2 MiB operator limit.');
                }
                chunks.push(value);
            }
        } finally {
            reader.releaseLock();
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
        const text = new TextDecoder().decode(bytes);
        if (!response.ok) {
            // Emit only known static diagnoses, never arbitrary server body text.
            const known = [
                ...['duplicate headers', 'supplied service identity', 'Origin mismatch',
                    'missing CSRF', 'non-JSON request', 'missing session']
                    .map(reason => [`Portal ingress: ${reason}`, `Portal ingress rejected: ${reason}.`]),
                ['browser Origin is not allowed', 'Browser Origin is not allowed by the MCP router.'],
                ['workflow caller denied', 'Workflow caller authorization was denied.'],
                ['CSRF', 'Portal CSRF verification failed.'],
                ['missing bearer token', 'The Gateway received no bearer identity.'],
            ].find(([fragment]) => text.includes(fragment));
            const reason = known?.[1] ?? 'Check the session, CSRF and Gateway route configuration.';
            throw new Error(`Gateway HTTP ${response.status}. ${reason} No automatic retry was made.`);
        }
        if (!response.headers.get('content-type')?.includes('application/json')) {
            throw new Error('Expected a Gateway JSON response. Check the /mcp proxy route.');
        }
        const result = JSON.parse(text);
        if (result.jsonrpc !== '2.0' || result.id !== id) throw new Error('Gateway response identity mismatch.');
        if (result.error) throw new Error(`Gateway RPC ${result.error.code}: ${String(result.error.message)}`);
        if (method === 'initialize') {
            if (result.result?.protocolVersion !== protocolVersion) throw new Error('Gateway protocol version mismatch.');
            sessionId = response.headers.get('mcp-session-id');
            if (!sessionId) throw new Error('Gateway returned no MCP session.');
            initialized = true;
        }
        return result.result;
    }

    return {
        async findTool(name: string): Promise<GatewayWorkflowTool> {
            if (!initialized) await request('initialize', {
                protocolVersion, capabilities: {}, clientInfo: { name: 'light-portal-workflow', version: '1.0.0' },
            });
            const result = await request('tools/list', {});
            const matches = Array.isArray(result?.tools)
                ? result.tools.filter((tool: GatewayWorkflowTool) => tool.name === name) : [];
            if (matches.length !== 1 || !matches[0].inputSchema) {
                throw new Error('This Tool is not available in the current Gateway catalog for your session. Check publication, activation and access.');
            }
            return matches[0];
        },
        async invoke(name: string, args: Record<string, unknown>, grantId: string) {
            if (!initialized) throw new Error('Load the live Gateway Tool before invoking.');
            return request('tools/call', { name, arguments: args }, grantId.trim());
        },
    };
}
