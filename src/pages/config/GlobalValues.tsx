import React, { useState, useEffect } from 'react';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import TableContainer from '@mui/material/TableContainer';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { makeStyles } from '@mui/styles';
import { useUserState } from '../../contexts/UserContext';

const useRowStyles = makeStyles({
    root: {
        '& > *': {
            borderBottom: 'unset',
        },
    },
});

function Row(props) {
    const { history, host, global } = props;
    const classes = useRowStyles();

    const handleUpdate = () => {
        props.history.push({ pathname: '/app/form/updateGlobalValue', state: { data: global } });
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete the global value?')) {
            history.push({
                pathname: '/app/config/globalValueDelete',
                state: { data: { global } },
            });
        }
    };

    return (
        <TableRow className={classes.root}>
            <TableCell align="left">{global.host}</TableCell>
            <TableCell align="left">{global.module}</TableCell>
            <TableCell align="left">{global.project}</TableCell>
            <TableCell align="left">{global.projver}</TableCell>
            <TableCell align="left">{global.env}</TableCell>
            <TableCell align="left">{global.key}</TableCell>
            <TableCell align="left">{global.value}</TableCell>
            <TableCell align="right">
                <SystemUpdateIcon onClick={handleUpdate} />
            </TableCell>
            <TableCell align="right">
                <DeleteForeverIcon onClick={handleDelete} />
            </TableCell>
        </TableRow>
    );
}

function GlobalsList(props) {
    const { history } = props;
    let globals = props.location.state.data;
    console.log(globals);
    return (
        <TableContainer component={Paper}>
            <Table aria-label="collapsible table">
                <TableHead>
                    <TableRow>
                        <TableCell align="left">Host</TableCell>
                        <TableCell align="left">Module</TableCell>
                        <TableCell align="left">Project</TableCell>
                        <TableCell align="left">Project Version</TableCell>
                        <TableCell align="left">Environment</TableCell>
                        <TableCell align="left">Key</TableCell>
                        <TableCell align="left">Value</TableCell>
                        <TableCell align="right">Update</TableCell>
                        <TableCell align="right">Delete</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {globals.map((global, index) => (
                        <Row
                            history={history}
                            key={index}
                            global={global}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}


export default function GlobalValues(props) {
    console.log(props);
    let globals = props.location.state.data;
    const { host } = useUserState();

    const handleCreate = () => {
        props.history.push({ pathname: '/app/form/createGlobalValue', state: { data: { host } } });
    };

    return <div><GlobalsList {...props} /><AddBoxIcon onClick={() => handleCreate()} /></div>
}
