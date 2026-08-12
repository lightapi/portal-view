import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, Divider, FormControl, InputLabel, MenuItem, Select, Stack,
    TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { MaterialReactTable, type MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { useUserState } from '../../contexts/UserContext';
import { KnowledgeBaseRow, knowledgeCommand, knowledgeError, knowledgeQuery } from './knowledgeApi';
import {
    normalizeQualifiedEmbeddingAliases, qualifiedAliasKey,
    type QualifiedEmbeddingAliasRow,
} from './knowledgeEmbeddingAliases';
import HelpLink from '../../components/HelpLink';

type UserState = { host?: string; roles?: string | null };
type PolicyRow = {
    ingestionPolicyId: string; hostId?: string | null; policyName: string;
    maxDocuments: number; maxChunks: number; maxSourceBytes: number;
    maxStoredBytes: number; maxEmbeddingTokens: number; maxSpendMicros: number;
    maxWallTimeSeconds: number; maxConcurrency: number; version: number;
    active: boolean;
};
type EmbeddingProfileRow = {
    profileId: string; profileRevision: number; aliasOwnerHostId: string;
    publicAliasId: string; aliasName: string; expectedSpaceId: string;
    expectedSpaceRevision: number; dimension: number; normalization: string;
    distanceMetric: string; documentInputTransformVersion: string;
    queryInputTransformVersion: string; qualificationDigest: string; active: boolean;
};
export type RetrievalProfileRow = {
    profileId: string; hostId?: string | null; profileName: string;
    strategy: 'LEXICAL' | 'VECTOR' | 'HYBRID' | 'GRAPH_ASSISTED';
    lexicalCandidates: number; vectorCandidates: number; topK: number;
    tokenBudget: number; fusionMethod: 'RRF';
    operationalFailurePolicy: 'FAIL_REQUEST' | 'RETURN_PARTIAL';
    graphPolicy?: Record<string, unknown>; maximumKnowledgeBases: number;
    lexicalEvidenceRequired: boolean; segmentCandidateMultiplier: number;
    contextExpansionBefore: number; contextExpansionAfter: number;
    version: number; active: boolean;
};
const HELP_PATH = '/help/portal-view/pages/knowledge-bases';

export default function KnowledgeBases() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host, roles } = useUserState() as UserState;
    const initialEnvironment = new URLSearchParams(location.search).get('environment') || 'dev';
    const [environment, setEnvironment] = useState(initialEnvironment);
    const [rows, setRows] = useState<KnowledgeBaseRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [embeddingProfileId, setEmbeddingProfileId] = useState('');
    const [embeddingProfiles, setEmbeddingProfiles] = useState<EmbeddingProfileRow[]>([]);
    const [profileOpen, setProfileOpen] = useState(false);
    const [qualifiedAliases, setQualifiedAliases] = useState<QualifiedEmbeddingAliasRow[]>([]);
    const [selectedAliasKey, setSelectedAliasKey] = useState('');
    const [policies, setPolicies] = useState<PolicyRow[]>([]);
    const [retrievalProfiles, setRetrievalProfiles] = useState<RetrievalProfileRow[]>([]);
    const [retrievalOpen, setRetrievalOpen] = useState(false);
    const [editingRetrieval, setEditingRetrieval] = useState<RetrievalProfileRow | null>(null);
    const [retrievalScope, setRetrievalScope] = useState<'GLOBAL' | 'TENANT'>('TENANT');
    const [retrievalName, setRetrievalName] = useState('Balanced hybrid');
    const [retrievalValues, setRetrievalValues] = useState({
        strategy: 'HYBRID', lexicalCandidates: '20', vectorCandidates: '20',
        topK: '10', tokenBudget: '2000', operationalFailurePolicy: 'FAIL_REQUEST',
        maximumKnowledgeBases: '1', lexicalEvidenceRequired: true,
        segmentCandidateMultiplier: '4', contextExpansionBefore: '0', contextExpansionAfter: '0',
    });
    const [policyOpen, setPolicyOpen] = useState(false);
    const [editingPolicy, setEditingPolicy] = useState<PolicyRow | null>(null);
    const [policyScope, setPolicyScope] = useState<'GLOBAL' | 'TENANT'>('TENANT');
    const [policyName, setPolicyName] = useState('');
    const [policyValues, setPolicyValues] = useState({
        maxDocuments: '10000', maxChunks: '100000', maxSourceBytes: '1073741824',
        maxStoredBytes: '2147483648', maxEmbeddingTokens: '50000000',
        maxSpendMicros: '0', maxWallTimeSeconds: '3600', maxConcurrency: '4',
    });
    const platformAdmin = Boolean(roles?.replace(/[[\]"]/g, '').split(/[\s,]+/).some(role =>
        role === 'admin' || role === 'platformKnowledgeBaseAdmin'));

    const load = useCallback(async () => {
        if (!host) return;
        setLoading(true);
        setMessage('');
        try {
            const [response, policyResponse, retrievalResponse, profileResponse, aliasResponse] = await Promise.all([
                knowledgeQuery<{ knowledgeBases?: KnowledgeBaseRow[] }>(
                    'getKnowledgeBases', { hostId: host, environment }),
                knowledgeQuery<{ knowledgeIngestionPolicies?: PolicyRow[] }>(
                    'getKnowledgeIngestionPolicies', { hostId: host, environment }),
                knowledgeQuery<{ knowledgeRetrievalProfiles?: RetrievalProfileRow[] }>(
                    'getKnowledgeRetrievalProfiles', { hostId: host, environment }),
                knowledgeQuery<{ knowledgeEmbeddingProfiles?: EmbeddingProfileRow[] }>(
                    'getKnowledgeEmbeddingProfiles', { hostId: host, environment }),
                knowledgeQuery<unknown>(
                    'getQualifiedKnowledgeEmbeddingAlias', { hostId: host, active: true, limit: 200 }),
            ]);
            setRows(Array.isArray(response.knowledgeBases) ? response.knowledgeBases : []);
            setPolicies(Array.isArray(policyResponse.knowledgeIngestionPolicies)
                ? policyResponse.knowledgeIngestionPolicies : []);
            setRetrievalProfiles(Array.isArray(retrievalResponse.knowledgeRetrievalProfiles)
                ? retrievalResponse.knowledgeRetrievalProfiles : []);
            setEmbeddingProfiles(Array.isArray(profileResponse.knowledgeEmbeddingProfiles)
                ? profileResponse.knowledgeEmbeddingProfiles : []);
            const aliases = normalizeQualifiedEmbeddingAliases(aliasResponse);
            setQualifiedAliases(aliases);
            setSelectedAliasKey(current => {
                if (aliases.some(alias => qualifiedAliasKey(alias) === current)) return current;
                const preferred = aliases.find(alias => alias.aliasName === 'kb-index') ?? aliases[0];
                return preferred ? qualifiedAliasKey(preferred) : '';
            });
        } catch (error) {
            setMessage(knowledgeError(error));
        } finally {
            setLoading(false);
        }
    }, [environment, host]);

    useEffect(() => { void load(); }, [load]);

    const selectedAlias = useMemo(() => qualifiedAliases.find(
        alias => qualifiedAliasKey(alias) === selectedAliasKey), [qualifiedAliases, selectedAliasKey]);

    const create = useCallback(async () => {
        if (!host || !name.trim()) return;
        setMessage('');
        try {
            await knowledgeCommand('createKnowledgeBase', {
                scope: 'TENANT', environment, name: name.trim(), description: description.trim(),
                status: 'DRAFT', retentionPolicy: {},
                ...(embeddingProfileId ? {
                    desiredEmbeddingProfileId: embeddingProfileId,
                    desiredEmbeddingProfileRevision: embeddingProfiles.find(
                        profile => profile.profileId === embeddingProfileId)?.profileRevision || 1,
                } : {}),
            });
            setCreateOpen(false);
            setName('');
            setDescription('');
            await load();
        } catch (error) {
            setMessage(knowledgeError(error));
        }
    }, [description, embeddingProfileId, embeddingProfiles, environment, host, load, name]);

    const createEmbeddingProfile = useCallback(async () => {
        if (!selectedAlias) return;
        const space = selectedAlias.embeddingSpace;
        setMessage('');
        try {
            await knowledgeCommand('createKnowledgeEmbeddingProfile', {
                scope: 'GLOBAL', environment,
                aliasOwnerHostId: selectedAlias.aliasOwnerHostId,
                publicAliasId: selectedAlias.publicAliasId,
                expectedSpaceId: space.spaceId,
                expectedSpaceRevision: space.revision,
                dimension: space.dimension,
                normalization: space.normalization,
                distanceMetric: space.distanceMetric,
                documentInputTransformVersion: space.documentInputTransformVersion,
                queryInputTransformVersion: 'query-v1',
            });
            setProfileOpen(false);
            await load();
        } catch (error) {
            setMessage(knowledgeError(error));
        }
    }, [environment, load, selectedAlias]);

    const deactivateEmbeddingProfile = useCallback(async (profile: EmbeddingProfileRow) => {
        setMessage('');
        try {
            await knowledgeCommand('deactivateKnowledgeEmbeddingProfile', {
                scope: 'GLOBAL', environment,
                profileId: profile.profileId,
                profileRevision: profile.profileRevision,
            });
            await load();
        } catch (error) {
            setMessage(knowledgeError(error));
        }
    }, [environment, load]);

    const createPolicy = useCallback(async () => {
        if (!policyName.trim()) return;
        setMessage('');
        try {
            await knowledgeCommand(editingPolicy
                ? 'updateKnowledgeIngestionPolicy' : 'createKnowledgeIngestionPolicy', {
                scope: policyScope, environment, policyName: policyName.trim(),
                ...(editingPolicy ? {
                    ingestionPolicyId: editingPolicy.ingestionPolicyId,
                    aggregateVersion: editingPolicy.version,
                } : {}),
                ...Object.fromEntries(Object.entries(policyValues).map(([key, value]) => [key, Number(value)])),
            });
            setPolicyOpen(false);
            await load();
        } catch (error) {
            setMessage(knowledgeError(error));
        }
    }, [editingPolicy, environment, load, policyName, policyScope, policyValues]);

    const openCreatePolicy = useCallback(() => {
        setEditingPolicy(null);
        setPolicyScope('TENANT');
        setPolicyName('');
        setPolicyValues({
            maxDocuments: '10000', maxChunks: '100000', maxSourceBytes: '1073741824',
            maxStoredBytes: '2147483648', maxEmbeddingTokens: '50000000',
            maxSpendMicros: '0', maxWallTimeSeconds: '3600', maxConcurrency: '4',
        });
        setPolicyOpen(true);
    }, []);

    const openEditPolicy = useCallback((policy: PolicyRow) => {
        setEditingPolicy(policy);
        setPolicyScope(policy.hostId ? 'TENANT' : 'GLOBAL');
        setPolicyName(policy.policyName);
        setPolicyValues({
            maxDocuments: String(policy.maxDocuments), maxChunks: String(policy.maxChunks),
            maxSourceBytes: String(policy.maxSourceBytes), maxStoredBytes: String(policy.maxStoredBytes),
            maxEmbeddingTokens: String(policy.maxEmbeddingTokens), maxSpendMicros: String(policy.maxSpendMicros),
            maxWallTimeSeconds: String(policy.maxWallTimeSeconds), maxConcurrency: String(policy.maxConcurrency),
        });
        setPolicyOpen(true);
    }, []);

    const deactivatePolicy = useCallback(async (policy: PolicyRow) => {
        setMessage('');
        try {
            await knowledgeCommand('deactivateKnowledgeIngestionPolicy', {
                scope: policy.hostId ? 'TENANT' : 'GLOBAL', environment,
                ingestionPolicyId: policy.ingestionPolicyId,
                aggregateVersion: policy.version,
            });
            await load();
        } catch (error) {
            setMessage(knowledgeError(error));
        }
    }, [environment, load]);

    const openCreateRetrieval = useCallback(() => {
        setEditingRetrieval(null); setRetrievalScope('TENANT'); setRetrievalName('Balanced hybrid');
        setRetrievalValues({ strategy: 'HYBRID', lexicalCandidates: '20', vectorCandidates: '20',
            topK: '10', tokenBudget: '2000', operationalFailurePolicy: 'FAIL_REQUEST',
            maximumKnowledgeBases: '1', lexicalEvidenceRequired: true,
            segmentCandidateMultiplier: '4', contextExpansionBefore: '0', contextExpansionAfter: '0' });
        setRetrievalOpen(true);
    }, []);

    const openEditRetrieval = useCallback((profile: RetrievalProfileRow) => {
        setEditingRetrieval(profile); setRetrievalScope(profile.hostId ? 'TENANT' : 'GLOBAL');
        setRetrievalName(profile.profileName);
        setRetrievalValues({ strategy: profile.strategy,
            lexicalCandidates: String(profile.lexicalCandidates), vectorCandidates: String(profile.vectorCandidates),
            topK: String(profile.topK), tokenBudget: String(profile.tokenBudget),
            operationalFailurePolicy: profile.operationalFailurePolicy,
            maximumKnowledgeBases: String(profile.maximumKnowledgeBases),
            lexicalEvidenceRequired: profile.lexicalEvidenceRequired,
            segmentCandidateMultiplier: String(profile.segmentCandidateMultiplier),
            contextExpansionBefore: String(profile.contextExpansionBefore),
            contextExpansionAfter: String(profile.contextExpansionAfter) });
        setRetrievalOpen(true);
    }, []);

    const saveRetrieval = useCallback(async () => {
        if (!retrievalName.trim()) return;
        setMessage('');
        try {
            await knowledgeCommand(editingRetrieval ? 'updateKnowledgeRetrievalProfile' : 'createKnowledgeRetrievalProfile', {
                scope: retrievalScope, environment, profileName: retrievalName.trim(),
                ...(editingRetrieval ? { retrievalProfileId: editingRetrieval.profileId, aggregateVersion: editingRetrieval.version } : {}),
                strategy: retrievalValues.strategy,
                lexicalCandidates: Number(retrievalValues.lexicalCandidates), vectorCandidates: Number(retrievalValues.vectorCandidates),
                topK: Number(retrievalValues.topK), tokenBudget: Number(retrievalValues.tokenBudget), fusionMethod: 'RRF',
                operationalFailurePolicy: retrievalValues.operationalFailurePolicy, graphPolicy: {},
                maximumKnowledgeBases: Number(retrievalValues.maximumKnowledgeBases),
                lexicalEvidenceRequired: retrievalValues.lexicalEvidenceRequired,
                segmentCandidateMultiplier: Number(retrievalValues.segmentCandidateMultiplier),
                contextExpansionBefore: Number(retrievalValues.contextExpansionBefore),
                contextExpansionAfter: Number(retrievalValues.contextExpansionAfter),
            });
            setRetrievalOpen(false); await load();
        } catch (error) { setMessage(knowledgeError(error)); }
    }, [editingRetrieval, environment, load, retrievalName, retrievalScope, retrievalValues]);

    const deactivateRetrieval = useCallback(async (profile: RetrievalProfileRow) => {
        setMessage('');
        try {
            await knowledgeCommand('deactivateKnowledgeRetrievalProfile', {
                scope: profile.hostId ? 'TENANT' : 'GLOBAL', environment,
                retrievalProfileId: profile.profileId, aggregateVersion: profile.version,
            });
            await load();
        } catch (error) { setMessage(knowledgeError(error)); }
    }, [environment, load]);

    const columns = useMemo<MRT_ColumnDef<KnowledgeBaseRow>[]>(() => [
        {
            accessorKey: 'name', header: 'Knowledge Base',
            Cell: ({ row }) => <Button sx={{ textTransform: 'none' }} onClick={() =>
                navigate(`/app/genai/KnowledgeBases/${row.original.knowledgeBaseId}?environment=${encodeURIComponent(environment)}`)
            }>{row.original.name}</Button>,
        },
        { accessorKey: 'knowledgeBaseId', header: 'UUID' },
        {
            id: 'scope', header: 'Scope',
            Cell: ({ row }) => <Chip size="small" color={row.original.hostId ? 'primary' : 'secondary'} label={row.original.hostId ? 'TENANT' : 'GLOBAL'} />,
        },
        { accessorKey: 'status', header: 'Desired state' },
        { accessorKey: 'projectionState', header: 'Effective state', Cell: ({ cell }) => String(cell.getValue() || 'Pending projection') },
        { accessorKey: 'activeGenerationId', header: 'Active BASE', Cell: ({ cell }) => String(cell.getValue() || 'None') },
        { accessorKey: 'version', header: 'Version' },
    ], [environment, navigate]);

    const table = useMaterialReactTable({ columns, data: rows, state: { isLoading: loading }, initialState: { density: 'compact' } });

    return <Box sx={{ p: 2 }}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between" sx={{ mb: 2 }}>
            <Box>
                <Typography variant="h4">Knowledge Bases</Typography>
                <Typography color="text.secondary">Governed global and tenant retrieval with immutable full BASE generations.</Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="center">
                <FormControl size="small" sx={{ minWidth: 140 }}>
                    <InputLabel>Environment</InputLabel>
                    <Select label="Environment" value={environment} onChange={event => setEnvironment(event.target.value)}>
                        {['dev', 'test', 'prod'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                    </Select>
                </FormControl>
                <Button startIcon={<RefreshIcon />} onClick={() => void load()}>Refresh</Button>
                <HelpLink helpPath={HELP_PATH} tooltip="Help: Knowledge Bases" />
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Create tenant KB</Button>
            </Stack>
        </Stack>
        {message && <Alert severity="error" sx={{ mb: 2 }}>{message}</Alert>}
        {!host && <Alert severity="warning" sx={{ mb: 2 }}>Select a tenant host before administering Knowledge Bases.</Alert>}
        <MaterialReactTable table={table} />
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mt: 3, mb: 1 }}>
            <Box><Typography variant="h5">Ingestion policies</Typography><Typography color="text.secondary">Global defaults are reusable by every tenant; tenant policies override limits only for the selected tenant.</Typography></Box>
            <Button startIcon={<AddIcon />} onClick={openCreatePolicy}>Create policy</Button>
        </Stack>
        <Stack spacing={1}>{policies.map(policy => <Card variant="outlined" key={policy.ingestionPolicyId}><CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                <Box><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h6">{policy.policyName}</Typography><Chip size="small" color={policy.hostId ? 'primary' : 'secondary'} label={policy.hostId ? 'TENANT' : 'GLOBAL'} /><Chip size="small" color={policy.active ? 'success' : 'default'} label={policy.active ? 'ACTIVE' : 'INACTIVE'} /></Stack>
                    <Typography variant="body2" color="text.secondary">{policy.ingestionPolicyId}</Typography>
                    <Typography variant="body2">{policy.maxDocuments.toLocaleString()} documents · {policy.maxChunks.toLocaleString()} chunks · {policy.maxSourceBytes.toLocaleString()} source bytes · {policy.maxEmbeddingTokens.toLocaleString()} embedding tokens</Typography></Box>
                {(policy.hostId || platformAdmin) && <Stack direction="row" spacing={1}><Button onClick={() => openEditPolicy(policy)}>{policy.active ? 'Edit' : 'Review and reactivate'}</Button>{policy.active && <Button color="warning" onClick={() => void deactivatePolicy(policy)}>Deactivate</Button>}</Stack>}
            </Stack>
        </CardContent></Card>)}</Stack>
        {!policies.length && <Alert severity="warning">No ingestion policy is available. Create a tenant policy, or ask a platform Knowledge Base administrator to publish a reusable global policy.</Alert>}
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mt: 3, mb: 1 }}>
            <Box><Typography variant="h5">Retrieval profiles</Typography><Typography color="text.secondary">Reusable, bounded search behavior selected when an Agent is bound to a Knowledge Base.</Typography></Box>
            <Button startIcon={<AddIcon />} onClick={openCreateRetrieval}>Create retrieval profile</Button>
        </Stack>
        <Stack spacing={1}>{retrievalProfiles.map(profile => <Card variant="outlined" key={profile.profileId}><CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                <Box><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h6">{profile.profileName}</Typography><Chip size="small" color={profile.hostId ? 'primary' : 'secondary'} label={profile.hostId ? 'TENANT' : 'GLOBAL'} /><Chip size="small" color={profile.active ? 'success' : 'default'} label={profile.active ? 'ACTIVE' : 'INACTIVE'} /></Stack>
                    <Typography variant="body2" color="text.secondary">{profile.profileId}</Typography>
                    <Typography variant="body2">{profile.strategy} · top {profile.topK} from {profile.lexicalCandidates} lexical + {profile.vectorCandidates} vector candidates · {profile.tokenBudget.toLocaleString()} token budget</Typography></Box>
                {(profile.hostId || platformAdmin) && <Stack direction="row" spacing={1}><Button onClick={() => openEditRetrieval(profile)}>{profile.active ? 'Edit' : 'Review and reactivate'}</Button>{profile.active && <Button color="warning" onClick={() => void deactivateRetrieval(profile)}>Deactivate</Button>}</Stack>}
            </Stack>
        </CardContent></Card>)}</Stack>
        {!retrievalProfiles.length && <Alert severity="warning">No retrieval profile is available. Create a tenant profile, or ask a platform Knowledge Base administrator to publish a reusable global profile.</Alert>}
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" alignItems={{ md: 'center' }} sx={{ mt: 3, mb: 1 }}>
            <Box><Typography variant="h5">Embedding profiles</Typography><Typography color="text.secondary">Immutable, qualified embedding-space contracts used by Knowledge Base builds.</Typography></Box>
            {platformAdmin && <Button startIcon={<AddIcon />} onClick={() => setProfileOpen(true)}>Create embedding profile</Button>}
        </Stack>
        <Stack spacing={1}>{embeddingProfiles.map(profile => <Card variant="outlined" key={`${profile.profileId}:${profile.profileRevision}`}><CardContent>
            <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2}>
                <Box><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h6">{profile.aliasName}</Typography><Chip size="small" color={profile.active ? 'success' : 'default'} label={profile.active ? 'ACTIVE' : 'INACTIVE'} /></Stack>
                    <Typography variant="body2" color="text.secondary">{profile.profileId} · revision {profile.profileRevision}</Typography>
                    <Typography variant="body2">{profile.expectedSpaceId} r{profile.expectedSpaceRevision} · {profile.dimension} dimensions · {profile.normalization}/{profile.distanceMetric}</Typography></Box>
                {platformAdmin && profile.active && <Button color="warning" onClick={() => void deactivateEmbeddingProfile(profile)}>Deactivate</Button>}
            </Stack>
        </CardContent></Card>)}</Stack>
        {!embeddingProfiles.length && <Alert severity="warning">No compatible embedding profile exists. A platform administrator must publish an eligible protected kb-index Alias and create the corresponding immutable profile before a production build.</Alert>}
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Create tenant Knowledge Base</DialogTitle>
            <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
                <TextField required label="Name" value={name} onChange={event => setName(event.target.value)} />
                <TextField label="Description" multiline minRows={3} value={description} onChange={event => setDescription(event.target.value)} />
                <FormControl><InputLabel>Embedding profile</InputLabel><Select label="Embedding profile" value={embeddingProfileId} onChange={event => setEmbeddingProfileId(event.target.value)}>
                    <MenuItem value="">Assign later</MenuItem>{embeddingProfiles.filter(profile => profile.active).map(profile => <MenuItem key={`${profile.profileId}:${profile.profileRevision}`} value={profile.profileId}>{profile.aliasName} · {profile.expectedSpaceId} r{profile.expectedSpaceRevision}</MenuItem>)}
                </Select></FormControl>
                <Alert severity="info">The new Knowledge Base remains DRAFT with no active generation until a bounded source build is evaluated and promoted.</Alert>
            </Stack></DialogContent>
            <DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="contained" disabled={!name.trim()} onClick={() => void create()}>Create</Button></DialogActions>
        </Dialog>
        <Dialog open={profileOpen} onClose={() => setProfileOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Create global embedding profile</DialogTitle>
            <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
                <Alert severity="info">Select an eligible protected embedding Alias. The Alias owner and complete embedding-space contract are derived from the control plane and become immutable profile fields. Runtime validation remains separate.</Alert>
                {!qualifiedAliases.length && <Alert severity="warning">No eligible embedding Alias is available for the current host. Publish an active embedding Alias with an immutable expected space and at least one compatible route first.</Alert>}
                <FormControl required disabled={!qualifiedAliases.length}>
                    <InputLabel>Public Alias</InputLabel>
                    <Select label="Public Alias" value={selectedAliasKey} onChange={event => setSelectedAliasKey(event.target.value)}>
                        {qualifiedAliases.map(alias => <MenuItem key={qualifiedAliasKey(alias)} value={qualifiedAliasKey(alias)}>
                            {alias.aliasName} · {alias.embeddingSpace.spaceId} r{alias.embeddingSpace.revision}
                        </MenuItem>)}
                    </Select>
                </FormControl>
                <TextField label="Alias owner host ID" value={selectedAlias?.aliasOwnerHostId ?? ''} InputProps={{ readOnly: true }} />
                <TextField label="Public Alias ID" value={selectedAlias?.publicAliasId ?? ''} InputProps={{ readOnly: true }} />
                <TextField label="Expected space ID" value={selectedAlias?.embeddingSpace.spaceId ?? ''} InputProps={{ readOnly: true }} />
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
                    <TextField fullWidth label="Space revision" value={selectedAlias?.embeddingSpace.revision ?? ''} InputProps={{ readOnly: true }} />
                    <TextField fullWidth label="Dimension" value={selectedAlias?.embeddingSpace.dimension ?? ''} InputProps={{ readOnly: true }} />
                </Stack>
                <TextField label="Vector contract" value={selectedAlias ? `${selectedAlias.embeddingSpace.normalization} / ${selectedAlias.embeddingSpace.distanceMetric}` : ''} InputProps={{ readOnly: true }} />
                <TextField label="Document input transform" value={selectedAlias?.embeddingSpace.documentInputTransformVersion ?? ''} InputProps={{ readOnly: true }} />
                <TextField label="Query input transform" value="query-v1" InputProps={{ readOnly: true }} />
                <Alert severity="info">The service generates the qualification digest from this immutable contract; no digest input is required.</Alert>
            </Stack></DialogContent>
            <DialogActions><Button onClick={() => setProfileOpen(false)}>Cancel</Button><Button variant="contained" disabled={!selectedAlias} onClick={() => void createEmbeddingProfile()}>Create immutable profile</Button></DialogActions>
        </Dialog>
        <Dialog open={retrievalOpen} onClose={() => setRetrievalOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>{editingRetrieval ? 'Edit retrieval profile' : 'Create retrieval profile'}</DialogTitle>
            <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
                <FormControl><InputLabel>Ownership</InputLabel><Select disabled={Boolean(editingRetrieval)} label="Ownership" value={retrievalScope} onChange={event => setRetrievalScope(event.target.value as 'GLOBAL' | 'TENANT')}>
                    <MenuItem value="TENANT">Current tenant</MenuItem>{platformAdmin && <MenuItem value="GLOBAL">All tenants (global)</MenuItem>}
                </Select></FormControl>
                <TextField required label="Profile name" value={retrievalName} onChange={event => setRetrievalName(event.target.value)} />
                <FormControl><InputLabel>Strategy</InputLabel><Select label="Strategy" value={retrievalValues.strategy} onChange={event => setRetrievalValues(current => ({ ...current, strategy: event.target.value }))}>
                    {['LEXICAL', 'VECTOR', 'HYBRID', 'GRAPH_ASSISTED'].map(value => <MenuItem key={value} value={value}>{value}</MenuItem>)}
                </Select></FormControl>
                {(['lexicalCandidates', 'vectorCandidates', 'topK', 'tokenBudget', 'maximumKnowledgeBases', 'segmentCandidateMultiplier', 'contextExpansionBefore', 'contextExpansionAfter'] as const).map(key => <TextField key={key} required type="number" label={key.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase())} value={retrievalValues[key]} inputProps={{ min: key.startsWith('context') ? 0 : 1, max: key === 'maximumKnowledgeBases' ? 4 : key === 'segmentCandidateMultiplier' ? 16 : key.startsWith('context') ? 4 : undefined }} onChange={event => setRetrievalValues(current => ({ ...current, [key]: event.target.value }))} />)}
                <FormControl><InputLabel>Failure policy</InputLabel><Select label="Failure policy" value={retrievalValues.operationalFailurePolicy} onChange={event => setRetrievalValues(current => ({ ...current, operationalFailurePolicy: event.target.value }))}>
                    <MenuItem value="FAIL_REQUEST">Fail request</MenuItem><MenuItem value="RETURN_PARTIAL">Return partial results</MenuItem>
                </Select></FormControl>
                <FormControl><InputLabel>Lexical evidence</InputLabel><Select label="Lexical evidence" value={retrievalValues.lexicalEvidenceRequired ? 'required' : 'optional'} onChange={event => setRetrievalValues(current => ({ ...current, lexicalEvidenceRequired: event.target.value === 'required' }))}>
                    <MenuItem value="required">Required</MenuItem><MenuItem value="optional">Optional</MenuItem>
                </Select></FormControl>
                <Alert severity="info">The service generates the UUID. RRF fusion is fixed. Agent bindings select active profiles by name.</Alert>
            </Stack></DialogContent>
            <DialogActions><Button onClick={() => setRetrievalOpen(false)}>Cancel</Button><Button variant="contained" disabled={!retrievalName.trim()} onClick={() => void saveRetrieval()}>{editingRetrieval ? 'Save' : 'Create'}</Button></DialogActions>
        </Dialog>
        <Dialog open={policyOpen} onClose={() => setPolicyOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>{editingPolicy ? 'Edit ingestion policy' : 'Create ingestion policy'}</DialogTitle>
            <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
                <FormControl><InputLabel>Ownership</InputLabel><Select disabled={Boolean(editingPolicy)} label="Ownership" value={policyScope} onChange={event => setPolicyScope(event.target.value as 'GLOBAL' | 'TENANT')}>
                    <MenuItem value="TENANT">Current tenant</MenuItem>{platformAdmin && <MenuItem value="GLOBAL">All tenants (global)</MenuItem>}
                </Select></FormControl>
                <TextField required label="Policy name" value={policyName} onChange={event => setPolicyName(event.target.value)} />
                <Divider />
                {Object.entries(policyValues).map(([key, value]) => <TextField key={key} required type="number" label={key.replace(/([A-Z])/g, ' $1').replace(/^./, letter => letter.toUpperCase())} value={value} inputProps={{ min: key === 'maxSpendMicros' ? 0 : 1 }} onChange={event => setPolicyValues(current => ({ ...current, [key]: event.target.value }))} />)}
                <Alert severity="info">A policy UUID is generated by the service. Sources select an existing policy by name; administrators should not invent UUIDs.</Alert>
            </Stack></DialogContent>
            <DialogActions><Button onClick={() => setPolicyOpen(false)}>Cancel</Button><Button variant="contained" disabled={!policyName.trim() || Object.entries(policyValues).some(([key, value]) => Number(value) < (key === 'maxSpendMicros' ? 0 : 1))} onClick={() => void createPolicy()}>{editingPolicy ? 'Save' : 'Create'}</Button></DialogActions>
        </Dialog>
    </Box>;
}
