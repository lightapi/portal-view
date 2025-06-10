import React, { useState, useEffect } from 'react';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import UploadIcon from '@mui/icons-material/Upload';
import DownloadIcon from '@mui/icons-material/Download';
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

function base64ToArrayBuffer(base64) {
    var binary_string =  window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array( len );
    for (var i = 0; i < len; i++)        {
        bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
}

function Row(props) {
    const { history, cert, service } = props;
    const classes = useRowStyles();

    const handleUpdate = () => {
        const combined = {...cert, ...service};
        props.history.push({ pathname: '/app/form/updateConfigServiceProperty', state: { data: combined } });
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete the service cert?')) {
            history.push({
                pathname: '/app/config/serviceCertDelete',
                state: { data: { cert, service } },
            });
        }
    };

    const handleDownload = () => {
        const element = document.createElement("a");
        console.log(cert.content);
        var bytes = base64ToArrayBuffer(cert.content);
        console.log(bytes);
        const blob = new Blob([bytes], {
          type: "application/octet-stream"
        });
        element.href = URL.createObjectURL(blob);
        element.download = cert.filename;
        document.body.appendChild(element);
        element.click();
    };

    const handleUpload = () => {
        props.history.push({ pathname: '/app/config/serviceCertUpload', state: { data: cert } });
    };


    let downloadButton;
    if(cert.content !== undefined) {
        downloadButton = <DownloadIcon onClick={handleDownload} />;
    } else {
        downloadButton = <div></div>;
    }

    let uploadButton;
    if(cert.source === 'custom') {
        uploadButton = <UploadIcon onClick={handleUpload} />;
    } else {
        uploadButton = <div></div>;
    }

    let deleteButton;
    if(cert.source === 'custom') {
        deleteButton = <DeleteForeverIcon onClick={handleDelete} />
    } else {
        deleteButton = <div></div>;
    }

    return (
        <TableRow className={classes.root}>
            <TableCell align="left">{cert.sid}</TableCell>
            <TableCell align="left">{cert.filename}</TableCell>
            <TableCell align="left">{cert.source}</TableCell>
            <TableCell align="right">
                {downloadButton}
            </TableCell>
            <TableCell align="right">
                {uploadButton}
            </TableCell>
            <TableCell align="right">
                {deleteButton}
            </TableCell>
        </TableRow>
    );
}

function ServiceCertsList(props) {
    const { history, certs } = props;
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
                        <TableCell align="right">Download</TableCell>
                        <TableCell align="right">Upload</TableCell>
                        <TableCell align="right">Delete</TableCell>
                    </TableRow>
                </TableHead>
                <TableBody>
                    {certs.map((cert, index) => (
                        <Row
                            history={history}
                            key={index}
                            cert={cert}
                            service={service}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}


export default function ServiceCerts(props) {
    console.log(props);
    let service = props.location.state.data;

    const url = '/config-server/configs/service/cert?sid=' + service.sid;
    console.log(url);
    const headers = {};
    const { isLoading, data } = useApiGet({url, headers});
  
    const handleCreate = () => {
        props.history.push({ pathname: '/app/form/createServiceCert', state: { data: { ...service } } });
    };

    let wait;
    if(isLoading) {
      wait = <div><CircularProgress/></div>;
    } else {
      const combinedProps = {...props, certs: data};
      wait = (
        <div>
          <ServiceCertsList {...combinedProps} />
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
