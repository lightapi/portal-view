import React, { useState, useEffect } from 'react';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import TableContainer from '@mui/material/TableContainer';
import CircularProgress from '@mui/material/CircularProgress';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import { makeStyles } from '@mui/styles';
import { useUserState } from '../../context/UserContext';
import { useApiGet } from '../../hooks/useApiGet';

const useRowStyles = makeStyles({
    root: {
        '& > *': {
            borderBottom: 'unset',
        },
    },
});

function Row(props) {
    const { history, file, service } = props;
    const classes = useRowStyles();

    const handleUpdate = () => {
        const combined = {...file, ...service};
        props.history.push({ pathname: '/app/form/updateConfigServiceProperty', state: { data: combined } });
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete the service file?')) {
            history.push({
                pathname: '/app/config/deleteServiceFile',
                state: { data: { file, service } },
            });
        }
    };
    let updateButton;
    if(file.source === 'custom') {
        updateButton = <SystemUpdateIcon onClick={handleUpdate} />;
    } else {
        updateButton = <div></div>;
    }

    let deleteButton;
    if(file.source === 'custom') {
        deleteButton = <DeleteForeverIcon onClick={handleDelete} />
    } else {
        deleteButton = <div></div>;
    }

    return (
        <TableRow className={classes.root}>
            <TableCell align="left">{file.sid}</TableCell>
            <TableCell align="left">{file.name}</TableCell>
            <TableCell align="left">{file.source}</TableCell>
            <TableCell align="right">
                {viewButton}
            </TableCell>
            <TableCell align="right">
                {downloadButton}
            </TableCell>
            <TableCell align="right">
                {updateButton}
            </TableCell>
            <TableCell align="right">
                {deleteButton}
            </TableCell>
        </TableRow>
    );
}

function ServiceFilesList(props) {
    const { history, files } = props;
    console.log(props);
    const service = props.location.state.data;
    return (
        <TableContainer component={Paper}>
            <Table aria-label="collapsible table">
                <TableBody>
                    <TableRow>
                        <TableCell align="left">Host</TableCell>
                        <TableCell align="right">{service.host}</TableCell>
                        <TableCell align="left">Module</TableCell>
                        <TableCell align="right">{service.module}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left">Project</TableCell>
                        <TableCell align="right">{service.project}</TableCell>
                        <TableCell align="left">Project Version</TableCell>
                        <TableCell align="right">{service.projver}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left">Service</TableCell>
                        <TableCell align="right">{service.service}</TableCell>
                        <TableCell align="left">Service Version</TableCell>
                        <TableCell align="right">{service.servver}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left">Environment</TableCell>
                        <TableCell align="right">{service.env}</TableCell>
                        <TableCell align="left">Sid</TableCell>
                        <TableCell align="right">{service.sid}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <Table aria-label="collapsible table">
                <TableHead>
                    <TableRow>
                        <TableCell align="left">Sid</TableCell>
                        <TableCell align="left">Name</TableCell>
                        <TableCell align="left">Source</TableCell>
                        <TableCell align="right">View</TableCell>
                        <TableCell align="right">Download</TableCell>
                        <TableCell align="right">Update</TableCell>
                        <TableCell align="right">Delete</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {files.map((file, index) => (
                        <Row
                            history={history}
                            key={index}
                            file={file}
                            service={service}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}


export default function ServiceFiles(props) {
    console.log(props);
    let service = props.location.state.data;

    const url = '/config-server/configs/service/file?sid=' + service.sid;
    console.log(url);
    const headers = {};
    const { isLoading, data } = useApiGet({url, headers});
  
    const handleCreate = () => {
        props.history.push({ pathname: '/app/config/uploadFile', state: { data: { ...service } } });
    };

    let wait;
    if(isLoading) {
      wait = <div><CircularProgress/></div>;
    } else {
      const combinedProps = {...props, files: data};
      wait = (
        <div>
          <ServiceFilesList {...combinedProps} />
          <AddBoxIcon onClick={() => handleCreate()} />
        </div>
      )    
    }

    return (
        <div className="App">
          {wait}
        </div>
    );
}
