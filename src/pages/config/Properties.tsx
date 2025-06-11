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
    const { history, host, property } = props;
    const classes = useRowStyles();
  
  
    const handleUpdate = () => {
      props.history.push({pathname: '/app/form/updateConfigProperty', state: { data: property}});
    };
  
    const handleDelete = () => {
      if (window.confirm('Are you sure you want to delete the property?')) {
        history.push({
          pathname: '/app/config/deleteProperty',
          state: { data: { property } },
        });
      }
    };
  
    return (
      <TableRow className={classes.root}>
        <TableCell align="left">{property.host}</TableCell>
        <TableCell align="left">{property.cap}</TableCell>
        <TableCell align="left">{property.project}</TableCell>
        <TableCell align="left">{property.projver}</TableCell>
        <TableCell align="left">{property.scope}</TableCell>
        <TableCell align="left">{property.key}</TableCell>
        <TableCell align="left">{property.module}</TableCell>
        <TableCell align="left">{property.type}</TableCell>
        <TableCell align="left">{property.order}</TableCell>
        <TableCell align="right">
          <SystemUpdateIcon onClick={handleUpdate} />
        </TableCell>
        <TableCell align="right">
          <DeleteForeverIcon onClick={handleDelete} />
        </TableCell>
      </TableRow>
    );
  }
  
function PropertiesList(props) {
    const { history } = props;
    let properties = props.location.state.data;
    console.log(properties);
    return (
        <TableContainer component={Paper}>
          <Table aria-label="collapsible table">
            <TableHead>
              <TableRow>
                <TableCell align="left">Host</TableCell>
                <TableCell align="left">Capability</TableCell>
                <TableCell align="left">Project</TableCell>
                <TableCell align="left">Project Version</TableCell>
                <TableCell align="left">Scope</TableCell>
                <TableCell align="left">Key</TableCell>
                <TableCell align="left">Module</TableCell>
                <TableCell align="left">Value Type</TableCell>
                <TableCell align="left">Order</TableCell>
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
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
    );
  }
  

export default function Properties(props) {
    console.log(props);
    let properties = props.location.state.data;
    const { host } = useUserState();

    const handleCreate = () => {
        props.history.push({pathname: '/app/form/createConfigProperty', state: { data: { host }}});
    };

    return <div><PropertiesList {...props} /><AddBoxIcon onClick={() => handleCreate()} /></div>
    
  }
