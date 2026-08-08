import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Chip,
    CircularProgress,
    Divider,
    Stack,
    Tab,
    Tabs,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/Edit';
import { useUserState } from '../../contexts/UserContext';
import { buildGenAiTaskContext, buildGenAiTaskRoute, GenAiTaskLayout } from './genAiTaskUtils';
import HindsightResourceTable from './HindsightResourceTable';
import { compactContent, hindsightErrorMessage, runHindsightQuery, type HindsightRow } from './hindsightMemoryApi';
import { HINDSIGHT_RESOURCES } from './hindsightMemoryResources';

type MemoryBank = HindsightRow & {
    bankName: string;
    agentDefinitionName?: string;
    userEmail?: string;
    disposition?: Record<string, number>;
    background?: string;
    runtimeManaged?: boolean;
    active?: boolean;
};

type UserState = { host?: string };

function ExpandableText({ value, maximum = 320 }: { value?: string; maximum?: number }) {
    const [expanded, setExpanded] = useState(false);
    if (!value) return <Typography>—</Typography>;
    const canExpand = value.length > maximum;
    return (
        <Box>
            <Typography sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
                {expanded ? value : compactContent(value, maximum)}
            </Typography>
            {canExpand && (
                <Button size="small" onClick={() => setExpanded(current => !current)}>
                    {expanded ? 'Show less' : 'Show full background'}
                </Button>
            )}
        </Box>
    );
}

export default function MemoryBankWorkspace() {
    const navigate = useNavigate();
    const location = useLocation();
    const { bankId = '' } = useParams<{ bankId: string }>();
    const { host } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const stateBank = (location.state as any)?.data as Partial<MemoryBank> | undefined;
    const [bank, setBank] = useState<MemoryBank | null>(stateBank?.bankId ? stateBank as MemoryBank : null);
    const [tab, setTab] = useState('overview');
    const [loading, setLoading] = useState(!bank);
    const [message, setMessage] = useState('');
    const taskContext = useMemo(() => ({ ...buildGenAiTaskContext(host, searchParams), bankId }), [bankId, host, searchParams]);

    const fetchBank = useCallback(async () => {
        if (!host || !bankId) return;
        setLoading(true);
        setMessage('');
        try {
            const response = await runHindsightQuery<Record<string, any>>('getAgentMemoryBanks', {
                hostId: host, offset: 0, limit: 1, filters: [{ id: 'bankId', value: bankId }],
                globalFilter: '', sorting: [], active: true, includeRuntimeManaged: true,
            });
            const current = response.agentMemoryBanks?.[0];
            if (!current) throw new Error('not found');
            setBank(current);
        } catch (error) {
            setMessage(hindsightErrorMessage(error));
        } finally {
            setLoading(false);
        }
    }, [bankId, host]);

    useEffect(() => { void fetchBank(); }, [fetchBank]);

    const editBank = useCallback(async () => {
        if (!bank) return;
        setMessage('');
        try {
            const fresh = await runHindsightQuery<MemoryBank>('getFreshAgentMemoryBank', {
                hostId: bank.hostId, bankId: bank.bankId, aggregateVersion: bank.aggregateVersion,
            });
            navigate(buildGenAiTaskRoute('/app/form/updateAgentMemoryBank', searchParams, taskContext), {
                state: {
                    data: {
                        hostId: fresh.hostId, bankId: fresh.bankId, agentDefId: fresh.agentDefId,
                        userId: fresh.userId, bankName: fresh.bankName, disposition: fresh.disposition,
                        background: fresh.background, aggregateVersion: fresh.aggregateVersion,
                    },
                    source: location.pathname + location.search,
                },
            });
        } catch (error) {
            setMessage(hindsightErrorMessage(error));
        }
    }, [bank, location.pathname, location.search, navigate, searchParams, taskContext]);

    if (!host || !bankId) {
        return <Alert severity="error">A host and bank id are required to open the Hindsight workspace.</Alert>;
    }

    return (
        <GenAiTaskLayout context={taskContext}>
            <Box>
                <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" spacing={2} sx={{ mb: 2 }}>
                    <Stack direction="row" spacing={1} alignItems="center">
                        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/genai/MemoryBanks')}>Banks</Button>
                        <Box>
                            <Stack direction="row" spacing={1} alignItems="center">
                                <Typography variant="h4">{bank?.bankName || 'Hindsight Memory Bank'}</Typography>
                                {bank?.runtimeManaged && <Chip label="Runtime managed" color="info" size="small" />}
                            </Stack>
                            <Typography variant="body2" color="text.secondary">{bankId}</Typography>
                        </Box>
                    </Stack>
                    {bank && !bank.runtimeManaged && <Button startIcon={<EditIcon />} variant="outlined" onClick={() => void editBank()}>Edit Bank</Button>}
                </Stack>
                {message && <Alert severity="error" sx={{ mb: 2 }}>{message}</Alert>}
                {loading && <CircularProgress />}
                {!loading && bank && (
                    <>
                        <Tabs value={tab} onChange={(_, value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
                            <Tab value="overview" label="Overview" />
                            {HINDSIGHT_RESOURCES.map(resource => <Tab key={resource.id} value={resource.id} label={resource.label} />)}
                        </Tabs>
                        {tab === 'overview' ? (
                            <Stack spacing={2}>
                                <Stack direction={{ xs: 'column', md: 'row' }} spacing={4}>
                                    <Box><Typography variant="overline">Agent Definition</Typography><Typography>{bank.agentDefinitionName || bank.agentDefId || '—'}</Typography></Box>
                                    <Box><Typography variant="overline">User</Typography><Typography>{bank.userEmail || bank.userId || '—'}</Typography></Box>
                                    <Box><Typography variant="overline">Version</Typography><Typography>{bank.aggregateVersion}</Typography></Box>
                                    <Box><Typography variant="overline">Active</Typography><Typography>{bank.active ? 'Yes' : 'No'}</Typography></Box>
                                </Stack>
                                <Divider />
                                <Box><Typography variant="overline">Disposition</Typography><Typography component="pre" variant="body2">{JSON.stringify(bank.disposition || {}, null, 2)}</Typography></Box>
                                <Box><Typography variant="overline">Background</Typography><ExpandableText value={bank.background} /></Box>
                            </Stack>
                        ) : (
                            HINDSIGHT_RESOURCES.filter(resource => resource.id === tab).map(resource => (
                                <HindsightResourceTable
                                    key={resource.id}
                                    hostId={host}
                                    bankId={bankId}
                                    config={resource.config}
                                    searchParams={searchParams}
                                    taskContext={taskContext}
                                    bankReadOnly={bank.runtimeManaged}
                                />
                            ))
                        )}
                    </>
                )}
            </Box>
        </GenAiTaskLayout>
    );
}
