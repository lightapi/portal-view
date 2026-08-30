import { useMemo } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Alert, Box, Button, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useUserState } from '../../contexts/UserContext';
import { buildGenAiTaskContext, GenAiTaskLayout } from './genAiTaskUtils';
import HindsightResourceTable from './HindsightResourceTable';
import { AGENT_DIRECTIVE_RESOURCE } from './hindsightMemoryResources';

type UserState = { host?: string };

export default function AgentDirectives() {
    const navigate = useNavigate();
    const location = useLocation();
    const { agentDefId = '' } = useParams<{ agentDefId: string }>();
    const { host } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const stateAgent = (location.state as any)?.data as { agentName?: string; aggregateVersion?: number } | undefined;
    const createDefaults = useMemo(
        () => stateAgent?.aggregateVersion ? { agentDefinitionVersion: stateAgent.aggregateVersion } : {},
        [stateAgent?.aggregateVersion],
    );
    const taskContext = useMemo(
        () => ({ ...buildGenAiTaskContext(host, searchParams), agentDefId }),
        [agentDefId, host, searchParams],
    );

    if (!host || !agentDefId) {
        return <Alert severity="error">A host and Agent Definition id are required to manage directives.</Alert>;
    }

    return (
        <GenAiTaskLayout context={taskContext}>
            <Box>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }} sx={{ mb: 2 }}>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/app/genai/AgentDefinition')}>
                        Agents
                    </Button>
                    <Box>
                        <Typography variant="h4">{stateAgent?.agentName || 'Agent'} Directives</Typography>
                        <Typography variant="body2" color="text.secondary">{agentDefId}</Typography>
                    </Box>
                </Stack>
                <Alert severity="info" sx={{ mb: 2 }}>
                    Hard directives are published Agent policy. They target a bank profile and scope selector,
                    never one runtime memory bank.
                </Alert>
                <HindsightResourceTable
                    hostId={host}
                    agentDefId={agentDefId}
                    config={AGENT_DIRECTIVE_RESOURCE.config}
                    searchParams={searchParams}
                    taskContext={taskContext}
                    createDefaults={createDefaults}
                />
            </Box>
        </GenAiTaskLayout>
    );
}
