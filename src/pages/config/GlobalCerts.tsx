import React, { useState, useEffect } from 'react';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import DownloadIcon from '@mui/icons-material/Download';
import UploadIcon from '@mui/icons-material/Upload';
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
    const { history, host, cert } = props;
    const classes = useRowStyles();

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
        props.history.push({ pathname: '/app/config/globalCertUpload', state: { data: cert } });
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete the global cert?')) {
            history.push({
                pathname: '/app/config/globalCertDelete',
                state: { data: { cert } },
            });
        }
    };

    let downloadButton;
    if(cert.content !== undefined) {
        downloadButton = <DownloadIcon onClick={handleDownload} />;
    } else {
        downloadButton = <div></div>;
    }

    return (
        <TableRow className={classes.root}>
            <TableCell align="left">{cert.host}</TableCell>
            <TableCell align="left">{cert.module}</TableCell>
            <TableCell align="left">{cert.project}</TableCell>
            <TableCell align="left">{cert.projver}</TableCell>
            <TableCell align="left">{cert.env}</TableCell>
            <TableCell align="left">{cert.filename}</TableCell>
            <TableCell align="right">
                {downloadButton}
            </TableCell>
            <TableCell align="right">
                <UploadIcon onClick={handleUpload} />
            </TableCell>
            <TableCell align="right">
                <DeleteForeverIcon onClick={handleDelete} />
            </TableCell>
        </TableRow>
    );
}

function GlobalCertsList(props) {
    const { history } = props;
    let certs = props.location.state.data;
    console.log(certs);
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
                        <TableCell align="left">Filename</TableCell>
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
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}

export default function GlobalCerts(props) {
    console.log(props);
    let certs = props.location.state.data;
    const { host } = useUserState();

    const handleCreate = () => {
        props.history.push({ pathname: '/app/form/createGlobalCert', state: { data: { host } } });
    };

    return <div><GlobalCertsList {...props} /><AddBoxIcon onClick={() => handleCreate()} /></div>
}
