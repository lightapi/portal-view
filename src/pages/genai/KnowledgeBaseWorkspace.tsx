import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog,
    DialogActions, DialogContent, DialogTitle, Divider, FormControl,
    FormControlLabel, Grid, InputLabel, MenuItem, Select, Stack, Tab, Tabs,
    TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useUserState } from '../../contexts/UserContext';
import { KnowledgeBaseRow, knowledgeCommand, knowledgeError, knowledgeQuery } from './knowledgeApi';
import {
    availableContinuations, isAbortError, KNOWLEDGE_COLLECTION_ACTIONS,
    KNOWLEDGE_COMMAND_INVALIDATION, type PaginationState,
} from './knowledgeWorkspaceModel';

type UserState = { host?: string };
type Row = Record<string, any>;
type AgentOption = { id: string; label: string };
const TABS = ['Overview', 'Sources', 'Documents', 'Sync Runs', 'Index Generations', 'Incremental', 'Agent Bindings', 'Access Policy', 'Retrieval Playground', 'Quality', 'Settings'];
type LoadState = {
    loading: boolean; stale: boolean; error?: string; lastUpdated?: number;
    pagination: PaginationState;
};

const ID_FIELDS = [
    'documentId', 'syncRunId', 'indexGenerationId', 'uploadId', 'sourceChangeId',
    'passageAnchorId', 'compactionRunId', 'antiEntropyRunId', 'sourceId',
    'reconciliationId', 'aclTransitionId', 'connectorObjectId', 'migrationId',
    'evaluationEvidenceId', 'checkpointId', 'purgeEvidenceId', 'agentId',
];

function mergeRows(current: Row[], additions: Row[]) {
    const values = new Map<string, Row>();
    [...current, ...additions].forEach((row, index) => {
        const identity = ID_FIELDS.map(field => row[field]).filter(Boolean).join('|')
            || JSON.stringify(row) || String(index);
        values.set(identity, row);
    });
    return [...values.values()];
}

function paginationOf(...responses: Row[]): PaginationState {
    return Object.assign({}, ...responses.map(response => response?.pagination || {}));
}

function LoadStatus({ state, onRefresh, onMore }: {
    state?: LoadState; onRefresh: () => void; onMore: () => void;
}) {
    if (!state) return null;
    const more = availableContinuations(state.pagination);
    return <Stack spacing={1} sx={{ mb: 2 }}>
        {state.error && <Alert severity="error" action={<Button onClick={onRefresh}>Retry</Button>}>{state.error}</Alert>}
        {state.stale && !state.error && <Alert severity="warning" action={<Button onClick={onRefresh}>Refresh</Button>}>This tab is stale because related operational state changed.</Alert>}
        {more.length > 0 && <Alert severity="info" action={<Button disabled={state.loading} onClick={onMore}>Load more</Button>}>
            More rows are available for {more.map(([collection]) => collection).join(', ')}.
        </Alert>}
        {state.lastUpdated && <Typography variant="caption" color="text.secondary">
            {state.loading ? 'Refreshing… · ' : ''}Last updated {new Date(state.lastUpdated).toLocaleTimeString()}
        </Typography>}
    </Stack>;
}

function JsonRows({ rows, empty }: { rows: Row[]; empty: string }) {
    if (!rows.length) return <Alert severity="info">{empty}</Alert>;
    return <Stack spacing={1}>{rows.map((row, index) => <Card variant="outlined" key={String(row.sourceId ?? row.jobId ?? row.documentId ?? row.indexGenerationId ?? row.agentId ?? index)}>
        <CardContent><Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(row, null, 2)}</Box></CardContent>
    </Card>)}</Stack>;
}

function SyncRuns({ rows }: { rows: Row[] }) {
    if (!rows.length) return <Alert severity="info">No sync run has been recorded.</Alert>;
    return <Stack spacing={1}>{rows.map((run, index) => {
        const state = String(run.state || 'ACCEPTED');
        const progress = run.progress || {};
        const severity = state === 'SUCCEEDED' ? 'success'
            : state === 'FAILED' || state === 'PAUSED_BUDGET' ? 'error'
                : 'info';
        return <Card variant="outlined" key={String(run.syncRunId ?? run.jobId ?? index)}><CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}>
                <Box><Typography variant="h6">{run.sourceId ? `Source ${run.sourceId}` : 'Knowledge Base sync'}</Typography>
                    <Typography color="text.secondary">{run.phase || 'ACCEPTED'} · attempt {run.attemptCount ?? 0}</Typography></Box>
                <Chip color={severity} label={state} />
            </Stack>
            <Typography sx={{ mt: 1 }}>Documents: {run.documentsSeen ?? progress.documents ?? 0} · Chunks: {run.chunksWritten ?? progress.chunks ?? 0} · Stored bytes: {run.storedBytes ?? 0}</Typography>
            {run.nextAttemptTs && <Alert severity="warning" sx={{ mt: 1 }}>Retry scheduled for {run.nextAttemptTs}.</Alert>}
            {run.errorSummary && <Alert severity="error" sx={{ mt: 1 }}>{run.errorSummary.code || 'SYNC_FAILED'}{run.errorSummary.message ? `: ${run.errorSummary.message}` : ''}</Alert>}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>Job {run.jobId || 'pending'} · Generation {run.indexGenerationId || 'pending'}</Typography>
        </CardContent></Card>;
    })}</Stack>;
}

async function sha256Json(value: unknown): Promise<string> {
    const bytes = new TextEncoder().encode(JSON.stringify(value ?? {}));
    const digest = await crypto.subtle.digest('SHA-256', bytes);
    return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}

