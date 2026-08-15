import { useEffect, useMemo, useState } from 'react';
import {
    Alert,
    Autocomplete,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Dialog,
    DialogActions,
    DialogContent,
    DialogTitle,
    Divider,
    FormControlLabel,
    List,
    ListItem,
    ListItemText,
    MenuItem,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import fetchClient from '../../utils/fetchClient';
import { attachAiAuthoringApproval, buildDefinitionDiff, type AuthoringProvenance } from './workflowAiAuthoring';

export type WorkflowAuthoringTool = {
    id: string;
    name: string;
    description?: string;
    inputSchema?: Record<string, unknown>;
    outputSchema?: Record<string, unknown>;
    readOnly?: boolean;
    contractDigest?: string;
};

type DraftResult = {
    ok: boolean;
    definition: string;
    assumptions: string[];
    policyFindings: string[];
    fixtures: Record<string, unknown>;
    dependencyGraph: { nodes?: unknown[]; edges?: unknown[] };
    provenance: AuthoringProvenance;
    error?: { code?: string; message?: string; retryable?: boolean };
};

type WorkflowAiAuthoringDialogProps = {
    open: boolean;
    hostId: string;
    reviewerUserId: string;
    currentDefinition: string;
    tools: WorkflowAuthoringTool[];
    onClose: () => void;
    onApprove: (definition: string) => void;
};

function recordValue(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export default function WorkflowAiAuthoringDialog({
    open,
    hostId,
    reviewerUserId,
    currentDefinition,
    tools,
    onClose,
    onApprove,
}: WorkflowAiAuthoringDialogProps) {
    const [intent, setIntent] = useState('');
    const [mode, setMode] = useState<'sync' | 'async'>('sync');
    const [selectedTools, setSelectedTools] = useState<WorkflowAuthoringTool[]>([]);
    const [draft, setDraft] = useState<DraftResult | null>(null);
    const [reviewed, setReviewed] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        if (!open) return;
        setDraft(null);
        setReviewed(false);
        setError('');
    }, [open]);

    const diff = useMemo(
        () => draft ? buildDefinitionDiff(currentDefinition, draft.definition) : null,
        [currentDefinition, draft],
    );

    const generate = async () => {
        if (!hostId || !intent.trim() || !selectedTools.length) {
            setError('Host, authoring intent, and at least one explicitly selected tool are required.');
            return;
        }
        setIsGenerating(true);
        setError('');
        setDraft(null);
        setReviewed(false);
        const cmd = {
            host: 'lightapi.net',
            service: 'workflow',
            action: 'generateWfDefinitionDraft',
            version: '0.1.0',
            data: {
                hostId,
                intent: intent.trim(),
                mode,
                existingDefinition: currentDefinition,
                operations: selectedTools.map(tool => ({
                    kind: 'tool',
                    id: tool.id,
                    name: tool.name,
                    description: tool.description,
                    inputSchema: tool.inputSchema,
                    outputSchema: tool.outputSchema,
                    readOnly: tool.readOnly,
                    contractDigest: tool.contractDigest,
                })),
            },
        };
        try {
            const result = await fetchClient('/portal/query', { method: 'POST', body: cmd }) as DraftResult;
            if (!result.ok) {
                setError(`${result.error?.code || 'WORKFLOW_AUTHORING_FAILED'}: ${result.error?.message || 'Draft generation failed.'}`);
                return;
            }
            setDraft(result);
        } catch (cause) {
            const value = recordValue(cause);
            setError(String(value.message || value.description || 'Draft generation failed.'));
        } finally {
            setIsGenerating(false);
        }
    };

    const approve = () => {
        if (!draft || !reviewed || !reviewerUserId) return;
        onApprove(attachAiAuthoringApproval(draft.definition, draft.provenance, reviewerUserId));
        onClose();
    };

    return (
        <Dialog open={open} onClose={isGenerating ? undefined : onClose} maxWidth="xl" fullWidth>
            <DialogTitle>AI-Assisted Workflow Draft</DialogTitle>
            <DialogContent dividers>
                <Alert severity="info" sx={{ mb: 2 }}>
                    Generation is draft-only. Only the tools selected below are sent as bounded context, and the result must pass deterministic validation and explicit review.
                </Alert>
                {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', lg: 'minmax(300px, 0.8fr) minmax(0, 1.6fr)' }, gap: 2 }}>
                    <Stack spacing={2}>
                        <TextField
                            label="What should this workflow accomplish?"
                            value={intent}
                            onChange={event => setIntent(event.target.value)}
                            multiline
                            minRows={5}
                            inputProps={{ maxLength: 8000 }}
                        />
                        <TextField select label="Invocation Mode" value={mode} onChange={event => setMode(event.target.value as 'sync' | 'async')}>
                            <MenuItem value="sync">Synchronous</MenuItem>
                            <MenuItem value="async">Asynchronous</MenuItem>
                        </TextField>
                        <Autocomplete
                            multiple
                            options={tools}
                            value={selectedTools}
                            getOptionLabel={tool => tool.name}
                            isOptionEqualToValue={(left, right) => left.id === right.id}
                            onChange={(_, value) => setSelectedTools(value.slice(0, 24))}
                            renderInput={params => <TextField {...params} label="Approved Tool Context" helperText="Select up to 24 authorization-filtered tools." />}
                        />
                        <Button
                            variant="contained"
                            startIcon={isGenerating ? <CircularProgress size={18} color="inherit" /> : <AutoAwesomeIcon />}
                            onClick={generate}
                            disabled={isGenerating || !intent.trim() || !selectedTools.length}
                        >
                            Generate Draft
                        </Button>
                        {draft && (
                            <>
                                <Divider />
                                <Typography variant="subtitle2">Provenance</Typography>
                                <Typography variant="body2">Model: {draft.provenance.generatorModel}</Typography>
                                <Typography variant="body2">Template: {draft.provenance.promptTemplateVersion}</Typography>
                                <Typography variant="body2">Workflow schema: {draft.provenance.workflowSchemaVersion}</Typography>
                                <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>Schema: sha256:{draft.provenance.workflowSchemaDigest}</Typography>
                                <Typography variant="caption" sx={{ overflowWrap: 'anywhere' }}>Request: {draft.provenance.requestDigest}</Typography>
                                <Typography variant="caption">{Object.keys(draft.provenance.sourceSchemaDigests).length} source schema digests pinned</Typography>
                            </>
                        )}
                    </Stack>
                    <Stack spacing={2} sx={{ minWidth: 0 }}>
                        {draft ? (
                            <>
                                <Stack direction="row" spacing={1} flexWrap="wrap">
                                    <Chip label={`${diff?.added || 0} lines added`} color="success" variant="outlined" />
                                    <Chip label={`${diff?.removed || 0} lines removed`} color="warning" variant="outlined" />
                                    <Chip label={`${draft.dependencyGraph?.nodes?.length || 0} dependency nodes`} />
                                    <Chip label={`${draft.dependencyGraph?.edges?.length || 0} dependency edges`} />
                                </Stack>
                                <Box component="pre" sx={{ m: 0, p: 1.5, maxHeight: 260, overflow: 'auto', bgcolor: 'grey.100', whiteSpace: 'pre-wrap', fontSize: 12 }}>
                                    {diff?.text}
                                </Box>
                                <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' }, gap: 2 }}>
                                    <Box>
                                        <Typography variant="subtitle2">Assumptions</Typography>
                                        <List dense>{draft.assumptions.length ? draft.assumptions.map(item => <ListItem key={item}><ListItemText primary={item} /></ListItem>) : <ListItem><ListItemText primary="None declared." /></ListItem>}</List>
                                    </Box>
                                    <Box>
                                        <Typography variant="subtitle2">Policy Findings</Typography>
                                        <List dense>{draft.policyFindings.length ? draft.policyFindings.map(item => <ListItem key={item}><ListItemText primary={item} /></ListItem>) : <ListItem><ListItemText primary="None declared." /></ListItem>}</List>
                                    </Box>
                                </Box>
                                <Box>
                                    <Typography variant="subtitle2">Generated Test Fixtures</Typography>
                                    <Stack direction="row" spacing={1} flexWrap="wrap" sx={{ mt: 1 }}>
                                        {Object.keys(draft.fixtures).map(name => <Chip key={name} label={name} size="small" variant="outlined" />)}
                                    </Stack>
                                </Box>
                                <TextField label="Proposed YAML" value={draft.definition} multiline minRows={16} slotProps={{ input: { readOnly: true } }} />
                                <FormControlLabel
                                    control={<Checkbox checked={reviewed} onChange={event => setReviewed(event.target.checked)} />}
                                    label="I reviewed the diff, assumptions, dependency graph, fixtures, and policy findings."
                                />
                            </>
                        ) : (
                            <Typography color="text.secondary">The validated proposal, change summary, assumptions, policy findings, fixtures, and provenance will appear here.</Typography>
                        )}
                    </Stack>
                </Box>
            </DialogContent>
            <DialogActions>
                <Button onClick={onClose} disabled={isGenerating}>Cancel</Button>
                <Button variant="contained" onClick={approve} disabled={!draft || !reviewed || !reviewerUserId}>
                    Approve And Apply Draft
                </Button>
            </DialogActions>
        </Dialog>
    );
}
