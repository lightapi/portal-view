import React, { useEffect, useState, useCallback } from 'react';
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
import RefreshIcon from '@mui/icons-material/Refresh';
import fetchClient from '../../utils/fetchClient';
import { apiPost } from '../../api/apiPost';
import { loadErrorMessage } from '../../utils/loadErrorMessage';

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
    failureCode?: string;
    expectedProjectionVersion?: number;
    observedProjectionVersion?: number;
};

type PromotionDetailType = {
    promotionId: string;
    sourceHostId: string;
    sourceHostName?: string;
    targetHostId: string;
    targetHostName?: string;
    entityType: string;
    promotionStatus: string;
    projectionStatus?: string;
    projectionCheckedTs?: string;
    projectionCompletedTs?: string;
    failureCode?: string;
    failureMessage?: string;
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

function getActionConfig(action: string) {
    return (actionConfig as Record<string, { icon: React.ReactElement; color: 'success' | 'warning' | 'error' | 'default'; label: string }>)[action] || { icon: <ErrorIcon />, color: 'error' as const, label: 'Error' };
}

const statusConfig: Record<string, { icon: React.ReactElement; color: 'success' | 'error' | 'warning' | 'info' }> = {
    APPEND_ACCEPTED: { icon: <CheckCircleIcon />, color: 'success' },
    PROJECTION_PENDING: { icon: <CircularProgress size={16} />, color: 'info' },
    COMPLETED: { icon: <CheckCircleIcon />, color: 'success' },
    TIMED_OUT: { icon: <ErrorIcon />, color: 'warning' },
    FAILED: { icon: <ErrorIcon />, color: 'error' },
    PENDING: { icon: <CircularProgress size={16} />, color: 'info' },
    NOOP: { icon: <CheckCircleIcon />, color: 'success' },
    SKIPPED: { icon: <SkipNextIcon />, color: 'info' },
};

export default function PromotionDiffView() {
    const navigate = useNavigate();
    const location = useLocation();
    const promotionData = location.state?.data;

    const [detail, setDetail] = useState<PromotionDetailType | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [recoveryError, setRecoveryError] = useState<string | null>(null);
    const [recoveryMessage, setRecoveryMessage] = useState<string | null>(null);
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
            setRecoveryError(loadErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    }, [promotionData?.promotionId]);

    useEffect(() => {
        fetchDetail();
    }, [fetchDetail]);

    const recover = useCallback(async (recoveryAction: 'RECHECK' | 'RECONCILE' | 'REPLAN') => {
        if (!promotionData?.promotionId) return;
        setIsLoading(true);
        setRecoveryError(null);
        setRecoveryMessage(null);
        const cmd = {
            host: 'lightapi.net', service: 'user', action: 'promotionRecovery', version: '0.1.0',
            data: { promotionId: promotionData.promotionId, recoveryAction },
        };
        const result = await apiPost({ url: '/portal/command', headers: {}, body: cmd });
        if (result.error) {
            setRecoveryError(loadErrorMessage(result.error));
        } else {
            const payload = result.data as Record<string, unknown>;
            if (payload && (payload.statusCode || payload.code)
                && !payload.promotionStatus && !payload.projectionStatus) {
                setRecoveryError(String(payload.message || payload.description || payload.code));
            } else if (recoveryAction === 'REPLAN' && payload?.promotionId) {
                setRecoveryMessage(`New plan ${payload.promotionId} created. No events were appended.`);
            } else {
                setRecoveryMessage(String(payload?.recoveryGuidance ||
                    `Projection status: ${payload?.projectionStatus || 'unknown'}. No events were appended.`));
            }
            await fetchDetail();
        }
        setIsLoading(false);
    }, [fetchDetail, promotionData?.promotionId]);

    useEffect(() => {
        if (detail?.projectionStatus !== 'PENDING') return;
        const timer = window.setInterval(() => recover('RECHECK'), 5000);
        return () => window.clearInterval(timer);
    }, [detail?.projectionStatus, recover]);

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

    const displayData = detail || promotionData;

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
                <Button startIcon={<RefreshIcon />} onClick={() => recover('RECHECK')} disabled={isLoading}>
                    Recheck
                </Button>
                <Button onClick={() => recover('RECONCILE')} disabled={isLoading}>
                    Reconcile
                </Button>
                <Button onClick={() => recover('REPLAN')} disabled={isLoading}>
                    Create New Plan
                </Button>
            </Box>

            {recoveryError && <Alert severity="error" sx={{ mb: 2 }}>{recoveryError}</Alert>}
            {recoveryMessage && <Alert severity="info" sx={{ mb: 2 }}>{recoveryMessage}</Alert>}
            {displayData.failureMessage && (
                <Alert severity="error" sx={{ mb: 2 }}>
                    {displayData.failureCode ? `${displayData.failureCode}: ` : ''}{displayData.failureMessage}
                </Alert>
            )}

            {/* Promotion Metadata */}
            <Paper sx={{ p: 3, mb: 3 }}>
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 2 }}>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Promotion ID</Typography>
                        <Typography variant="body2" sx={{ fontFamily: 'monospace' }}>{displayData.promotionId}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Source Host</Typography>
                        <Typography variant="body2">{displayData.sourceHostName || displayData.sourceHostId}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Target Host</Typography>
                        <Typography variant="body2">{displayData.targetHostName || displayData.targetHostId}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Entity Type</Typography>
                        <Typography variant="body2">{displayData.entityType}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Status</Typography>
                        <Chip label={displayData.promotionStatus} size="small" />
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Projection</Typography>
                        <Typography variant="body2">{displayData.projectionStatus || 'NOT_STARTED'}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Created By</Typography>
                        <Typography variant="body2">{displayData.createdBy}</Typography>
                    </Box>
                    <Box>
                        <Typography variant="caption" color="text.secondary">Timestamp</Typography>
                        <Typography variant="body2">{displayData.updateTs ? new Date(displayData.updateTs).toLocaleString() : ''}</Typography>
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
                                    const config = getActionConfig(item.action);
                                    const rowKey = item.itemId;
                                    const hasDiff = item.diffSummary && Object.keys(item.diffSummary).length > 0;
                                    const execStatus = statusConfig[item.executionStatus];

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
                                                    <Chip icon={config.icon} label={config.label} color={config.color} size="small" />
                                                </TableCell>
                                                <TableCell>
                                                    {execStatus && (
                                                        <Chip icon={execStatus.icon} label={item.executionStatus} color={execStatus.color} size="small" />
                                                    )}
                                                    {item.errorMessage && (
                                                        <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                                                            {item.failureCode ? `${item.failureCode}: ` : ''}{item.errorMessage}
                                                        </Typography>
                                                    )}
                                                    {item.expectedProjectionVersion !== undefined && (
                                                        <Typography variant="caption" sx={{ display: 'block' }}>
                                                            projection version {item.observedProjectionVersion ?? 'pending'} / {item.expectedProjectionVersion}
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
                                                                            <TableCell>Current Target</TableCell>
                                                                            <TableCell>Desired Source</TableCell>
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
                                        </React.Fragment>
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