export default function KnowledgeBaseWorkspace() {
    const navigate = useNavigate();
    const { knowledgeBaseId = '' } = useParams();
    const [searchParams] = useSearchParams();
    const environment = searchParams.get('environment') || 'dev';
    const { host } = useUserState() as UserState;
    const [tab, setTab] = useState(0);
    const [base, setBase] = useState<KnowledgeBaseRow | null>(null);
    const [sources, setSources] = useState<Row[]>([]);
    const [documents, setDocuments] = useState<Row[]>([]);
    const [runs, setRuns] = useState<Row[]>([]);
    const [generations, setGenerations] = useState<Row[]>([]);
    const [bindings, setBindings] = useState<Row[]>([]);
    const [incremental, setIncremental] = useState<Row[]>([]);
    const [accessDiagnostics, setAccessDiagnostics] = useState<Row[]>([]);
    const [productionOperations, setProductionOperations] = useState<Row[]>([]);
    const [targetEmbeddingProfileId, setTargetEmbeddingProfileId] = useState('');
    const [targetEmbeddingProfileRevision, setTargetEmbeddingProfileRevision] = useState('1');
    const [migrationCostCeilingMicros, setMigrationCostCeilingMicros] = useState('1000000');
    const [migrationEstimate, setMigrationEstimate] = useState<Row | null>(null);
    const [simulationSubjectType, setSimulationSubjectType] = useState('USER');
    const [simulationSubjectId, setSimulationSubjectId] = useState('');
    const [message, setMessage] = useState('');
    const [messageSeverity, setMessageSeverity] = useState<'success' | 'error'>('error');
    const [busy, setBusy] = useState(false);
    const [query, setQuery] = useState('How is a Light service configured?');
    const [sourceOpen, setSourceOpen] = useState(false);
    const [sourceName, setSourceName] = useState('Documentation');
    const [repositoryUri, setRepositoryUri] = useState('');
    const [commit, setCommit] = useState('');
    const [ingestionPolicyId, setIngestionPolicyId] = useState('');
    const [ingestionPolicies, setIngestionPolicies] = useState<Row[]>([]);
    const [embeddingProfiles, setEmbeddingProfiles] = useState<Row[]>([]);
    const [retrievalProfiles, setRetrievalProfiles] = useState<Row[]>([]);
    const [agents, setAgents] = useState<AgentOption[]>([]);
    const [desiredEmbeddingProfile, setDesiredEmbeddingProfile] = useState('');
    const [bindingOpen, setBindingOpen] = useState(false);
    const [agentId, setAgentId] = useState('');
    const [retrievalProfileId, setRetrievalProfileId] = useState('');
    const [evidenceRequired, setEvidenceRequired] = useState(false);
    const [loadStates, setLoadStates] = useState<Record<number, LoadState>>({});
    const [pollRequested, setPollRequested] = useState(false);
    const requestControllers = useRef(new Map<number, AbortController>());
    const loadedTabs = useRef(new Set<number>());
    const staleTabs = useRef(new Set<number>());
    const pendingTerminalTabs = useRef(new Set<number>());
    const observedActive = useRef(false);
    const tabRef = useRef(tab);

    useEffect(() => { tabRef.current = tab; }, [tab]);

    const updateLoadState = useCallback((selected: number, update: Partial<LoadState>) => {
        setLoadStates(current => ({
            ...current,
            [selected]: {
                loading: false, stale: false, pagination: {},
                ...current[selected], ...update,
            },
        }));
    }, []);

    const beginRequest = useCallback((selected: number) => {
        requestControllers.current.get(selected)?.abort();
        const controller = new AbortController();
        requestControllers.current.set(selected, controller);
        updateLoadState(selected, { loading: true, error: undefined });
        return controller;
    }, [updateLoadState]);

    const context = useMemo(() => ({ hostId: host, environment, knowledgeBaseId }), [environment, host, knowledgeBaseId]);
    const loadOverview = useCallback(async (showBusy = false) => {
        if (!host || !knowledgeBaseId) return undefined;
        if (showBusy) setBusy(true);
        const controller = beginRequest(0);
        try {
            const fresh = await knowledgeQuery<KnowledgeBaseRow>(
                'getFreshKnowledgeBase', context, { signal: controller.signal });
            if (controller.signal.aborted) return undefined;
            setBase(fresh);
            setDesiredEmbeddingProfile(fresh.desiredEmbeddingProfileId
                ? `${fresh.desiredEmbeddingProfileId}:${fresh.desiredEmbeddingProfileRevision || 1}`
                : '');
            loadedTabs.current.add(0);
            staleTabs.current.delete(0);
            updateLoadState(0, {
                loading: false, stale: false, error: undefined,
                lastUpdated: Date.now(), pagination: {},
            });
            return fresh;
        } catch (error) {
            if (!isAbortError(error)) updateLoadState(0, {
                loading: false, stale: true, error: knowledgeError(error),
            });
            return undefined;
        } finally {
            if (requestControllers.current.get(0) === controller) {
                requestControllers.current.delete(0);
                if (showBusy) setBusy(false);
            }
        }
    }, [beginRequest, context, host, knowledgeBaseId, updateLoadState]);

    const loadTab = useCallback(async (selected: number, showBusy = false,
        force = false) => {
        if (!host || !knowledgeBaseId || selected === 0 || selected === 8) return;
        if (!force && loadedTabs.current.has(selected) && !staleTabs.current.has(selected)) return;
        if (showBusy) setBusy(true);
        const controller = beginRequest(selected);
        const options = { signal: controller.signal };
        let pagination: PaginationState = {};
        try {
            if (selected === 1) {
                const [sourceRows, policyResponse] = await Promise.all([
                    knowledgeQuery<{ knowledgeSources?: Row[] }>('getKnowledgeSources', context, options),
                    knowledgeQuery<{ knowledgeIngestionPolicies?: Row[] }>('getKnowledgeIngestionPolicies', { hostId: host, environment }, options),
                ]);
                setSources(sourceRows.knowledgeSources || []);
                const activePolicies = (policyResponse.knowledgeIngestionPolicies || []).filter(policy => policy.active !== false);
                setIngestionPolicies(activePolicies);
                setIngestionPolicyId(current => activePolicies.some(policy => policy.ingestionPolicyId === current) ? current : activePolicies[0]?.ingestionPolicyId || '');
            } else if (selected === 2) {
                const rows = await knowledgeQuery<Row>('getKnowledgeDocuments', { ...context, pageSize: 200 }, options);
                setDocuments(rows.knowledgeDocuments || []);
                pagination = paginationOf(rows);
            } else if (selected === 3) {
                const rows = await knowledgeQuery<Row>('getKnowledgeSyncRuns', { ...context, pageSize: 200 }, options);
                setRuns(rows.knowledgeSyncRuns || []);
                pagination = paginationOf(rows);
            } else if (selected === 4 || selected === 9) {
                const [generationRows, operations, profiles] = await Promise.all([
                    knowledgeQuery<Row>('getKnowledgeIndexGenerations', { ...context, pageSize: 200 }, options),
                    knowledgeQuery<Row>('getKnowledgeProductionOperations', { ...context, pageSize: 200 }, options),
                    knowledgeQuery<{ knowledgeEmbeddingProfiles?: Row[] }>('getKnowledgeEmbeddingProfiles', { hostId: host, environment }, options),
                ]);
                setGenerations(generationRows.knowledgeIndexGenerations || []);
                setEmbeddingProfiles((profiles.knowledgeEmbeddingProfiles || []).filter(profile => profile.active !== false));
                setProductionOperations([
                    ...(operations.knowledgeBaseEmbeddingMigrations || []).map((row: Row) => ({ diagnosticType: 'EMBEDDING_MIGRATION', ...row })),
                    ...(operations.knowledgeMigrationEvaluations || []).map((row: Row) => ({ diagnosticType: 'MIGRATION_EVALUATION', ...row })),
                    ...(operations.knowledgeGenerationRetention || []).map((row: Row) => ({ diagnosticType: 'GENERATION_RETENTION', ...row })),
                    ...(operations.knowledgeBackupCheckpoints || []).map((row: Row) => ({ diagnosticType: 'BACKUP_CHECKPOINT', ...row })),
                    ...(operations.knowledgePurgeEvidence || []).map((row: Row) => ({ diagnosticType: 'PURGE_EVIDENCE', ...row })),
                ]);
                pagination = paginationOf(generationRows, operations);
            } else if (selected === 5) {
                const rows = await knowledgeQuery<Row>('getKnowledgeIncrementalOperations', { ...context, pageSize: 200 }, options);
                setIncremental([
                    ...(rows.knowledgeUploads || []).map((row: Row) => ({ diagnosticType: 'UPLOAD', ...row })),
                    ...(rows.knowledgeIncrementalChanges || []).map((row: Row) => ({ diagnosticType: 'CHANGE', ...row })),
                    ...(rows.knowledgePassageAnchors || []).map((row: Row) => ({ diagnosticType: 'PASSAGE_ANCHOR', ...row })),
                    ...(rows.knowledgeCompactionRuns || []).map((row: Row) => ({ diagnosticType: 'COMPACTION', ...row })),
                    ...(rows.knowledgeAntiEntropyRuns || []).map((row: Row) => ({ diagnosticType: 'ANTI_ENTROPY', ...row })),
                ]);
                pagination = paginationOf(rows);
            } else if (selected === 6) {
                const [bindingRows, retrievalResponse, agentOptions] = await Promise.all([
                    knowledgeQuery<{ agentKnowledgeBaseBindings?: Row[] }>('getAgentKnowledgeBaseBindings', { hostId: host, environment }, options),
                    knowledgeQuery<{ knowledgeRetrievalProfiles?: Row[] }>('getKnowledgeRetrievalProfiles', { hostId: host, environment }, options),
                    knowledgeQuery<AgentOption[]>('getAgentDefinitionLabel', { hostId: host }, options),
                ]);
                const activeProfiles = (retrievalResponse.knowledgeRetrievalProfiles || []).filter(profile => profile.active !== false);
                setBindings((bindingRows.agentKnowledgeBaseBindings || []).filter(row => row.knowledgeBaseId === knowledgeBaseId));
                setRetrievalProfiles(activeProfiles);
                setAgents(agentOptions || []);
                setAgentId(current => (agentOptions || []).some(agent => agent.id === current) ? current : '');
                setRetrievalProfileId(current => activeProfiles.some(profile => profile.profileId === current) ? current : activeProfiles[0]?.profileId || '');
            } else if (selected === 7) {
                const [sourceRows, rows] = await Promise.all([
                    knowledgeQuery<{ knowledgeSources?: Row[] }>('getKnowledgeSources', context, options),
                    knowledgeQuery<Row>('getKnowledgeAclStatus', { ...context, pageSize: 200 }, options),
                ]);
                setSources(sourceRows.knowledgeSources || []);
                setAccessDiagnostics([
                    ...(rows.knowledgeAclFreshness || []).map((row: Row) => ({ diagnosticType: 'ACL_FRESHNESS', ...row })),
                    ...(rows.knowledgeAclReconciliations || []).map((row: Row) => ({ diagnosticType: 'ACL_RECONCILIATION', ...row })),
                    ...(rows.knowledgeAclTransitions || []).map((row: Row) => ({ diagnosticType: 'ACL_TRANSITION', ...row })),
                    ...(rows.knowledgeConnectorObjects || []).map((row: Row) => ({ diagnosticType: 'CONNECTOR_OBJECT', ...row })),
                ]);
                pagination = paginationOf(rows);
            } else if (selected === 10) {
                const profiles = await knowledgeQuery<{ knowledgeEmbeddingProfiles?: Row[] }>('getKnowledgeEmbeddingProfiles', { hostId: host, environment }, options);
                setEmbeddingProfiles((profiles.knowledgeEmbeddingProfiles || []).filter(profile => profile.active !== false));
            }
            if (controller.signal.aborted) return;
            loadedTabs.current.add(selected);
            staleTabs.current.delete(selected);
            updateLoadState(selected, {
                loading: false, stale: false, error: undefined,
                lastUpdated: Date.now(), pagination,
            });
        } catch (error) {
            if (!isAbortError(error)) updateLoadState(selected, {
                loading: false, stale: true, error: knowledgeError(error),
            });
        } finally {
            if (requestControllers.current.get(selected) === controller) {
                requestControllers.current.delete(selected);
                if (showBusy) setBusy(false);
            }
        }
    }, [beginRequest, context, environment, host, knowledgeBaseId, updateLoadState]);

    const appendCollection = useCallback((collection: string, additions: Row[]) => {
        const diagnosticType: Record<string, string> = {
            knowledgeUploads: 'UPLOAD', knowledgeIncrementalChanges: 'CHANGE',
            knowledgePassageAnchors: 'PASSAGE_ANCHOR', knowledgeCompactionRuns: 'COMPACTION',
            knowledgeAntiEntropyRuns: 'ANTI_ENTROPY', knowledgeAclFreshness: 'ACL_FRESHNESS',
            knowledgeAclReconciliations: 'ACL_RECONCILIATION', knowledgeAclTransitions: 'ACL_TRANSITION',
            knowledgeConnectorObjects: 'CONNECTOR_OBJECT', knowledgeBaseEmbeddingMigrations: 'EMBEDDING_MIGRATION',
            knowledgeMigrationEvaluations: 'MIGRATION_EVALUATION', knowledgeGenerationRetention: 'GENERATION_RETENTION',
            knowledgeBackupCheckpoints: 'BACKUP_CHECKPOINT', knowledgePurgeEvidence: 'PURGE_EVIDENCE',
        };
        const decorated = diagnosticType[collection]
            ? additions.map(row => ({ diagnosticType: diagnosticType[collection], ...row }))
            : additions;
        if (collection === 'knowledgeDocuments') setDocuments(current => mergeRows(current, decorated));
        else if (collection === 'knowledgeSyncRuns') setRuns(current => mergeRows(current, decorated));
        else if (collection === 'knowledgeIndexGenerations') setGenerations(current => mergeRows(current, decorated));
        else if (collection.startsWith('knowledgeAcl') || collection === 'knowledgeConnectorObjects') {
            setAccessDiagnostics(current => mergeRows(current, decorated));
        } else if (['knowledgeUploads', 'knowledgeIncrementalChanges', 'knowledgePassageAnchors',
            'knowledgeCompactionRuns', 'knowledgeAntiEntropyRuns'].includes(collection)) {
            setIncremental(current => mergeRows(current, decorated));
        } else {
            setProductionOperations(current => mergeRows(current, decorated));
        }
    }, []);

    const loadMore = useCallback(async (selected: number) => {
        const continuations = availableContinuations(loadStates[selected]?.pagination || {});
        if (!continuations.length) return;
        const controller = beginRequest(selected);
        try {
            const pages = await Promise.all(continuations.map(async ([collection, page]) => {
                const action = KNOWLEDGE_COLLECTION_ACTIONS[collection];
                if (!action || !page.nextCursor) throw new Error(`Unsupported continuation for ${collection}`);
                const response = await knowledgeQuery<Row>(action, {
                    ...context, cursor: page.nextCursor, pageSize: 200,
                }, { signal: controller.signal });
                return { collection, response };
            }));
            if (controller.signal.aborted) return;
            const pagination = { ...(loadStates[selected]?.pagination || {}) };
            pages.forEach(({ collection, response }) => {
                appendCollection(collection, response[collection] || []);
                pagination[collection] = response.pagination?.[collection]
                    || { hasMore: false, nextCursor: null };
            });
            loadedTabs.current.add(selected);
            staleTabs.current.delete(selected);
            updateLoadState(selected, {
                loading: false, stale: false, error: undefined,
                lastUpdated: Date.now(), pagination,
            });
        } catch (error) {
            if (!isAbortError(error)) updateLoadState(selected, {
                loading: false, stale: true, error: knowledgeError(error),
            });
        } finally {
            if (requestControllers.current.get(selected) === controller) {
                requestControllers.current.delete(selected);
            }
        }
    }, [appendCollection, beginRequest, context, loadStates, updateLoadState]);

    const invalidateTabs = useCallback((targets: number[]) => {
        targets.forEach(selected => {
            staleTabs.current.add(selected);
            updateLoadState(selected, { stale: true });
        });
    }, [updateLoadState]);

    useEffect(() => { void loadOverview(); }, [loadOverview]);
    useEffect(() => {
        const controllers = requestControllers.current;
        void loadTab(tab);
        return () => {
            if (tab === 0) return;
            const controller = controllers.get(tab);
            if (!controller) return;
            controller.abort();
            controllers.delete(tab);
            updateLoadState(tab, { loading: false, stale: true });
        };
    }, [loadTab, tab, updateLoadState]);
    useEffect(() => {
        const controllers = requestControllers.current;
        return () => {
            controllers.forEach(controller => controller.abort());
            controllers.clear();
        };
    }, []);

    const overviewActive = Boolean(base?.hasActiveSync || (base?.activeJobCount || 0) > 0);
    useEffect(() => {
        if (overviewActive) observedActive.current = true;
    }, [overviewActive]);
    const syncInProgress = overviewActive || pollRequested;
    const pollAttempts = useRef(0);
    useEffect(() => {
        if (!syncInProgress) return undefined;
        let stopped = false;
        let timer: number | undefined;
        const schedule = (delay: number) => {
            if (!stopped) timer = window.setTimeout(() => void poll(), delay);
        };
        const complete = async () => {
            const targets = pendingTerminalTabs.current.size
                ? [...pendingTerminalTabs.current] : [tabRef.current];
            pendingTerminalTabs.current.clear();
            observedActive.current = false;
            pollAttempts.current = 0;
            setPollRequested(false);
            invalidateTabs(targets.filter(selected => selected !== 0));
            const selected = tabRef.current;
            if (selected !== 0 && targets.includes(selected)) await loadTab(selected, false, true);
        };
        const poll = async () => {
            if (stopped) return;
            if (document.visibilityState === 'hidden') {
                schedule(15000);
                return;
            }
            pollAttempts.current += 1;
            const fresh = await loadOverview(false);
            if (stopped || !fresh) {
                schedule(6000);
                return;
            }
            const active = Boolean(fresh.hasActiveSync || (fresh.activeJobCount || 0) > 0);
            if (active) observedActive.current = true;
            if (!active && (observedActive.current || pollAttempts.current >= 20)) {
                await complete();
                return;
            }
            schedule(3000);
        };
        const visibility = () => {
            if (document.visibilityState !== 'hidden') {
                if (timer !== undefined) window.clearTimeout(timer);
                schedule(0);
            }
        };
        document.addEventListener('visibilitychange', visibility);
        schedule(3000);
        return () => {
            stopped = true;
            if (timer !== undefined) window.clearTimeout(timer);
            document.removeEventListener('visibilitychange', visibility);
        };
    }, [invalidateTabs, loadOverview, loadTab, syncInProgress]);

    const refresh = useCallback(async () => {
        setBusy(true);
        await Promise.all([loadOverview(false), tab === 0 ? Promise.resolve() : loadTab(tab, false, true)]);
        setBusy(false);
    }, [loadOverview, loadTab, tab]);

    const command = useCallback(async (action: string, data: Row = {}) => {
        setBusy(true);
        setMessage('');
        try {
            await knowledgeCommand(action, { scope: base?.hostId ? 'TENANT' : 'GLOBAL', environment, knowledgeBaseId, ...data });
            const invalidation = KNOWLEDGE_COMMAND_INVALIDATION[action]
                || { immediate: [0], terminal: [] };
            invalidateTabs(invalidation.immediate);
            invalidation.terminal.forEach(selected => pendingTerminalTabs.current.add(selected));
            if (invalidation.terminal.length) {
                pollAttempts.current = 0;
                setPollRequested(true);
            }
            await loadOverview(false);
            if (tab !== 0 && invalidation.immediate.includes(tab)) await loadTab(tab, false, true);
            setMessageSeverity('success');
            setMessage(action === 'requestKnowledgeSourceSync'
                ? 'Sync request accepted. This page will refresh while the worker processes it.'
                : 'Operation accepted.');
        } catch (error) {
            setMessageSeverity('error');
            setMessage(knowledgeError(error));
        } finally {
            setBusy(false);
        }
    }, [base?.hostId, environment, invalidateTabs, knowledgeBaseId, loadOverview, loadTab, tab]);

    const active = generations.find(row => row.state === 'PROMOTED' || row.indexGenerationId === base?.activeGenerationId);
    const migration = productionOperations.find(row => row.diagnosticType === 'EMBEDDING_MIGRATION' && !['CANCELLED', 'FAILED', 'RETIRED', 'ROLLED_BACK'].includes(row.state));
    const candidates = generations.filter(row => row.state === 'READY' && row.indexGenerationId !== base?.activeGenerationId);
    const promote = useCallback(async (generation: Row) => {
        const evidence = generation.evidence || {};
        await command('promoteKnowledgeBaseIndexGeneration', {
            promotionId: crypto.randomUUID(),
            indexGenerationId: generation.indexGenerationId,
            expectedPointerVersion: Number(base?.pointerVersion || 0),
            evidence,
            evidenceDigest: await sha256Json(evidence),
            reason: 'Portal-authorized Knowledge Base promotion',
        });
    }, [base?.pointerVersion, command]);
    return <Box sx={{ p: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/app/genai/KnowledgeBases?environment=${encodeURIComponent(environment)}`)}>Knowledge Bases</Button>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" sx={{ my: 2 }}>
            <Box><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h4">{base?.name || knowledgeBaseId}</Typography><Chip size="small" label={base?.hostId ? 'TENANT' : 'GLOBAL'} color={base?.hostId ? 'primary' : 'secondary'} /><Chip size="small" label={base?.status || 'Loading'} /></Stack>
                <Typography color="text.secondary">{knowledgeBaseId} · {environment}</Typography></Box>
            <Stack direction="row" spacing={1}><Button startIcon={<RefreshIcon />} disabled={busy} onClick={() => void refresh()}>Refresh</Button><Button disabled={busy} onClick={() => void command('requestKnowledgeBaseReindex')}>Rebuild full BASE</Button><Button disabled={busy} onClick={() => void command('requestKnowledgeBaseCompaction')}>Compact DELTAs</Button></Stack>
        </Stack>
        {message && <Alert severity={messageSeverity} sx={{ mb: 2 }}>{message}</Alert>}
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>{TABS.map(label => <Tab key={label} label={label} />)}</Tabs>
        {tab !== 8 && <LoadStatus
            state={loadStates[tab]}
            onRefresh={() => void (tab === 0 ? loadOverview(true) : loadTab(tab, true, true))}
            onMore={() => void loadMore(tab)}
        />}
        {tab === 0 && <Grid container spacing={2}>{[
            ['Desired state', base?.status || '—'], ['Effective projection', base?.effectiveState || base?.projectionState || 'Pending'],
            ['Active BASE', base?.activeGenerationId || 'None'], ['Pointer version', String(base?.pointerVersion ?? '—')],
            ['Active sync', base?.hasActiveSync ? 'Yes' : 'No'], ['Active jobs', String(base?.activeJobCount ?? 0)],
        ].map(([label, value]) => <Grid key={label} size={{ xs: 12, md: 4 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography sx={{ overflowWrap: 'anywhere' }}>{value}</Typography></CardContent></Card></Grid>)}</Grid>}
        {tab === 1 && <Box><Stack direction="row" spacing={1} sx={{ mb: 2 }}><Button variant="contained" onClick={() => setSourceOpen(true)}>Add Git/Markdown source</Button>{sources.map(source => <Button key={source.sourceId} disabled={busy} onClick={() => void command('requestKnowledgeSourceSync', { sourceId: source.sourceId })}>Sync {source.displayName}</Button>)}</Stack><JsonRows rows={sources} empty="No bounded Git/Markdown source has been configured." /></Box>}
        {tab === 2 && <JsonRows rows={documents} empty="No immutable document versions exist before the first completed build." />}
        {tab === 3 && <Stack spacing={2}>{!base?.desiredEmbeddingProfileId && <Alert severity="warning">Sync jobs are queued but cannot be claimed until this Knowledge Base has a qualified embedding profile. Qualify the kb-index/kb-query embedding lane, create a profile, then assign it under Settings.</Alert>}<SyncRuns rows={runs} /></Stack>}
        {tab === 4 && <Stack spacing={2}>{active && <Alert severity="success">Active immutable BASE: {active.indexGenerationId}</Alert>}<Alert severity="info">A READY generation is a candidate and remains invisible to retrieval until an authorized atomic promotion.</Alert>{candidates.map(candidate => <Card variant="outlined" key={candidate.indexGenerationId}><CardContent><Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={1}><Box><Typography variant="h6">READY candidate</Typography><Typography sx={{ overflowWrap: 'anywhere' }}>{candidate.indexGenerationId}</Typography><Typography color="text.secondary">Watermark {candidate.finalWatermark || candidate.snapshotWatermark || '—'} · manifest {candidate.orderedSegmentManifestDigest || '—'}</Typography></Box><Button variant="contained" disabled={busy} onClick={() => void promote(candidate)}>Promote for retrieval</Button></Stack><Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(candidate.evidence || {}, null, 2)}</Box></CardContent></Card>)}<Stack direction={{ xs: 'column', md: 'row' }} spacing={1}><TextField label="Target embedding profile UUID" value={targetEmbeddingProfileId} onChange={event => { setTargetEmbeddingProfileId(event.target.value); setMigrationEstimate(null); }} /><TextField label="Profile revision" type="number" value={targetEmbeddingProfileRevision} onChange={event => { setTargetEmbeddingProfileRevision(event.target.value); setMigrationEstimate(null); }} /><TextField label="Cost ceiling (micros)" type="number" value={migrationCostCeilingMicros} onChange={event => setMigrationCostCeilingMicros(event.target.value)} /><Button disabled={busy || !active || !targetEmbeddingProfileId} onClick={() => { setBusy(true); void knowledgeQuery<{ knowledgeBaseEmbeddingMigrationEstimate?: Row[] }>('estimateKnowledgeBaseEmbeddingMigration', { ...context, targetEmbeddingProfileId, targetEmbeddingProfileRevision }).then(result => setMigrationEstimate(result.knowledgeBaseEmbeddingMigrationEstimate?.[0] || null)).catch(error => setMessage(knowledgeError(error))).finally(() => setBusy(false)); }}>Estimate</Button><Button disabled={busy || !active || !migrationEstimate || (migrationEstimate.blockingConditions || []).length > 0} onClick={() => void command('requestKnowledgeBaseEmbeddingMigration', { targetEmbeddingProfileId, targetEmbeddingProfileRevision: Number(targetEmbeddingProfileRevision), estimateVersion: 1, expectedActiveGenerationId: active?.indexGenerationId, acceptedCostCeilingMicros: Number(migrationCostCeilingMicros), rollbackWindowSeconds: 86400 })}>Approve budget and start</Button></Stack>{migrationEstimate && <JsonRows rows={[{ diagnosticType: 'MIGRATION_ESTIMATE', ...migrationEstimate }]} empty="No estimate." />}{migration && <Stack direction="row" spacing={1}><Button disabled={busy || !['PREFLIGHTED', 'BACKFILLING', 'CATCHING_UP', 'VALIDATING'].includes(migration.state)} onClick={() => void command('pauseKnowledgeBaseEmbeddingMigration', { migrationId: migration.migrationId, expectedMigrationVersion: migration.version })}>Pause</Button><Button disabled={busy || migration.state !== 'PAUSED'} onClick={() => void command('resumeKnowledgeBaseEmbeddingMigration', { migrationId: migration.migrationId, expectedMigrationVersion: migration.version })}>Resume</Button><Button color="warning" disabled={busy || ['SOAKING', 'PROMOTED'].includes(migration.state)} onClick={() => void command('cancelKnowledgeBaseEmbeddingMigration', { migrationId: migration.migrationId, expectedMigrationVersion: migration.version })}>Cancel</Button><Button variant="contained" disabled={busy || migration.state !== 'READY'} onClick={() => void command('promoteKnowledgeBaseIndexGeneration', { migrationId: migration.migrationId, expectedPointerVersion: base?.pointerVersion, expectedActiveGenerationId: active?.indexGenerationId, authorizedBy: 'portal-operator' })}>Promote candidate</Button><Button color="warning" disabled={busy || migration.state !== 'SOAKING'} onClick={() => void command('rollbackKnowledgeBaseIndexGeneration', { migrationId: migration.migrationId, expectedPointerVersion: base?.pointerVersion, reason: 'operator rollback' })}>Rollback</Button></Stack>}<JsonRows rows={[...generations, ...productionOperations]} empty="No candidate generation or production operation exists." /></Stack>}
        {tab === 5 && <Stack spacing={2}><Alert severity="info">Phase 1b diagnostics show upload scanning, classified changes, stable anchors, compaction, and anti-entropy without exposing source text.</Alert><JsonRows rows={incremental} empty="No Phase 1b incremental diagnostics have been recorded." /></Stack>}
        {tab === 6 && <Box><Button variant="contained" sx={{ mb: 2 }} onClick={() => setBindingOpen(true)}>Bind Agent</Button><JsonRows rows={bindings} empty="No Agent in this tenant is bound to this Knowledge Base." /></Box>}
        {tab === 7 && <Stack spacing={2}><Alert severity={base?.projectionState === 'ACTIVE' ? 'success' : 'warning'}>Desired state: {base?.status || '—'}; effective state: {base?.projectionState || 'pending'}. Mirrored source access fails closed when reconciliation is incomplete, stale, ambiguous, or contains an unresolved principal.</Alert><Stack direction={{ xs: 'column', md: 'row' }} spacing={1}><TextField label="Normalized subject type" value={simulationSubjectType} onChange={event => setSimulationSubjectType(event.target.value.toUpperCase())} helperText="USER, GROUP, or ORGANIZATION" /><TextField fullWidth label="Normalized subject ID" value={simulationSubjectId} onChange={event => setSimulationSubjectId(event.target.value)} /><Button disabled={busy || !simulationSubjectId} onClick={() => { setBusy(true); void knowledgeQuery<{ knowledgeAuthorizationSimulation?: Row[] }>('simulateKnowledgeAuthorization', { ...context, subjectType: simulationSubjectType, subjectId: simulationSubjectId }).then(result => setAccessDiagnostics(current => [...(result.knowledgeAuthorizationSimulation || []).map(row => ({ diagnosticType: 'AUTHORIZATION_SIMULATION', ...row })), ...current])).catch(error => setMessage(knowledgeError(error))).finally(() => setBusy(false)); }}>Simulate access</Button></Stack><JsonRows rows={[...sources.map(source => ({ diagnosticType: 'SOURCE_POLICY', sourceId: source.sourceId, aclMode: source.aclMode, sourceTrustTier: source.sourceTrustTier, approvalPolicy: source.approvalPolicy })), ...accessDiagnostics]} empty="Source trust and permission coverage evidence appears after source configuration." /></Stack>}
        {tab === 8 && <Stack spacing={2}><Alert severity="info">The Portal retrieval-test workflow is not released. Use the authorized light-knowledge retrieval API and its audit records for qualification.</Alert><TextField label="Question" multiline minRows={3} value={query} onChange={event => setQuery(event.target.value)} disabled /></Stack>}
        {tab === 9 && <Stack spacing={2}><Alert severity="info">Phase 3 quality includes migration watermark, reusable-chunk, budget, candidate-isolation, evaluation, rollback-retention, backup, anti-entropy, and purge evidence. Live provider latency and Recall@10 qualification remain separate promotion gates.</Alert><JsonRows rows={[...generations.map(row => ({ indexGenerationId: row.indexGenerationId, state: row.state, evidence: row.evidence })), ...productionOperations]} empty="Quality and operational evidence appears after a candidate or maintenance run." /></Stack>}
        {tab === 10 && <Stack spacing={2}><Card variant="outlined"><CardContent><Typography variant="h6">Lifecycle and retention</Typography><Divider sx={{ my: 1 }} /><Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(base, null, 2)}</Box></CardContent></Card><Card variant="outlined"><CardContent><Stack spacing={2}><Typography variant="h6">Desired embedding profile</Typography><FormControl><InputLabel>Qualified embedding profile</InputLabel><Select label="Qualified embedding profile" value={desiredEmbeddingProfile} onChange={event => setDesiredEmbeddingProfile(event.target.value)}>{embeddingProfiles.map(profile => <MenuItem key={`${profile.profileId}:${profile.profileRevision}`} value={`${profile.profileId}:${profile.profileRevision}`}>{profile.aliasName} · {profile.expectedSpaceId} r{profile.expectedSpaceRevision}</MenuItem>)}</Select></FormControl><Button variant="contained" disabled={busy || !base || !desiredEmbeddingProfile} onClick={() => { const [profileId, revision] = desiredEmbeddingProfile.split(':'); void command('updateKnowledgeBase', { aggregateVersion: base?.version, name: base?.name, description: base?.description || '', status: base?.status, retentionPolicy: base?.retentionPolicy || {}, desiredEmbeddingProfileId: profileId, desiredEmbeddingProfileRevision: Number(revision) }); }}>Assign profile</Button></Stack></CardContent></Card><Alert severity="warning">Physical Knowledge purge is not released. Deactivation is available; retention-safe purge remains fail-closed at the command boundary.</Alert><Stack direction="row" spacing={1}><Button color="warning" disabled={busy || base?.status === 'INACTIVE'} onClick={() => void command('deactivateKnowledgeBase', { aggregateVersion: base?.version })}>Deactivate</Button></Stack></Stack>}
        <Dialog open={sourceOpen} onClose={() => setSourceOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Add bounded Git/Markdown source</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
            <TextField required label="Display name" value={sourceName} onChange={event => setSourceName(event.target.value)} />
            <TextField required label="Approved repository URI" value={repositoryUri} onChange={event => setRepositoryUri(event.target.value)} />
            <TextField required label="Immutable commit" value={commit} onChange={event => setCommit(event.target.value)} helperText="Enter the full 40- or 64-character commit SHA. A branch can move after approval, so branch-only sources are rejected." />
            <FormControl required><InputLabel>Ingestion policy</InputLabel><Select label="Ingestion policy" value={ingestionPolicyId} onChange={event => setIngestionPolicyId(event.target.value)}>
                {ingestionPolicies.map(policy => <MenuItem key={policy.ingestionPolicyId} value={policy.ingestionPolicyId}>{policy.policyName} ({policy.hostId ? 'tenant' : 'global'})</MenuItem>)}
            </Select></FormControl>
            {!ingestionPolicies.length && <Alert severity="warning">No active ingestion policy is available. Create one from the Knowledge Bases page before adding a source.</Alert>}
            <Alert severity="info">Use an HTTPS Git repository URI. A repository may contain source code and documentation; the Phase 1a connector enforces the configured Markdown include/exclude policy and builds one complete BASE across all active sources.</Alert>
        </Stack></DialogContent><DialogActions><Button onClick={() => setSourceOpen(false)}>Cancel</Button><Button variant="contained" disabled={!sourceName || !repositoryUri || !commit || !ingestionPolicyId} onClick={() => { setSourceOpen(false); void command('createKnowledgeSource', { displayName: sourceName, sourceType: 'GIT_MARKDOWN', configJson: { repositoryUri, commit, include: ['**/*.md'], exclude: [] }, ingestionPolicyId, aclMode: 'UNIFORM_SCOPE', sourceTrustTier: 'UNREVIEWED', approvalPolicy: {}, schedule: {}, aclReconciliationPolicy: {} }); }}>Create source</Button></DialogActions></Dialog>
        <Dialog open={bindingOpen} onClose={() => setBindingOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Bind Agent to Knowledge Base</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
            <FormControl required><InputLabel id="knowledge-agent-label">Agent</InputLabel><Select labelId="knowledge-agent-label" label="Agent" value={agentId} onChange={event => setAgentId(event.target.value)}>
                {agents.map(agent => <MenuItem key={agent.id} value={agent.id}>{agent.label} ({agent.id})</MenuItem>)}
            </Select></FormControl>
            {!agents.length && <Alert severity="warning">No active Agent is available for this tenant. Create and activate an Agent before binding it to this Knowledge Base.</Alert>}
            <FormControl required><InputLabel>Retrieval profile</InputLabel><Select label="Retrieval profile" value={retrievalProfileId} onChange={event => setRetrievalProfileId(event.target.value)}>
                {retrievalProfiles.map(profile => <MenuItem key={profile.profileId} value={profile.profileId}>{profile.profileName} ({profile.hostId ? 'tenant' : 'global'}) · {profile.strategy}</MenuItem>)}
            </Select></FormControl>
            {!retrievalProfiles.length && <Alert severity="warning">No active retrieval profile is available. Create one from the Knowledge Bases page before binding an Agent.</Alert>}
            <TextField type="number" label="Priority" defaultValue={50} inputProps={{ min: 1, max: 100 }} disabled />
            <FormControlLabel control={<Checkbox checked={evidenceRequired} onChange={event => setEvidenceRequired(event.target.checked)} />} label="Fail the turn when Knowledge evidence is unavailable" />
            <Alert severity="warning">Phase 1b permits up to four active Knowledge Bases per Agent. The runtime re-authorizes every binding and fuses local ranks without comparing raw cross-space scores.</Alert>
        </Stack></DialogContent><DialogActions><Button onClick={() => setBindingOpen(false)}>Cancel</Button><Button variant="contained" disabled={!agentId || !retrievalProfileId} onClick={() => { setBindingOpen(false); void command('bindAgentKnowledgeBase', { agentId, retrievalProfileId, priority: 50, evidenceRequired, allowedSourceTrustTiers: [] }); }}>Bind Agent</Button></DialogActions></Dialog>
    </Box>;
}
