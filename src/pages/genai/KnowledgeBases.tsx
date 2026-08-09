import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent,
    DialogTitle, FormControl, InputLabel, MenuItem, Select, Stack,
    TextField, Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import RefreshIcon from '@mui/icons-material/Refresh';
import { MaterialReactTable, type MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { useUserState } from '../../contexts/UserContext';
import { KnowledgeBaseRow, knowledgeCommand, knowledgeError, knowledgeQuery } from './knowledgeApi';

type UserState = { host?: string };

export default function KnowledgeBases() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const initialEnvironment = new URLSearchParams(location.search).get('environment') || 'dev';
    const [environment, setEnvironment] = useState(initialEnvironment);
    const [rows, setRows] = useState<KnowledgeBaseRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState('');
    const [createOpen, setCreateOpen] = useState(false);
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');

    const load = useCallback(async () => {
        if (!host) return;
        setLoading(true);
        setMessage('');
        try {
            const response = await knowledgeQuery<{ knowledgeBases?: KnowledgeBaseRow[] }>(
                'getKnowledgeBases', { hostId: host, environment },
            );
            setRows(Array.isArray(response.knowledgeBases) ? response.knowledgeBases : []);
        } catch (error) {
            setMessage(knowledgeError(error));
        } finally {
            setLoading(false);
        }
    }, [environment, host]);

    useEffect(() => { void load(); }, [load]);

    const create = useCallback(async () => {
        if (!host || !name.trim()) return;
        setMessage('');
        try {
            await knowledgeCommand('createKnowledgeBase', {
                scope: 'TENANT', environment, name: name.trim(), description: description.trim(),
                status: 'DRAFT', retentionPolicy: {},
            });
            setCreateOpen(false);
            setName('');
            setDescription('');
            await load();
        } catch (error) {
            setMessage(knowledgeError(error));
        }
    }, [description, environment, host, load, name]);

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
                <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreateOpen(true)}>Create tenant KB</Button>
            </Stack>
        </Stack>
        {message && <Alert severity="error" sx={{ mb: 2 }}>{message}</Alert>}
        {!host && <Alert severity="warning" sx={{ mb: 2 }}>Select a tenant host before administering Knowledge Bases.</Alert>}
        <MaterialReactTable table={table} />
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="sm">
            <DialogTitle>Create tenant Knowledge Base</DialogTitle>
            <DialogContent><Stack spacing={2} sx={{ mt: 1 }}>
                <TextField required label="Name" value={name} onChange={event => setName(event.target.value)} />
                <TextField label="Description" multiline minRows={3} value={description} onChange={event => setDescription(event.target.value)} />
                <Alert severity="info">The new Knowledge Base remains DRAFT with no active generation until a bounded source build is evaluated and promoted.</Alert>
            </Stack></DialogContent>
            <DialogActions><Button onClick={() => setCreateOpen(false)}>Cancel</Button><Button variant="contained" disabled={!name.trim()} onClick={() => void create()}>Create</Button></DialogActions>
        </Dialog>
    </Box>;
}

