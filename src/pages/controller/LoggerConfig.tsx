import React, { useEffect, useState } from "react";
import CircularProgress from '@mui/material/CircularProgress';
import Cookies from 'universal-cookie';
import { makeStyles } from '@mui/styles';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Button from '@mui/material/Button';

const useStyles = makeStyles({
    table: {
        minWidth: 650,
    },
});

export default function LoggerConfig(props) {
    const classes = useStyles();
    console.log(props.location.state.data);
    const node = props.location.state.data.node;
    const [loggers, setLoggers] = useState([]);
    const [error, setError] = useState();
    const [loading, setLoading] = useState(true);

    const handleLogger = () => {
        console.log(node, loggers);
        props.history.push({ pathname: '/app/form/loggerConfig', state: { data: { ...node, loggers } } });
    }

    const url = '/services/logger' + '?protocol=' + node.protocol + '&address=' + node.address + '&port=' + node.port;
    console.log(url);
    useEffect(() => {
        const cookies = new Cookies();
        const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };

        const abortController = new AbortController();
        const fetchData = async () => {
            setLoading(true);
            try {
                const response = await fetch(url, { headers, credentials: 'include', signal: abortController.signal });
                if (!response.ok) {
                    const data = await response.json();
                    console.log(data);
                    setError(data);
                    setLoading(false);
                } else {
                    const data = await response.json();
                    console.log(data);
                    setLoggers(data);
                    setLoading(false);
                }
            } catch (e) {
                if (!abortController.signal.aborted) {
                    console.log(e);
                    setLoading(false);
                }
            }
        };

        fetchData();

        return () => {
            abortController.abort();
        };
    }, []);

    console.log(loading, loggers, error);

    let wait;
    if (loading) {
        wait = <div><CircularProgress /></div>;
    } else if (loggers) {
        wait = (
            <>
            <TableContainer component={Paper}>
                <Table className={classes.table} aria-label="simple table">
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
            <Button variant="contained" color="primary" onClick={e => handleLogger()}>Update Logger Level</Button>
            </>
        )

    } else {
        wait = (
            <pre>{error}</pre>
        )
    }

    return (
        <div>
            {wait}
        </div>
    );
}
