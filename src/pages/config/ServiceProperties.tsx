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
import { useUserState } from '../../contexts/UserContext';
import { useApiGet } from '../../hooks/useApiGet';

const useRowStyles = makeStyles({
    root: {
        '& > *': {
            borderBottom: 'unset',
        },
    },
});

function Row(props) {
    const { history, property, service } = props;
    const classes = useRowStyles();

    const handleUpdate = () => {
        const combined = {...property, ...service};
        props.history.push({ pathname: '/app/form/updateConfigServiceProperty', state: { data: combined } });
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete the service property?')) {
            history.push({
                pathname: '/app/config/deleteServiceProperty',
                state: { data: { property, service } },
            });
        }
    };
    let updateButton;
    if(property.source === 'custom') {
        updateButton = <SystemUpdateIcon onClick={handleUpdate} />;
    } else {
        updateButton = <div></div>;
    }

    let deleteButton;
    if(property.source === 'custom') {
        deleteButton = <DeleteForeverIcon onClick={handleDelete} />
    } else {
        deleteButton = <div></div>;
    }

    return (
        <TableRow className={classes.root}>
            <TableCell align="left">{property.sid}</TableCell>
            <TableCell align="left">{property.key}</TableCell>
            <TableCell align="left">{property.value !== undefined ? property.value : ''}</TableCell>
            <TableCell align="left">{property.order}</TableCell>
            <TableCell align="left">{property.scope}</TableCell>
            <TableCell align="left">{property.source}</TableCell>
            <TableCell align="right">
                {updateButton}
            </TableCell>
            <TableCell align="right">
                {deleteButton}
            </TableCell>
        </TableRow>
    );
}

function ServicePropertiesList(props) {
    const { history, properties } = props;
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
                        <TableCell align="left">Key</TableCell>
                        <TableCell align="left">Value</TableCell>
                        <TableCell align="left">Order</TableCell>
                        <TableCell align="left">Scope</TableCell>
                        <TableCell align="left">Source</TableCell>
                        <TableCell align="right">Update</TableCell>
                        <TableCell align="right">Delete</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {properties.map((property, index) => (
                        <Row
                            history={history}
                            key={index}
                            property={property}
                            service={service}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}


export default function ServiceProperties(props) {
    console.log(props);
    let service = props.location.state.data;
    const { host } = useUserState();

    const url = '/config-server/configs/service/property?sid=' + service.sid;
    console.log(url);
    const headers = {};
    const { isLoading, data } = useApiGet({url, headers});
  
    const handleCreate = () => {
        props.history.push({ pathname: '/app/form/createConfigServiceProperty', state: { data: { ...service } } });
    };

    let wait;
    if(isLoading) {
      wait = <div><CircularProgress/></div>;
    } else {
      const combinedProps = {...props, properties: data};
      wait = (
        <div>
          <ServicePropertiesList {...combinedProps} />
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
