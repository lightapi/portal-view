import { useState } from "react";
import Button from "@mui/material/Button";
import CodeMirror from "@uiw/react-codemirror";
import { useNavigate, useLocation } from "react-router-dom";
import { yaml } from "@codemirror/lang-yaml";
import { githubLight } from "@uiw/codemirror-theme-github";
import YAML from "yaml";
import SwaggerUI from "swagger-ui-react";
import "swagger-ui-react/swagger-ui.css";
import FileUpload from "../../components/Upload/FileUpload";

export default function OpenapiEditor() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = location.state;
  const { serviceVersion } = data;
  console.log(serviceVersion);
  const [spec, setSpec] = useState(serviceVersion.spec);

  const onChange = (spec) => {
    setSpec(spec);
  };

  const onUpload = (files) => {
    files.forEach((file) => {
      var reader = new FileReader();
      reader.onload = function (e) {
        setSpec(e.target.result);
      };
      reader.readAsText(file);
    });
  };

  const submitSpec = () => {
    // console.log("submitSpec is called");
    navigate("/app/submitSpec", { state: { serviceVersion, spec } });
  };

  let wait;
  console.log(spec);
  wait = (
    <div>
      {serviceVersion.apiId} - {serviceVersion.apiName} -{" "}
      {serviceVersion.apiVersion}
      <Button variant="contained" color="primary" onClick={submitSpec}>
        SUBMIT
      </Button>
      <FileUpload
        accept=".yaml,.yml"
        label="OpenAPI specification file in YAML"
        multiple={false}
        updateFilesCb={onUpload}
      />
      <CodeMirror
        value={spec}
        height="300px"
        width="800px"
        theme={githubLight}
        extensions={[yaml()]}
        onChange={onChange}
      />
      <SwaggerUI
        spec={spec === undefined || spec.length == 0 ? "" : YAML.parse(spec)}
      />
    </div>
  );

  return <div className="App">{wait}</div>;
}
