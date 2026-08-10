import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
    Alert, Box, Button, Card, CardContent, Checkbox, Chip, Dialog,
    DialogActions, DialogContent, DialogTitle, Divider, FormControlLabel,
    Grid, Stack, Tab, Tabs, TextField, Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useUserState } from '../../contexts/UserContext';
import { KnowledgeBaseRow, knowledgeCommand, knowledgeError, knowledgeQuery } from './knowledgeApi';

type UserState = { host?: string };
type Row = Record<string, any>;
const TABS = ['Overview', 'Sources', 'Documents', 'Sync Runs', 'Index Generations', 'Incremental', 'Agent Bindings', 'Access Policy', 'Retrieval Playground', 'Quality', 'Settings'];

function JsonRows({ rows, empty }: { rows: Row[]; empty: string }) {
    if (!rows.length) return <Alert severity="info">{empty}</Alert>;
    return <Stack spacing={1}>{rows.map((row, index) => <Card variant="outlined" key={String(row.sourceId ?? row.jobId ?? row.documentId ?? row.indexGenerationId ?? row.agentId ?? index)}>
        <CardContent><Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', fontSize: 12 }}>{JSON.stringify(row, null, 2)}</Box></CardContent>
    </Card>)}</Stack>;
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
    const [busy, setBusy] = useState(false);
    const [query, setQuery] = useState('How is a Light service configured?');
    const [sourceOpen, setSourceOpen] = useState(false);
    const [sourceName, setSourceName] = useState('Documentation');
    const [repositoryUri, setRepositoryUri] = useState('');
    const [commit, setCommit] = useState('');
    const [ingestionPolicyId, setIngestionPolicyId] = useState('');
    const [bindingOpen, setBindingOpen] = useState(false);
    const [agentId, setAgentId] = useState('');
    const [retrievalProfileId, setRetrievalProfileId] = useState('');
    const [evidenceRequired, setEvidenceRequired] = useState(false);

    const context = useMemo(() => ({ hostId: host, environment, knowledgeBaseId }), [environment, host, knowledgeBaseId]);
    const load = useCallback(async () => {
        if (!host || !knowledgeBaseId) return;
        setBusy(true);
        setMessage('');
        try {
            const [fresh, sourceRows, documentRows, syncRows, generationRows, bindingRows, uploadRows, changeRows, anchorRows, compactionRows, antiEntropyRows, aclFreshnessRows, aclReconciliationRows, aclTransitionRows, connectorObjectRows, migrationRows, migrationEvaluationRows, retentionRows, checkpointRows, purgeRows] = await Promise.all([
                knowledgeQuery<KnowledgeBaseRow>('getFreshKnowledgeBase', context),
                knowledgeQuery<{ knowledgeSources?: Row[] }>('getKnowledgeSources', context),
                knowledgeQuery<{ knowledgeDocuments?: Row[] }>('getKnowledgeDocuments', context),
                knowledgeQuery<{ knowledgeSyncRuns?: Row[] }>('getKnowledgeSyncRuns', context),
                knowledgeQuery<{ knowledgeIndexGenerations?: Row[] }>('getKnowledgeIndexGenerations', context),
                knowledgeQuery<{ agentKnowledgeBaseBindings?: Row[] }>('getAgentKnowledgeBaseBindings', { hostId: host, environment }),
                knowledgeQuery<{ knowledgeUploads?: Row[] }>('getKnowledgeUploads', context),
                knowledgeQuery<{ knowledgeIncrementalChanges?: Row[] }>('getKnowledgeIncrementalChanges', context),
                knowledgeQuery<{ knowledgePassageAnchors?: Row[] }>('getKnowledgePassageAnchors', context),
                knowledgeQuery<{ knowledgeCompactionRuns?: Row[] }>('getKnowledgeCompactionRuns', context),
                knowledgeQuery<{ knowledgeAntiEntropyRuns?: Row[] }>('getKnowledgeAntiEntropyRuns', context),
                knowledgeQuery<{ knowledgeAclFreshness?: Row[] }>('getKnowledgeAclFreshness', context),
                knowledgeQuery<{ knowledgeAclReconciliations?: Row[] }>('getKnowledgeAclReconciliations', context),
                knowledgeQuery<{ knowledgeAclTransitions?: Row[] }>('getKnowledgeAclTransitions', context),
                knowledgeQuery<{ knowledgeConnectorObjects?: Row[] }>('getKnowledgeConnectorObjects', context),
                knowledgeQuery<{ knowledgeBaseEmbeddingMigrations?: Row[] }>('getKnowledgeBaseEmbeddingMigrations', context),
                knowledgeQuery<{ knowledgeMigrationEvaluations?: Row[] }>('getKnowledgeMigrationEvaluations', context),
                knowledgeQuery<{ knowledgeGenerationRetention?: Row[] }>('getKnowledgeGenerationRetention', context),
                knowledgeQuery<{ knowledgeBackupCheckpoints?: Row[] }>('getKnowledgeBackupCheckpoints', context),
                knowledgeQuery<{ knowledgePurgeEvidence?: Row[] }>('getKnowledgePurgeEvidence', context),
            ]);
            setBase(fresh);
            setSources(sourceRows.knowledgeSources || []);
            setDocuments(documentRows.knowledgeDocuments || []);
            setRuns(syncRows.knowledgeSyncRuns || []);
            setGenerations(generationRows.knowledgeIndexGenerations || []);
            setBindings((bindingRows.agentKnowledgeBaseBindings || []).filter(row => row.knowledgeBaseId === knowledgeBaseId));
            setIncremental([
                ...(uploadRows.knowledgeUploads || []).map(row => ({ diagnosticType: 'UPLOAD', ...row })),
                ...(changeRows.knowledgeIncrementalChanges || []).map(row => ({ diagnosticType: 'CHANGE', ...row })),
                ...(anchorRows.knowledgePassageAnchors || []).map(row => ({ diagnosticType: 'PASSAGE_ANCHOR', ...row })),
                ...(compactionRows.knowledgeCompactionRuns || []).map(row => ({ diagnosticType: 'COMPACTION', ...row })),
                ...(antiEntropyRows.knowledgeAntiEntropyRuns || []).map(row => ({ diagnosticType: 'ANTI_ENTROPY', ...row })),
            ]);
            setAccessDiagnostics([
                ...(aclFreshnessRows.knowledgeAclFreshness || []).map(row => ({ diagnosticType: 'ACL_FRESHNESS', ...row })),
                ...(aclReconciliationRows.knowledgeAclReconciliations || []).map(row => ({ diagnosticType: 'ACL_RECONCILIATION', ...row })),
                ...(aclTransitionRows.knowledgeAclTransitions || []).map(row => ({ diagnosticType: 'ACL_TRANSITION', ...row })),
                ...(connectorObjectRows.knowledgeConnectorObjects || []).map(row => ({ diagnosticType: 'CONNECTOR_OBJECT', ...row })),
            ]);
            setProductionOperations([
                ...(migrationRows.knowledgeBaseEmbeddingMigrations || []).map(row => ({ diagnosticType: 'EMBEDDING_MIGRATION', ...row })),
                ...(migrationEvaluationRows.knowledgeMigrationEvaluations || []).map(row => ({ diagnosticType: 'MIGRATION_EVALUATION', ...row })),
                ...(retentionRows.knowledgeGenerationRetention || []).map(row => ({ diagnosticType: 'GENERATION_RETENTION', ...row })),
                ...(checkpointRows.knowledgeBackupCheckpoints || []).map(row => ({ diagnosticType: 'BACKUP_CHECKPOINT', ...row })),
                ...(purgeRows.knowledgePurgeEvidence || []).map(row => ({ diagnosticType: 'PURGE_EVIDENCE', ...row })),
            ]);
        } catch (error) {
            setMessage(knowledgeError(error));
        } finally {
            setBusy(false);
        }
    }, [context, environment, host, knowledgeBaseId]);

    useEffect(() => { void load(); }, [load]);

    const command = useCallback(async (action: string, data: Row = {}) => {
        setBusy(true);
        setMessage('');
        try {
            await knowledgeCommand(action, { scope: base?.hostId ? 'TENANT' : 'GLOBAL', environment, knowledgeBaseId, ...data });
            await load();
        } catch (error) {
            setMessage(knowledgeError(error));
        } finally {
            setBusy(false);
        }
    }, [base?.hostId, environment, knowledgeBaseId, load]);

    const active = generations.find(row => row.state === 'PROMOTED' || row.indexGenerationId === base?.activeGenerationId);
    const migration = productionOperations.find(row => row.diagnosticType === 'EMBEDDING_MIGRATION' && !['CANCELLED', 'FAILED', 'RETIRED', 'ROLLED_BACK'].includes(row.state));
    return <Box sx={{ p: 2 }}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(`/app/genai/KnowledgeBases?environment=${encodeURIComponent(environment)}`)}>Knowledge Bases</Button>
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" sx={{ my: 2 }}>
            <Box><Stack direction="row" spacing={1} alignItems="center"><Typography variant="h4">{base?.name || knowledgeBaseId}</Typography><Chip size="small" label={base?.hostId ? 'TENANT' : 'GLOBAL'} color={base?.hostId ? 'primary' : 'secondary'} /><Chip size="small" label={base?.status || 'Loading'} /></Stack>
                <Typography color="text.secondary">{knowledgeBaseId} · {environment}</Typography></Box>
            <Stack direction="row" spacing={1}><Button startIcon={<RefreshIcon />} disabled={busy} onClick={() => void load()}>Refresh</Button><Button disabled={busy} onClick={() => void command('requestKnowledgeBaseReindex')}>Rebuild full BASE</Button><Button disabled={busy} onClick={() => void command('requestKnowledgeBaseCompaction')}>Compact DELTAs</Button></Stack>
        </Stack>
        {message && <Alert severity="error" sx={{ mb: 2 }}>{message}</Alert>}
        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>{TABS.map(label => <Tab key={label} label={label} />)}</Tabs>
        {tab === 0 && <Grid container spacing={2}>{[
            ['Desired state', base?.status || '—'], ['Effective projection', base?.projectionState || 'Pending'],
            ['Active BASE', base?.activeGenerationId || 'None'], ['Pointer version', String(base?.pointerVersion ?? '—')],
            ['Sources', String(sources.length)], ['Documents', String(documents.length)],
        ].map(([label, value]) => <Grid key={label} size={{ xs: 12, md: 4 }}><Card variant="outlined"><CardContent><Typography color="text.secondary">{label}</Typography><Typography sx={{ overflowWrap: 'anywhere' }}>{value}</Typography></CardContent></Card></Grid>)}</Grid>}
        {tab === 1 && <Box><Stack direction="row" spacing={1} sx={{ mb: 2 }}><Button variant="contained" onClick={() => setSourceOpen(true)}>Add Git/Markdown source</Button>{sources.map(source => <Button key={source.sourceId} disabled={busy} onClick={() => void command('requestKnowledgeSourceSync', { sourceId: source.sourceId })}>Sync {source.displayName}</Button>)}</Stack><JsonRows rows={sources} empty="No bounded Git/Markdown source has been configured." /></Box>}
        {tab === 2 && <JsonRows rows={documents} empty="No immutable document versions exist before the first completed build." />}
        {tab === 3 && <JsonRows rows={runs} empty="No full-BASE sync run has been recorded." />}
        {tab === 4 && <Stack spacing={2}>{active && <Alert severity="success">Active immutable BASE: {active.indexGenerationId}</Alert>}<Alert severity="info">Embedding migration candidates remain isolated from Agent retrieval until an authorized atomic promotion. Old- and new-space raw scores are never merged.</Alert><Stack direction={{ xs: 'column', md: 'row' }} spacing={1}><TextField label="Target embedding profile UUID" value={targetEmbeddingProfileId} onChange={event => { setTargetEmbeddingProfileId(event.target.value); setMigrationEstimate(null); }} /><TextField label="Profile revision" type="number" value={targetEmbeddingProfileRevision} onChange={event => { setTargetEmbeddingProfileRevision(event.target.value); setMigrationEstimate(null); }} /><TextField label="Cost ceiling (micros)" type="number" value={migrationCostCeilingMicros} onChange={event => setMigrationCostCeilingMicros(event.target.value)} /><Button disabled={busy || !active || !targetEmbeddingProfileId} onClick={() => { setBusy(true); void knowledgeQuery<{ knowledgeBaseEmbeddingMigrationEstimate?: Row[] }>('estimateKnowledgeBaseEmbeddingMigration', { ...context, targetEmbeddingProfileId, targetEmbeddingProfileRevision }).then(result => setMigrationEstimate(result.knowledgeBaseEmbeddingMigrationEstimate?.[0] || null)).catch(error => setMessage(knowledgeError(error))).finally(() => setBusy(false)); }}>Estimate</Button><Button disabled={busy || !active || !migrationEstimate || (migrationEstimate.blockingConditions || []).length > 0} onClick={() => void command('requestKnowledgeBaseEmbeddingMigration', { targetEmbeddingProfileId, targetEmbeddingProfileRevision: Number(targetEmbeddingProfileRevision), estimateVersion: 1, expectedActiveGenerationId: active?.indexGenerationId, acceptedCostCeilingMicros: Number(migrationCostCeilingMicros), rollbackWindowSeconds: 86400 })}>Approve budget and start</Button></Stack>{migrationEstimate && <JsonRows rows={[{ diagnosticType: 'MIGRATION_ESTIMATE', ...migrationEstimate }]} empty="No estimate." />}{migration && <Stack direction="row" spacing={1}><Button disabled={busy || !['PREFLIGHTED', 'BACKFILLING', 'CATCHING_UP', 'VALIDATING'].includes(migration.state)} onClick={() => void command('pauseKnowledgeBaseEmbeddingMigration', { migrationId: migration.migrationId, expectedMigrationVersion: migration.version })}>Pause</Button><Button disabled={busy || migration.state !== 'PAUSED'} onClick={() => void command('resumeKnowledgeBaseEmbeddingMigration', { migrationId: migration.migrationId, expectedMigrationVersion: migration.version })}>Resume</Button><Button color="warning" disabled={busy || ['SOAKING', 'PROMOTED'].includes(migration.state)} onClick={() => void command('cancelKnowledgeBaseEmbeddingMigration', { migrationId: migration.migrationId, expectedMigrationVersion: migration.version })}>Cancel</Button><Button variant="contained" disabled={busy || migration.state !== 'READY'} onClick={() => void command('promoteKnowledgeBaseIndexGeneration', { migrationId: migration.migrationId, expectedPointerVersion: base?.pointerVersion, expectedActiveGenerationId: active?.indexGenerationId, authorizedBy: 'portal-operator' })}>Promote candidate</Button><Button color="warning" disabled={busy || migration.state !== 'SOAKING'} onClick={() => void command('rollbackKnowledgeBaseIndexGeneration', { migrationId: migration.migrationId, expectedPointerVersion: base?.pointerVersion, reason: 'operator rollback' })}>Rollback</Button></Stack>}<JsonRows rows={[...generations, ...productionOperations]} empty="No candidate generation or production operation exists." /></Stack>}
        {tab === 5 && <Stack spacing={2}><Alert severity="info">Phase 1b diagnostics show upload scanning, classified changes, stable anchors, compaction, and anti-entropy without exposing source text.</Alert><JsonRows rows={incremental} empty="No Phase 1b incremental diagnostics have been recorded." /></Stack>}
        {tab === 6 && <Box><Button variant="contained" sx={{ mb: 2 }} onClick={() => setBindingOpen(true)}>Bind Agent</Button><JsonRows rows={bindings} empty="No Agent in this tenant is bound to this Knowledge Base." /></Box>}
        {tab === 7 && <Stack spacing={2}><Alert severity={base?.projectionState === 'ACTIVE' ? 'success' : 'warning'}>Desired state: {base?.status || '—'}; effective state: {base?.projectionState || 'pending'}. Mirrored source access fails closed when reconciliation is incomplete, stale, ambiguous, or contains an unresolved principal.</Alert><Stack direction={{ xs: 'column', md: 'row' }} spacing={1}><TextField label="Normalized subject type" value={simulationSubjectType} onChange={event => setSimulationSubjectType(event.target.value.toUpperCase())} helperText="USER, GROUP, or ORGANIZATION" /><TextField fullWidth label="Normalized subject ID" value={simulationSubjectId} onChange={event => setSimulationSubjectId(event.target.value)} /><Button disabled={busy || !simulationSubjectId} onClick={() => { setBusy(true); void knowledgeQuery<{ knowledgeAuthorizationSimulation?: Row[] }>('simulateKnowledgeAuthorization', { ...context, subjectType: simulationSubjectType, subjectId: simulationSubjectId }).then(result => setAccessDiagnostics(current => [...(result.knowledgeAuthorizationSimulation || []).map(row => ({ diagnosticType: 'AUTHORIZATION_SIMULATION', ...row })), ...current])).catch(error => setMessage(knowledgeError(error))).finally(() => setBusy(false)); }}>Simulate access</Button></Stack><JsonRows rows={[...sources.map(source => ({ diagnosticType: 'SOURCE_POLICY', sourceId: source.sourceId, aclMode: source.aclMode, sourceTrustTier: source.sourceTrustTier, approvalPolicy: source.approvalPolicy })), ...accessDiagnostics]} empty="Source trust and permission coverage evidence appears after source configuration." /></Stack>}
        {tab === 8 && <Stack spacing={2}><Alert severity="info">The Portal retrieval-test workflow is not released. Use the authorized light-knowledge retrieval API and its audit records for qualification.</Alert><TextField label="Question" multiline minRows={3} value={query} onChange={event => setQuery(event.target.value)} disabled /></Stack>}
        {tab === 9 && <Stack spacing={2}><Alert severity="info">Phase 3 quality includes migration watermark, reusable-chunk, budget, candidate-isolation, evaluation, rollback-retention, backup, anti-entropy, and purge evidence. Live provider latency and Recall@10 qualification remain separate promotion gates.</Alert><JsonRows rows={[...generations.map(row => ({ indexGenerationId: row.indexGenerationId, state: row.state, evidence: row.evidence })), ...productionOperations]} empty="Quality and operational evidence appears after a candidate or maintenance run." /></Stack>}
        {tab === 10 && <Stack spacing={2}><Card variant="outlined"><CardContent><Typography variant="h6">Lifecycle and retention</Typography><Divider sx={{ my: 1 }} /><Box component="pre" sx={{ whiteSpace: 'pre-wrap', fontSize: 12 }}>{JSON.stringify(base, null, 2)}</Box></CardContent></Card><Alert severity="warning">Physical Knowledge purge is not released. Deactivation is available; retention-safe purge remains fail-closed at the command boundary.</Alert><Stack direction="row" spacing={1}><Button color="warning" disabled={busy || base?.status === 'INACTIVE'} onClick={() => void command('deactivateKnowledgeBase', { aggregateVersion: base?.version })}>Deactivate</Button></Stack></Stack>}
        <Dialog open={sourceOpen} onClose={() => setSourceOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Add bounded Git/Markdown source</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
            <TextField required label="Display name" value={sourceName} onChange={event => setSourceName(event.target.value)} />
            <TextField required label="Approved repository URI" value={repositoryUri} onChange={event => setRepositoryUri(event.target.value)} />
            <TextField required label="Immutable commit" value={commit} onChange={event => setCommit(event.target.value)} helperText="Branch-only sources are rejected in the Phase 1a pilot." />
            <TextField required label="Ingestion policy UUID" value={ingestionPolicyId} onChange={event => setIngestionPolicyId(event.target.value)} />
            <Alert severity="info">The connector ignores symlinks and executable hooks and enforces the approved path, file, byte, chunk, token, and time ceilings.</Alert>
        </Stack></DialogContent><DialogActions><Button onClick={() => setSourceOpen(false)}>Cancel</Button><Button variant="contained" disabled={!sourceName || !repositoryUri || !commit || !ingestionPolicyId} onClick={() => { setSourceOpen(false); void command('createKnowledgeSource', { displayName: sourceName, sourceType: 'GIT_MARKDOWN', configJson: { repositoryUri, commit, include: ['**/*.md'], exclude: [] }, ingestionPolicyId, aclMode: 'UNIFORM_SCOPE', sourceTrustTier: 'UNREVIEWED', approvalPolicy: {}, schedule: {}, aclReconciliationPolicy: {} }); }}>Create source</Button></DialogActions></Dialog>
        <Dialog open={bindingOpen} onClose={() => setBindingOpen(false)} fullWidth maxWidth="sm"><DialogTitle>Bind Agent to Knowledge Base</DialogTitle><DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
            <TextField required label="Agent UUID" value={agentId} onChange={event => setAgentId(event.target.value)} />
            <TextField required label="Retrieval profile UUID" value={retrievalProfileId} onChange={event => setRetrievalProfileId(event.target.value)} />
            <TextField type="number" label="Priority" defaultValue={50} inputProps={{ min: 1, max: 100 }} disabled />
            <FormControlLabel control={<Checkbox checked={evidenceRequired} onChange={event => setEvidenceRequired(event.target.checked)} />} label="Fail the turn when Knowledge evidence is unavailable" />
            <Alert severity="warning">Phase 1b permits up to four active Knowledge Bases per Agent. The runtime re-authorizes every binding and fuses local ranks without comparing raw cross-space scores.</Alert>
        </Stack></DialogContent><DialogActions><Button onClick={() => setBindingOpen(false)}>Cancel</Button><Button variant="contained" disabled={!agentId || !retrievalProfileId} onClick={() => { setBindingOpen(false); void command('bindAgentKnowledgeBase', { agentId, retrievalProfileId, priority: 50, evidenceRequired, allowedSourceTrustTiers: [] }); }}>Bind Agent</Button></DialogActions></Dialog>
    </Box>;
}
