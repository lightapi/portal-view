import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableRow from '@mui/material/TableRow';
import FileUpload from "../../components/Upload/FileUpload";

export default function ServiceFileUpload(props) {
    console.log(props);
    const file = props.location.state.data;
    const [content, setContent] = useState('');

    const onUpload = (files) => {
        files.forEach(file => {
            var reader = new FileReader();
            reader.onload = function (e) {
                setContent(window.btoa(unescape(encodeURIComponent(e.target.result))));
            };
            reader.readAsText(file);
        })
    };

    const submitServiceFile = () => {
        file.content = content;
        props.history.push({ pathname: '/app/config/serviceFileUpdate', state: { data: file } });
    };

    return (
        <div className="App">
            <Table aria-label="collapsible table">
                <TableBody>
                    <TableRow>
                        <TableCell align="left">Host</TableCell>
                        <TableCell align="right">{file.host}</TableCell>
                        <TableCell align="left">Module</TableCell>
                        <TableCell align="right">{file.module}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left">Project</TableCell>
                        <TableCell align="right">{file.project}</TableCell>
                        <TableCell align="left">Project Version</TableCell>
                        <TableCell align="right">{file.projver}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left">Service</TableCell>
                        <TableCell align="right">{file.service}</TableCell>
                        <TableCell align="left">Service Version</TableCell>
                        <TableCell align="right">{file.servver}</TableCell>
                    </TableRow>
                    <TableRow>
                        <TableCell align="left">Environment</TableCell>
                        <TableCell align="right">{file.env}</TableCell>
                        <TableCell align="left">Filename</TableCell>
                        <TableCell align="right">{file.filename}</TableCell>
                    </TableRow>
                </TableBody>
            </Table>

            <Button variant="contained" color="primary" onClick={submitServiceFile}>
                SUBMIT
            </Button>
            <FileUpload
                accept=".yaml,.yml,.json,.xml,.properties"
                label="Config file in YAML, JSON, XML or Properties"
                multiple={false}
                updateFilesCb={onUpload}
            />

        </div>
    );
}
