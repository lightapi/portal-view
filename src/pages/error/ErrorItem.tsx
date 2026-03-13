import { CircularProgress, Box, Typography } from "@mui/material";
import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import fetchClient from "../../utils/fetchClient";
// @ts-ignore
import MarkdownEditor from "@uiw/react-markdown-editor";

interface ErrorDetail {
  errorCode: string;
  statusCode: number;
  message: string;
  description: string;
  components: string;
  severity: string;
  owner: string;
  email: string;
  phone: string;
  resolution: string;
}

export default function ErrorItem() {
  const { host, errorCode } = useParams<{ host: string; errorCode: string }>();
  const [errorItem, setErrorItem] = useState<ErrorDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const queryErrorFn = async (url: string) => {
    try {
      setLoading(true);
      const data = await fetchClient(url);
      setErrorItem(data);
    } catch (e) {
      console.log(e);
      setErrorItem(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (host && errorCode) {
      const cmd = {
        host: "lightapi.net",
        service: "error",
        action: "getErrorByCode",
        version: "0.1.0",
        data: { host, errorCode },
      };
      const url = "/portal/query?cmd=" + encodeURIComponent(JSON.stringify(cmd));
      queryErrorFn(url);
    }
  }, [host, errorCode]);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (!errorItem) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">Error not found or failed to load.</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        {errorItem.errorCode}
      </Typography>
      <Box sx={{ mb: 2 }}>
        <Typography><strong>Status Code:</strong> {errorItem.statusCode}</Typography>
        <Typography><strong>Error Message:</strong> {errorItem.message}</Typography>
        <Typography><strong>Error Desc:</strong> {errorItem.description}</Typography>
        <Typography><strong>Error Components:</strong> {errorItem.components}</Typography>
        <Typography><strong>Error Severity:</strong> {errorItem.severity}</Typography>
        <Typography><strong>Error Owner:</strong> {errorItem.owner}</Typography>
        <Typography><strong>Contact Email:</strong> {errorItem.email}</Typography>
        <Typography><strong>Contact Number:</strong> {errorItem.phone}</Typography>
      </Box>
      <Content resolution={errorItem.resolution} />
    </Box>
  );
}

const Content = ({ resolution }: { resolution: string }) => {
  return (
    <Box sx={{ mt: 3, p: 2, border: '1px solid #ddd', borderRadius: 1 }}>
      <MarkdownEditor.Markdown source={resolution} />
    </Box>
  );
};
