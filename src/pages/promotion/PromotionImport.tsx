import React, { useState, useCallback, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Typography,
    Paper,
    Alert,
    CircularProgress,
    FormControl,
    InputLabel,
    MenuItem,
    Select,
    Chip,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Collapse,
    IconButton,
    FormControlLabel,
    Radio,
    RadioGroup,
    FormLabel,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import PreviewIcon from '@mui/icons-material/Preview';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import ReportProblemIcon from '@mui/icons-material/ReportProblem';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type HostType = {
    hostId: string;
    domain: string;
    subDomain: string;
};

type DiffItem = {
    entityType: string;
    entityId: string;
    entityName?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'NOOP';
    diff?: Record<string, { from: string; to: string }>;
};

type DiffPlan = {
    promotionId?: string;
    summary: { create: number; update: number; noop: number; orphan: number };
    items: DiffItem[];
};

const actionConfig = {
    CREATE: { icon: <AddCircleIcon />, color: 'success' as const, label: 'New' },
    UPDATE: { icon: <ChangeCircleIcon />, color: 'warning' as const, label: 'Changed' },
    DELETE: { icon: <RemoveCircleIcon />, color: 'error' as const, label: 'Orphaned' },
    NOOP: { icon: <SkipNextIcon />, color: 'default' as const, label: 'Same' },
    ERROR: { icon: <ReportProblemIcon />, color: 'error' as const, label: 'Error' },
};

export default function PromotionImport() {
    const navigate = useNavigate();
    const location = useLocation();

    // State from navigation (from export page)
    const navSnapshot = location.state?.snapshot;
    const navTargetHostId = location.state?.targetHostId;
    const fromExport = location.state?.fromExport;

    const [snapshot, setSnapshot] = useState<object | null>(navSnapshot || null);
    const [targetHostId, setTargetHostId] = useState(navTargetHostId || '');
    const [hosts, setHosts] = useState<HostType[]>([]);
    const [isLoadingHosts, setIsLoadingHosts] = useState(false);

    // Dry run
    const [isDryRunning, setIsDryRunning] = useState(false);
    const [diffPlan, setDiffPlan] = useState<DiffPlan | null>(null);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    // Execute
    const [orphanAction, setOrphanAction] = useState('keep');
    const [isExecuting, setIsExecuting] = useState(false);
    const [executeResult, setExecuteResult] = useState<{ success: boolean; message: string } | null>(null);

    // Load hosts
    useEffect(() => {
        const loadHosts = async () => {
            setIsLoadingHosts(true);
            try {
                const cmd = {
                    host: 'lightapi.net', service: 'host', action: 'getHost', version: '0.1.0',
                    data: { offset: 0, limit: 100, active: true },
                };
                const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
                const json = await fetchClient(url) as { hosts: HostType[]; total: number };
                setHosts(json.hosts || []);
            } catch (error) {
                console.error('Failed to load hosts:', error);
            } finally {
                setIsLoadingHosts(false);
            }
        };
        loadHosts();
    }, []);

    // File upload handler
    const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const json = JSON.parse(e.target?.result as string);
                setSnapshot(json);
            } catch (error) {
                alert('Invalid JSON file. Please upload a valid promotion export file.');
            }
        };
        reader.readAsText(file);
    }, []);

    // Dry run handler
    const handleDryRun = useCallback(async () => {
        if (!snapshot || !targetHostId) return;

        setIsDryRunning(true);
        setDiffPlan(null);
        try {
            const cmd = {
                host: 'lightapi.net', service: 'user', action: 'importDryRun', version: '0.1.0',
                data: { targetHostId, snapshot },
            };
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                alert('Dry run failed: ' + JSON.stringify(result.error));
            } else {
                setDiffPlan(result as unknown as DiffPlan);
            }
        } catch (error) {
            console.error('Dry run failed:', error);
            alert('Dry run failed. Please check the console for details.');
        } finally {
            setIsDryRunning(false);
        }
    }, [snapshot, targetHostId]);

    // Execute promotion handler
    const handleExecute = useCallback(async () => {
        if (!snapshot || !targetHostId || !diffPlan) return;
        if (!window.confirm('Are you sure you want to execute this promotion? This will modify the target environment.')) return;

        setIsExecuting(true);
        try {
            const cmd = {
                host: 'lightapi.net', service: 'user', action: 'importExecute', version: '0.1.0',
                data: {
                    targetHostId,
                    promotionId: diffPlan.promotionId,
                    snapshot,
                    orphanAction,
                },
            };
            const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
            if (result.error) {
                setExecuteResult({ success: false, message: JSON.stringify(result.error) });
            } else {
                setExecuteResult({ success: true, message: 'Promotion executed successfully!' });
            }
        } catch (error) {
            console.error('Execute failed:', error);
            setExecuteResult({ success: false, message: 'Execution failed due to a network error.' });
        } finally {
            setIsExecuting(false);
        }
    }, [snapshot, targetHostId, diffPlan, orphanAction]);

    // Auto dry run if coming from export page
    useEffect(() => {
        if (fromExport && navSnapshot && navTargetHostId) {
            handleDryRun();
        }
    }, [fromExport, navSnapshot, navTargetHostId, handleDryRun]);

    const toggleRow = (key: string) => {
        setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
    };

    return (
        <Box sx={{ p: 2 }}>
            <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', mb: 3 }}>
                Import & Promote Entities
            </Typography>

            {/* Import Source Section */}
            {!diffPlan && !executeResult && (
                <Paper sx={{ p: 3, mb: 3 }}>
                    <Typography variant="h6" gutterBottom>Step 1: Select Import Source</Typography>

                    {!fromExport && (
                        <Box sx={{ mb: 3 }}>
                            <Typography variant="subtitle2" sx={{ mb: 1 }}>Upload a JSON export file:</Typography>
                            <Button
                                variant="outlined"
                                component="label"
                                startIcon={<CloudUploadIcon />}
                            >
                                Upload JSON File
                                <input type="file" accept=".json" hidden onChange={handleFileUpload} />
                            </Button>
                            {snapshot && (
                                <Chip label="File loaded ✓" color="success" sx={{ ml: 2 }} />
                            )}
                        </Box>
                    )}

                    {fromExport && snapshot && (
                        <Alert severity="info" sx={{ mb: 2 }}>
                            Using snapshot from the Export page. Ready for dry run.
                        </Alert>
                    )}

                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'flex-end', mb: 3 }}>
                        <FormControl sx={{ minWidth: 300 }}>
                            <InputLabel>Target Host</InputLabel>
                            <Select
                                value={targetHostId}
                                label="Target Host"
                                onChange={(e) => setTargetHostId(e.target.value)}
                            >
                                {hosts.map((h) => (
                                    <MenuItem key={h.hostId} value={h.hostId}>
                                        {h.domain} / {h.subDomain}
                                    </MenuItem>
                                ))}
                            </Select>
                        </FormControl>

                        <Button
                            variant="contained"
                            startIcon={isDryRunning ? <CircularProgress size={20} /> : <PreviewIcon />}
                            onClick={handleDryRun}
                            disabled={!snapshot || !targetHostId || isDryRunning}
                        >
                            Run Dry Run (Preview)
                        </Button>
                    </Box>
                </Paper>
            )}

            {/* Dry Run Results */}
            {diffPlan && !executeResult && (
                <Box>
                    <Paper sx={{ p: 3, mb: 3 }}>
                        <Typography variant="h6" gutterBottom>Step 2: Review Diff Plan</Typography>

                        {/* Summary Chips */}
                        {diffPlan.summary && (
                            <Box sx={{ display: 'flex', gap: 2, mb: 3 }}>
                                <Chip icon={<AddCircleIcon />} label={`${diffPlan.summary.create ?? 0} New`} color="success" />
                                <Chip icon={<ChangeCircleIcon />} label={`${diffPlan.summary.update ?? 0} Changed`} color="warning" />
                                <Chip icon={<SkipNextIcon />} label={`${diffPlan.summary.noop ?? 0} Same`} />
                                {(diffPlan.summary.orphan ?? 0) > 0 && (
                                    <Chip icon={<RemoveCircleIcon />} label={`${diffPlan.summary?.orphan ?? 0} Orphaned`} color="error" />
                                )}
                            </Box>
                        )}

                        {/* Diff Table */}
                        <TableContainer>
                            <Table size="small">
                                <TableHead>
                                    <TableRow>
                                        <TableCell width={40} />
                                        <TableCell>Entity Type</TableCell>
                                        <TableCell>Entity ID</TableCell>
                                        <TableCell>Action</TableCell>
                                    </TableRow>
                                </TableHead>
                                <TableBody>
                                    {(diffPlan.items || []).map((item, idx) => {
                                        const config = actionConfig[item.action] || actionConfig.ERROR;
                                        const rowKey = `${item.entityType}-${item.entityId}-${idx}`;
                                        const hasDiff = item.diff && Object.keys(item.diff).length > 0;

                                        return (
                                            <React.Fragment key={rowKey}>
                                                <TableRow hover>
                                                    <TableCell>
                                                        {hasDiff && (
                                                            <IconButton size="small" onClick={() => toggleRow(rowKey)}>
                                                                {expandedRows[rowKey] ? <ExpandLessIcon /> : <ExpandMoreIcon />}
                                                            </IconButton>
                                                        )}
                                                    </TableCell>
                                                    <TableCell>{item.entityType}</TableCell>
                                                    <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                                        {item.entityName || item.entityId}
                                                    </TableCell>
                                                    <TableCell>
                                                        <Chip
                                                            icon={config.icon}
                                                            label={config.label}
                                                            color={config.color}
                                                            size="small"
                                                        />
                                                    </TableCell>
                                                </TableRow>
                                                {hasDiff && (
                                                    <TableRow>
                                                        <TableCell colSpan={4} sx={{ pb: 0, pt: 0 }}>
                                                            <Collapse in={expandedRows[rowKey]} timeout="auto" unmountOnExit>
                                                                <Box sx={{ m: 1 }}>
                                                                    <Table size="small">
                                                                        <TableHead>
                                                                            <TableRow>
                                                                                <TableCell>Field</TableCell>
                                                                                <TableCell>From (Source)</TableCell>
                                                                                <TableCell>To (Target)</TableCell>
                                                                            </TableRow>
                                                                        </TableHead>
                                                                        <TableBody>
                                                                            {Object.entries(item.diff!).map(([field, values]) => (
                                                                                <TableRow key={field}>
                                                                                    <TableCell sx={{ fontWeight: 'bold' }}>{field}</TableCell>
                                                                                    <TableCell sx={{ color: 'error.main', fontFamily: 'monospace' }}>
                                                                                        {values.from}
                                                                                    </TableCell>
                                                                                    <TableCell sx={{ color: 'success.main', fontFamily: 'monospace' }}>
                                                                                        {values.to}
                                                                                    </TableCell>
                                                                                </TableRow>
                                                                            ))}
                                                                        </TableBody>
                                                                    </Table>
                                                                </Box>
                                                            </Collapse>
                                                        </TableCell>
                                                    </TableRow>
                                                )}
                                            </React.Fragment>
                                        );
                                    })}
                                </TableBody>
                            </Table>
                        </TableContainer>
                    </Paper>

                    {/* Orphan Action & Execute */}
                    <Paper sx={{ p: 3 }}>
                        <Typography variant="h6" gutterBottom>Step 3: Execute Promotion</Typography>

                        {(diffPlan.summary?.orphan ?? 0) > 0 && (
                            <Box sx={{ mb: 3 }}>
                                <FormControl>
                                    <FormLabel>Orphaned Items Action</FormLabel>
                                    <RadioGroup row value={orphanAction} onChange={(e) => setOrphanAction(e.target.value)}>
                                        <FormControlLabel value="keep" control={<Radio />} label="Keep (Safe Mode)" />
                                        <FormControlLabel value="delete" control={<Radio />} label="Delete Orphans" />
                                        <FormControlLabel value="sync" control={<Radio />} label="Strict Sync" />
                                    </RadioGroup>
                                </FormControl>
                            </Box>
                        )}

                        <Box sx={{ display: 'flex', gap: 2 }}>
                            <Button
                                variant="outlined"
                                onClick={() => { setDiffPlan(null); setExecuteResult(null); }}
                            >
                                Back to Import
                            </Button>
                            <Button
                                variant="contained"
                                color="primary"
                                startIcon={isExecuting ? <CircularProgress size={20} /> : <PlayArrowIcon />}
                                onClick={handleExecute}
                                disabled={isExecuting}
                            >
                                Execute Promotion
                            </Button>
                        </Box>
                    </Paper>
                </Box>
            )}

            {/* Execution Result */}
            {executeResult && (
                <Paper sx={{ p: 3 }}>
                    <Alert severity={executeResult.success ? 'success' : 'error'} sx={{ mb: 3 }}>
                        {executeResult.message}
                    </Alert>
                    <Box sx={{ display: 'flex', gap: 2 }}>
                        <Button variant="contained" onClick={() => navigate('/app/promotion/history')}>
                            View History
                        </Button>
                        <Button variant="outlined" onClick={() => {
                            setDiffPlan(null);
                            setExecuteResult(null);
                            setSnapshot(null);
                        }}>
                            New Import
                        </Button>
                    </Box>
                </Paper>
            )}
        </Box>
    );
}
