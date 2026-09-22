import { afterEach, describe, expect, it, vi } from 'vitest';
import { createWorkflowToolClient, workflowArguments } from './workflowToolClient';

function gateway() {
    const fetcher = vi.fn(async (_url: unknown, options: RequestInit) => {
        const request = JSON.parse(String(options.body));
        const result = request.method === 'server/discover' ? { supportedVersions: ['2026-07-28'], capabilities: { tools: {} } }
            : request.method === 'tools/list' ? { tools: [{ name: 'intake', inputSchema: { type: 'object' } }] }
                : { isError: false, structuredContent: { workflowInstanceId: 'run' } };
        return new Response(JSON.stringify({ jsonrpc: '2.0', id: request.id, result }), {
            headers: { 'content-type': 'application/json' },
        });
    });
    vi.stubGlobal('fetch', fetcher);
    return fetcher;
}

afterEach(() => vi.unstubAllGlobals());
describe('Gateway Workflow client', () => {
    it('uses fixed stateless Gateway requests with browser credentials', async () => {
        const fetcher = gateway();
        const client = createWorkflowToolClient();
        expect((await client.findTool('intake')).name).toBe('intake');
        await client.invoke('intake', { stageClaim: { transitionId: 'stable' } }, '');
        expect(fetcher).toHaveBeenCalledTimes(3);
        for (const [url, request] of fetcher.mock.calls) {
            expect(url).toBe('/mcp');
            expect(request.credentials).toBe('include');
            expect(request.headers).not.toHaveProperty('Authorization');
        }
        expect(fetcher.mock.calls[1][1].headers).not.toHaveProperty('Mcp-Session-Id');
        expect(fetcher.mock.calls[2][1].headers).toHaveProperty('Mcp-Name', 'intake');
        expect(JSON.parse(String(fetcher.mock.calls[2][1].body)).params).toMatchObject({
            name: 'intake', arguments: { stageClaim: { transitionId: 'stable' } },
        });
    });
    it('never substitutes a different catalog Tool', async () => {
        const fetcher = gateway();
        await expect(createWorkflowToolClient().findTool('missing')).rejects.toThrow('not available');
        expect(fetcher).toHaveBeenCalledTimes(2);
    });
    it('does not require catalog state before invocation', async () => {
        const fetcher = gateway();
        await expect(createWorkflowToolClient().invoke('intake', {}, '')).resolves.toBeTruthy();
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
    it('rejects a token pasted instead of a grant reference before transmitting it', async () => {
        const fetcher = gateway();
        const client = createWorkflowToolClient();
        await client.findTool('intake');
        await expect(client.invoke('intake', {}, 'Bearer secret')).rejects.toThrow('UUID, not a token');
        expect(fetcher).toHaveBeenCalledTimes(2);
    });
    it('does not replay calls after an ambiguous transport failure', async () => {
        const fetcher = gateway();
        const client = createWorkflowToolClient();
        await client.findTool('intake');
        fetcher.mockRejectedValueOnce(new Error('connection lost'));
        await expect(client.invoke('intake', {}, '')).rejects.toThrow('connection lost');
        expect(fetcher).toHaveBeenCalledTimes(3);
    });
    it('rejects HTML fallback and HTTP authentication failures', async () => {
        const fetcher = gateway();
        fetcher.mockResolvedValueOnce(new Response('<html>', { headers: { 'content-type': 'text/html' } }));
        await expect(createWorkflowToolClient().findTool('intake')).rejects.toThrow('/mcp proxy');
        fetcher.mockResolvedValueOnce(new Response('', { status: 403 }));
        await expect(createWorkflowToolClient().findTool('intake')).rejects.toThrow('HTTP 403');
    });
    it('rejects mismatched response IDs', async () => {
        const fetcher = gateway();
        fetcher.mockResolvedValueOnce(new Response(JSON.stringify({ jsonrpc: '2.0', id: 'wrong', result: {} }), {
            headers: { 'content-type': 'application/json' },
        }));
        await expect(createWorkflowToolClient().findTool('intake')).rejects.toThrow('identity mismatch');
    });
    it('shows only a static diagnosis for known HTTP rejections', async () => {
        const fetcher = gateway();
        fetcher.mockResolvedValueOnce(new Response('browser Origin is not allowed; private-value', { status: 403 }));
        await expect(createWorkflowToolClient().findTool('intake')).rejects.toThrow('Browser Origin is not allowed by the MCP router.');
        fetcher.mockResolvedValueOnce(new Response('unknown private-value', { status: 403 }));
        await expect(createWorkflowToolClient().findTool('intake')).rejects.not.toThrow('private-value');
    });
    it.each(['[]', 'null', '"string"', '5'])('rejects non-object input %s', raw => {
        expect(() => workflowArguments(raw)).toThrow('JSON object');
    });
    it('bounds arguments by encoded bytes', () => {
        expect(() => workflowArguments(JSON.stringify({ text: 'a'.repeat(65536) }))).toThrow('64 KiB');
        expect(workflowArguments('{"value":1}')).toEqual({ value: 1 });
    });
});
