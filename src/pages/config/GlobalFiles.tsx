import React, { useState, useEffect } from 'react';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DeleteForeverIcon from '@mui/icons-material/DeleteForever';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
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

function Row(props) {
    const { history, host, file } = props;
    const classes = useRowStyles();

    const handleDownload = () => {
        const element = document.createElement("a");
        const blob = new Blob([decodeURIComponent(escape(window.atob(file.content)))], {
          type: "text/plain"
        });
        element.href = URL.createObjectURL(blob);
        element.download = file.filename;
        document.body.appendChild(element);
        element.click();
    };

    const handleUpload = () => {
        props.history.push({ pathname: '/app/config/globalFileUpload', state: { data: file } });
    };

    const handleDelete = () => {
        if (window.confirm('Are you sure you want to delete the global file?')) {
            history.push({
                pathname: '/app/config/globalFileDelete',
                state: { data: { file } },
            });
        }
    };

    let downloadButton;
    if(file.content !== undefined) {
        downloadButton = <DownloadIcon onClick={handleDownload} />;
    } else {
        downloadButton = <div></div>;
    }

    return (
        <TableRow className={classes.root}>
            <TableCell align="left">{file.host}</TableCell>
            <TableCell align="left">{file.module}</TableCell>
            <TableCell align="left">{file.project}</TableCell>
            <TableCell align="left">{file.projver}</TableCell>
            <TableCell align="left">{file.env}</TableCell>
            <TableCell align="left">{file.filename}</TableCell>
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

function GlobalFilesList(props) {
    const { history } = props;
    let files = props.location.state.data;
    console.log(files);
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
                    {files.map((file, index) => (
                        <Row
                            history={history}
                            key={index}
                            file={file}
                        />
                    ))}
                </TableBody>
            </Table>
        </TableContainer>
    );
}


export default function GlobalFiles(props) {
    console.log(props);
    let files = props.location.state.data;
    const { host } = useUserState();

    const handleCreate = () => {
        props.history.push({ pathname: '/app/form/createGlobalFile', state: { data: { host } } });
    };

    return <div><GlobalFilesList {...props} /><AddBoxIcon onClick={() => handleCreate()} /></div>
}
