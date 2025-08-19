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
import { CircularProgress } from "@mui/material";
import { apiPost } from "../../api/apiPost";

export default function OpenapiEditor() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = location.state;
  const { serviceVersion } = data;
  
  const [spec, setSpec] = useState(serviceVersion.spec || ""); // Ensure spec is not undefined
  const [isSubmitting, setIsSubmitting] = useState(false); // State to handle submission loading

  const onChange = (value) => {
    setSpec(value);
  };

  const onUpload = (files) => {
    files.forEach((file) => {
      var reader = new FileReader();
      reader.onload = function (e) {
        setSpec(e.target.result as string);
      };
      reader.readAsText(file);
    });
  };

  const submitSpec = async () => {
    setIsSubmitting(true);
    
    // Create a new object to avoid mutating the original state object directly
    const updatedServiceVersion = { ...serviceVersion, spec };

    const cmd = {
      host: "lightapi.net",
      service: "service",
      action: "updateServiceSpec",
      version: "0.1.0",
      data: updatedServiceVersion,
    };

    try {
      const result = await apiPost({ url: "/portal/command", headers: {}, body: cmd });
      if (result.error) {
        console.error("API Error on submit:", result.error);
        alert(`Failed to submit spec: ${result.error.description || "Please try again."}`);
      } else {
        alert("Specification submitted successfully!");
        // Navigate back to the service detail page after success
        navigate("/app/serviceDetail", { 
          state: { 
            service: { 
              hostId: serviceVersion.hostId, 
              apiId: serviceVersion.apiId 
            } 
          } 
        });
      }
    } catch (e) {
      console.error("Network Error on submit:", e);
      alert("Failed to submit spec due to a network error.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      {serviceVersion.apiId} - {serviceVersion.serviceId}
      <div style={{ display: "flex", justifyContent: "flex-end", margin: "10px 0" }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={submitSpec}
          disabled={isSubmitting} // Disable button while submitting
        >
          {isSubmitting ? <CircularProgress size={24} color="inherit" /> : "SUBMIT"}
        </Button>
      </div>
      <FileUpload
        accept=".yaml,.yml"
        label="OpenAPI specification file in YAML"
        multiple={false}
        updateFilesCb={onUpload}
      />
      <CodeMirror
        value={spec}
        height="300px"
        width="100%" // Use responsive width
        theme={githubLight}
        extensions={[yaml()]}
        onChange={onChange}
      />
      <SwaggerUI
        spec={spec === undefined || spec.length === 0 ? "" : YAML.parse(spec)}
      />
    </div>
  );
}
