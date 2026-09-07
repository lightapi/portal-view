import { useEffect, useState } from 'react';
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';

export type ChatAgent = {
    hostId: string;
    instanceId: string;
    instanceName?: string;
    productId: string;
    serviceId?: string;
    envTag?: string;
    active: boolean;
};

export function useChatAgents(host: string | null | undefined, email: string | null | undefined, authenticated: boolean) {
    const context = JSON.stringify([host, email, authenticated]);
    const [result, setResult] = useState<{ context: string; agents: ChatAgent[] }>({ context: '', agents: [] });
    const [selectedId, setSelectedId] = useState('');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [selectionMessage, setSelectionMessage] = useState('');
    const [revision, setRevision] = useState(0);
    const agents = result.context === context ? result.agents : [];
    const selected = agents.find(agent => agent.instanceId === selectedId);

    useEffect(() => {
        const controller = new AbortController();
        setSelectedId(''); setLoadError(''); setSelectionMessage(''); setLoading(true);
        setResult({ context, agents: [] });
        if (!host || !authenticated) {
            setLoading(false);
            return () => controller.abort();
        }
        const load = async () => {
            try {
                const found: ChatAgent[] = [];
                let offset = 0;
                const limit = 100;
                while (!controller.signal.aborted) {
                    const response = await fetchClient('/portal/query', {
                        method: 'POST', signal: controller.signal,
                        body: {
                            host: 'lightapi.net', service: 'instance', action: 'getInstance', version: '0.1.0',
                            data: { hostId: host, active: true, offset, limit,
                                filters: JSON.stringify([{ id: 'productId', value: 'agt' }]),
                                sorting: JSON.stringify([{ id: 'instanceId', desc: false }]), globalFilter: '' },
                        },
                    });
                    if (!Array.isArray(response.instances) || !Number.isSafeInteger(response.total) || response.total < 0) {
                        throw new Error('The server returned an invalid instance list.');
                    }
                    const page = response.instances as ChatAgent[];
                    // The query filter may use substring matching. Keep exact product and Host matches.
                    found.push(...page.filter(agent => agent.hostId === host && agent.productId === 'agt' && agent.active));
                    offset += page.length;
                    if (offset >= response.total) break;
                    if (!page.length) break; // Totals may become stale or include rows outside visibility scope.
                }
                if (controller.signal.aborted) return;
                const unique = Array.from(new Map(found.map(agent => [agent.instanceId, agent])).values());
                setResult({ context, agents: unique });
                const params = new URLSearchParams(window.location.search);
                const instanceId = params.get('instanceId');
                const serviceId = params.get('serviceId');
                const envTag = params.get('envTag');
                const candidates = unique.filter(agent => instanceId ? agent.instanceId === instanceId
                    : serviceId ? agent.serviceId === serviceId && (!envTag || agent.envTag === envTag) : false);
                if (candidates.length === 1) setSelectedId(candidates[0].instanceId);
                else if (candidates.length > 1) setSelectionMessage(`This link matches multiple deployed agents. Select one: ${candidates.map(agent => `${agent.instanceName || agent.serviceId} (${agent.envTag}, ${agent.instanceId})`).join('; ')}.`);
                else if (instanceId || serviceId) setLoadError('The linked agent is unavailable for this Host. Select an agent from the list.');
                else if (unique.length === 1) setSelectedId(unique[0].instanceId);
            } catch (error) {
                if (!controller.signal.aborted) setLoadError(loadErrorMessage(error));
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };
        void load();
        return () => controller.abort();
    }, [host, authenticated, context, revision]);

    return { agents, selected, loading: loading || result.context !== context, loadError, selectionMessage,
        selectAgent: (id: string) => { setSelectedId(id); setLoadError(''); setSelectionMessage(''); },
        reload: () => setRevision(value => value + 1) };
}
