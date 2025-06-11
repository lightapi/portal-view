import React, { useEffect, useState } from 'react';
import Button from '@mui/material/Button';
import AceEditor from "react-ace";
import "ace-builds/src-noconflict/mode-yaml";
import "ace-builds/src-noconflict/theme-github";
import SwaggerUI from "swagger-ui-react"
import "swagger-ui-react/swagger-ui.css"
import FileUpload from "../../components/Upload/FileUpload";

export default function UpdateAccess(props) {
    const serviceId = props.location.state.data.serviceId;
    const serviceName = props.location.state.data.name;
    const style = props.location.state.data.style;
    const { history} = props;
    const [spec, setSpec] = useState();

    const onChange = (spec) => {
        setSpec(spec);
    };
    
    const onUpload = (files) => {
        files.forEach(file => {
            var reader = new FileReader();
            reader.onload = function(e) {
                setSpec(e.target.result);
            };
            reader.readAsText(file);
        })
    };

    const submitSpec = () => {
        // console.log("submitSpec is called");
        props.history.push({
          pathname: '/app/submitSpec',
          state: { serviceId, style, spec },
        });
      };

    return (
        <div>
            {serviceId} - {serviceName}
            <Button variant="contained" color="primary" onClick={submitSpec}>
                SUBMIT
            </Button>
            <FileUpload
                accept=".yaml,.yml"
                label="OpenAPI specification file in YAML"
                multiple={false}
                updateFilesCb={onUpload}
            />
            <AceEditor
                mode="yaml"
                theme="github"
                value={spec}
                onChange={onChange}
                name="UNIQUE_ID_OF_DIV"
                editorProps={{ $blockScrolling: true }}
            />
            <SwaggerUI 
                spec={spec} 
           />            
        </div>
    );
}
