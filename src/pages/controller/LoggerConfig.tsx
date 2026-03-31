import React, { useEffect, useState, ReactNode, useMemo } from "react";
import CircularProgress from '@mui/material/CircularProgress';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import { useLocation, useNavigate } from "react-router-dom";
import { useController } from "../../contexts/ControllerContext";

interface Logger {
    name: string;
    level: string;
}

const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'OFF'];

export default function LoggerConfig() {
    const navigate = useNavigate();
    const location = useLocation();
    const { runtimeInstanceId } = (location.state as any)?.data?.node || {};
    const { callTool } = useController();

    const [loggers, setLoggers] = useState<Logger[]>([]);
    const [filter, setFilter] = useState('');
    const [pendingLoggers, setPendingLoggers] = useState<Record<string, string>>({});
    const [error, setError] = useState<any>();
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(false);

    const fetchData = async () => {
        if (!runtimeInstanceId) {
            setLoading(false);
            return;
        }
        setLoading(true);
        try {
            const result = await callTool('get_loggers', { runtimeInstanceId });
            setLoggers(result);
            setPendingLoggers({});
        } catch (err) {
            console.error(err);
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [runtimeInstanceId]);

    const handleLevelChange = (name: string, level: string) => {
        setPendingLoggers(prev => ({ ...prev, [name]: level }));
    };

    const handleApply = async () => {
        if (!runtimeInstanceId) return;
        const updates = Object.entries(pendingLoggers).map(([name, level]) => ({ name, level }));
        if (updates.length === 0) return;

        setUpdating(true);
        try {
            await callTool('set_loggers', { runtimeInstanceId, loggers: updates });
            // Refresh
            await fetchData();
        } catch (err) {
            setError(err);
        } finally {
            setUpdating(false);
        }
    };

    const filteredLoggers = useMemo(() => {
        return loggers.filter(l => l.name.toLowerCase().includes(filter.toLowerCase()));
    }, [loggers, filter]);

    let content: ReactNode;
    if (loading) {
        content = <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;
    } else if (!runtimeInstanceId) {
        content = (
            <Box sx={{ p: 3 }}>
                <Typography color="error">No runtime instance ID found. Please navigate from the Control Pane.</Typography>
                <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate(-1)}>Go Back</Button>
            </Box>
        );
    } else if (loggers && loggers.length > 0) {
        content = (
            <Box sx={{ p: 2 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Typography variant="h5">Logger Configuration</Typography>
                    <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                        <TextField 
                            label="Filter Loggers" 
                            size="small" 
                            value={filter} 
                            onChange={(e) => setFilter(e.target.value)} 
                        />
                        <Button 
                            variant="contained" 
                            color="primary" 
                            onClick={handleApply} 
                            disabled={updating || Object.keys(pendingLoggers).length === 0}
                        >
                            {updating ? <CircularProgress size={24} /> : 'Apply Changes'}
                        </Button>
                    </Box>
                </Box>
                <TableContainer component={Paper}>
                    <Table sx={{ minWidth: 650 }} size="small">
                        <TableHead>
                            <TableRow>
                                <TableCell>Logger Name</TableCell>
                                <TableCell align="right">Level</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {filteredLoggers.map((logger) => (
                                <TableRow key={logger.name}>
                                    <TableCell component="th" scope="row">
                                        {logger.name}
                                    </TableCell>
                                    <TableCell align="right">
                                        <Select
                                            value={pendingLoggers[logger.name] || logger.level}
                                            onChange={(e) => handleLevelChange(logger.name, e.target.value)}
                                            size="small"
                                            sx={{ minWidth: 120 }}
                                        >
                                            {LOG_LEVELS.map(level => (
                                                <MenuItem key={level} value={level}>{level}</MenuItem>
                                            ))}
                                        </Select>
                                    </TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
            </Box>
        )
    } else if (error) {
        content = (
            <Box sx={{ p: 3 }}>
                <Typography color="error" gutterBottom>Failed to load or update loggers:</Typography>
                <pre>{JSON.stringify(error, null, 2)}</pre>
                <Button variant="outlined" sx={{ mt: 2 }} onClick={fetchData}>Retry</Button>
            </Box>
        )
    } else {
        content = (
            <Box sx={{ p: 3 }}>
                <Typography gutterBottom>No loggers found for this node.</Typography>
                <Button variant="contained" onClick={() => navigate(-1)}>Go Back</Button>
            </Box>
        );
    }

    return (
        <Box sx={{ width: '100%' }}>
            {content}
        </Box>
    );
}
