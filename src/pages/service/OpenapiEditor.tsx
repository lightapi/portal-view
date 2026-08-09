import { useState } from "react";
import Button from "@mui/material/Button";
import { useNavigate, useLocation } from "react-router-dom";
import FileUpload from "../../components/Upload/FileUpload";
import OpenApiSpecEditor from "../../components/OpenApiSpecEditor";
import { Box, CircularProgress, Paper, Typography } from "@mui/material";
import { apiPost } from "../../api/apiPost";

export default function OpenapiEditor() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data } = location.state;
  const { serviceVersion } = data;
  
  const [spec, setSpec] = useState(
    typeof serviceVersion.spec === "string" ? serviceVersion.spec : "",
  );
  const [isSubmitting, setIsSubmitting] = useState(false); // State to handle submission loading
  const [validationError, setValidationError] = useState<string | null>(null);

  const onChange = (value: string) => {
    setSpec(value);
  };

  const onUpload = (files: File[]) => {
    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result;
        if (typeof result === "string") setSpec(result);
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
      action: "updateApiVersionSpec",
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
        navigate("/app/apiDetail", { 
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
    <Box>
      <Typography variant="h6">
        {serviceVersion.apiId} - {serviceVersion.serviceId}
      </Typography>
      <Box sx={{ display: "flex", justifyContent: "flex-end", my: 1.5 }}>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={submitSpec}
          disabled={isSubmitting || Boolean(validationError)}
        >
          {isSubmitting ? <CircularProgress size={24} color="inherit" /> : "SUBMIT"}
        </Button>
      </Box>
      <FileUpload
        accept=".yaml,.yml,.json"
        label="OpenAPI specification file in YAML or JSON"
        multiple={false}
        updateFilesCb={onUpload}
      />
      <Paper variant="outlined" sx={{ mt: 2, overflow: "hidden" }}>
        <OpenApiSpecEditor
          value={spec}
          height="600px"
          onValidationChange={setValidationError}
          onChange={onChange}
        />
      </Paper>
    </Box>
  );
}
