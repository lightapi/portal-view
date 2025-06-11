import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import FileUpload from "../../components/Upload/FileUpload";

function arrayBufferToBase64( buffer ) {
    var binary = '';
    var bytes = new Uint8Array( buffer );
    var len = bytes.byteLength;
    for (var i = 0; i < len; i++) {
        binary += String.fromCharCode( bytes[ i ] );
    }
    return window.btoa( binary );
}


export default function ServiceCertUpload(props) {
    console.log(props);
    const cert = props.location.state.data;
    const [content, setContent] = useState('');

    const onUpload = (files) => {
        files.forEach(file => {
            var reader = new FileReader();
            reader.onload = function (e) {
                setContent(arrayBufferToBase64(e.target.result));
            };
            reader.readAsArrayBuffer(file);
        })
    };

    const submitServiceCert = () => {
        console.log(content);
        cert.content = content;
        props.history.push({ pathname: '/app/config/serviceCertUpdate', state: { data: cert } });
    };

    return (
        <div className="App">
            <Table aria-label="collapsible table">
                <TableBody>
                    <TableRow>
                        <TableCell align="left">Host</TableCell>
                        <TableCell align="right">{cert.host}</TableCell>
                        <TableCell align="left">Module</TableCell>
                        <TableCell align="right">{cert.module}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left">Project</TableCell>
                        <TableCell align="right">{cert.project}</TableCell>
                        <TableCell align="left">Project Version</TableCell>
                        <TableCell align="right">{cert.projver}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left">Service</TableCell>
                        <TableCell align="right">{cert.service}</TableCell>
                        <TableCell align="left">Service Version</TableCell>
                        <TableCell align="right">{cert.servver}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left">Environment</TableCell>
                        <TableCell align="right">{cert.env}</TableCell>
                        <TableCell align="left">Filename</TableCell>
                        <TableCell align="right">{cert.filename}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <Button variant="contained" color="primary" onClick={submitServiceCert}>
                SUBMIT
            </Button>
            <FileUpload
                accept=".cer,.truststore,.keystore,.crt,.pem"
                label="Certificate file in truststore, keystore, cer or crt"
                multiple={false}
                updateFilesCb={onUpload}
            />

        </div>
    );
}
