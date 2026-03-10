import { useEffect, useState, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Box,
    Button,
    Typography,
    Paper,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TableRow,
    Collapse,
    IconButton,
    Chip,
    CircularProgress,
    Alert,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import ChangeCircleIcon from '@mui/icons-material/ChangeCircle';
import RemoveCircleIcon from '@mui/icons-material/RemoveCircle';
import SkipNextIcon from '@mui/icons-material/SkipNext';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import fetchClient from '../../utils/fetchClient';

// --- Type Definitions ---
type PromotionItemType = {
    itemId: string;
    entityType: string;
    entityId: string;
    entityName?: string;
    action: 'CREATE' | 'UPDATE' | 'DELETE' | 'NOOP';
    sourceSnapshot?: object;
    targetSnapshot?: object;
    diffSummary?: Record<string, { from: string; to: string }>;
    executionStatus: string;
    errorMessage?: string;
};

type PromotionDetailType = {
    promotionId: string;
    sourceHostId: string;
    sourceHostName?: string;
    targetHostId: string;
    targetHostName?: string;
    entityType: string;
    promotionStatus: string;
    createdBy: string;
    updateTs: string;
    items: PromotionItemType[];
};

const actionConfig = {
    CREATE: { icon: <AddCircleIcon />, color: 'success' as const, label: 'New' },
    UPDATE: { icon: <ChangeCircleIcon />, color: 'warning' as const, label: 'Changed' },
    DELETE: { icon: <RemoveCircleIcon />, color: 'error' as const, label: 'Orphaned' },
    NOOP: { icon: <SkipNextIcon />, color: 'default' as const, label: 'Same' },
};

const statusConfig: Record<string, { icon: React.ReactElement; color: 'success' | 'error' | 'warning' | 'info' }> = {
    Success: { icon: <CheckCircleIcon />, color: 'success' },
    Failed: { icon: <ErrorIcon />, color: 'error' },
    Pending: { icon: <CircularProgress size={16} />, color: 'info' },
};

export default function PromotionDiffView() {
    const navigate = useNavigate();
    const location = useLocation();
    const promotionData = location.state?.data;

    const [detail, setDetail] = useState<PromotionDetailType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    // Fetch promotion details
    const fetchDetail = useCallback(async () => {
        if (!promotionData?.promotionId) return;
        setIsLoading(true);
        try {
            const cmd = {
                host: 'lightapi.net', service: 'user', action: 'getPromotionDetail', version: '0.1.0',
                data: { promotionId: promotionData.promotionId },
            };
            const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
            const json = await fetchClient(url) as PromotionDetailType;
            setDetail(json);
        } catch (error) {
            console.error('Failed to load promotion detail:', error);
        } finally {
            setIsLoading(false);
        }
    }, [promotionData?.promotionId]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const toggleRow = (key: string) => {
        setExpandedRows(prev => ({ ...prev, [key]: !prev[key] }));
    };

    if (!promotionData) {
        return (
            <Box sx={{ p: 2 }}>
                <Alert severity="warning">No promotion data provided. Please navigate from the History page.</Alert>
                <Button sx={{ mt: 2 }} variant="contained" onClick={() => navigate('/app/promotion/history')}>
                    Go to History
                </Button>
            </Box>
        );
    }

    return (
        <Box sx={{ p: 2 }}>
            {/* Header */}
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 3 }}>
                <Button
                    variant="outlined"
                    startIcon={<ArrowBackIcon />}
                    onClick={() => navigate('/app/promotion/history')}
                >
                    Back to History
                </Button>
                <Typography variant="h5" sx={{ fontWeight: 'bold' }}>
                    Promotion Details
                </Typography>
            </Box>

            {/* Promotion Metadata */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Promotion ID</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{promotionData.promotionId}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Source Host</Typography>
                        <Typography variant="body2">{promotionData.sourceHostName || promotionData.sourceHostId}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Target Host</Typography>
                        <Typography variant="body2">{promotionData.targetHostName || promotionData.targetHostId}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Entity Type</Typography>
                        <Typography variant="body2">{promotionData.entityType}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Status</Typography>
                        <Chip label={promotionData.promotionStatus} size="small" />
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Created By</Typography>
                        <Typography variant="body2">{promotionData.createdBy}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                        <Typography variant="body2">{promotionData.updateTs ? new Date(promotionData.updateTs).toLocaleString() : ''}</Typography>
                    </Box>
                </Box>
            </Paper>

            {/* Diff Items */}
            {isLoading ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                </Box>
            ) : detail?.items ? (
                <Paper sx={{ p: 2 }}>
                    <Typography variant="h6" gutterBottom>Promotion Items ({detail.items.length})</Typography>
                    <TableContainer>
                        <Table size="small">
                            <TableHead>
                                <TableRow>
                                    <TableCell width={40} />
                                    <TableCell>Entity Type</TableCell>
                                    <TableCell>Entity ID</TableCell>
                                    <TableCell>Action</TableCell>
                                    <TableCell>Execution Status</TableCell>
                                </TableRow>
                            </TableHead>
                            <TableBody>
                                {detail.items.map((item) => {
                                    const config = actionConfig[item.action];
                                    const rowKey = item.itemId;
                                    const hasDiff = item.diffSummary && Object.keys(item.diffSummary).length > 0;
                                    const execStatus = statusConfig[item.executionStatus];

                                    return (
                                        <>
                                            <TableRow key={rowKey} hover>
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
                                                    <Chip icon={config.icon} label={config.label} color={config.color} size="small" />
                                                </TableCell>
                                                <TableCell>
                                                    {execStatus && (
                                                        <Chip icon={execStatus.icon} label={item.executionStatus} color={execStatus.color} size="small" />
                                                    )}
                                                    {item.errorMessage && (
                                                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                                            {item.errorMessage}
                                                        </Typography>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                            {hasDiff && (
                                                <TableRow>
                                                    <TableCell colSpan={5} sx={{ pb: 0, pt: 0 }}>
                                                        <Collapse in={expandedRows[rowKey]} timeout="auto" unmountOnExit>
                                                            <Box sx={{ m: 1 }}>
                                                                <Table size="small">
                                                                    <TableHead>
                                                                        <TableRow>
                                                                            <TableCell>Field</TableCell>
                                                                            <TableCell>Source Value</TableCell>
                                                                            <TableCell>Target Value</TableCell>
                                                                        </TableRow>
                                                                    </TableHead>
                                                                    <TableBody>
                                                                        {Object.entries(item.diffSummary!).map(([field, values]) => (
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
                                        </>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </TableContainer>
                </Paper>
            ) : (
                <Alert severity="info">No detail data available yet. The backend service may not be implemented.</Alert>
            )}
        </Box>
    );
}
