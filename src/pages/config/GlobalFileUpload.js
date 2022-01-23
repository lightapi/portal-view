import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Cookies from 'universal-cookie';
import FileUpload from "../../components/Upload/FileUpload";
import { useUserState } from "../../context/UserContext";

export default function GlobalFileUpload(props) {
    console.log(props);
    const file = props.location.state.data;
    const style = props.location.state.data.style;
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

    const submitGlobalFile = () => {
        console.log(content);
        file.content = content;
        props.history.push({ pathname: '/app/config/globalFileUpdate', state: { data: file } });
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

            <Button variant="contained" color="primary" onClick={submitGlobalFile}>
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
