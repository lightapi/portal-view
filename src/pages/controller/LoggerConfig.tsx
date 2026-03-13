import React, { useEffect, useState, ReactNode } from "react";
import CircularProgress from '@mui/material/CircularProgress';
import fetchClient from '../../utils/fetchClient';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import { useLocation, useNavigate } from "react-router-dom";

interface Logger {
    name: string;
    level: string;
}

interface NodeData {
    protocol: string;
    address: string;
    port: number;
    apiName?: string;
}

export default function LoggerConfig() {
    const navigate = useNavigate();
    const location = useLocation();
    const data = (location.state as any)?.data;
    const node: NodeData = data?.node;

    const [loggers, setLoggers] = useState<Logger[]>([]);
    const [error, setError] = useState<any>();
    const [loading, setLoading] = useState(true);

    const handleLogger = () => {
        navigate('/app/form/loggerConfig', { state: { data: { ...node, loggers } } });
    }

    useEffect(() => {
        if (!node) return;
        const url = `/services/logger?protocol=${node.protocol}&address=${node.address}&port=${node.port}`;
        const fetchData = async () => {
            setLoading(true);
            try {
                const data = await fetchClient(url);
                setLoggers(data);
                setLoading(false);
            } catch (error) {
                console.log(error);
                setError(error);
                setLoading(false);
            }
        };

        fetchData();
    }, [node]);

    let content: ReactNode;
    if (loading) {
        content = <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}><CircularProgress /></Box>;
    } else if (loggers && loggers.length > 0) {
        content = (
            <Box>
                <TableContainer component={Paper} sx={{ mb: 2 }}>
                    <Table sx={{ minWidth: 650 }} aria-label="simple table">
                        <TableHead>
                            <TableRow>
                                <TableCell>Name</TableCell>
                                <TableCell align="right">Level</TableCell>
                            </TableRow>
                        </TableHead>
                        <TableBody>
                            {loggers.map((logger) => (
                                <TableRow key={logger.name}>
                                    <TableCell component="th" scope="row">
                                        {logger.name}
                                    </TableCell>
                                    <TableCell align="right">{logger.level}</TableCell>
                                </TableRow>
                            ))}
                        </TableBody>
                    </Table>
                </TableContainer>
                <Button variant="contained" color="primary" onClick={handleLogger}>Update Logger Level</Button>
            </Box>
        )
    } else {
        content = (
            <Box sx={{ p: 3 }}>
                <pre>{JSON.stringify(error, null, 2)}</pre>
            </Box>
        )
    }

    return (
        <Box className="App">
            {content}
        </Box>
    );
}
