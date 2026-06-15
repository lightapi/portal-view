import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Button from "@mui/material/Button";
import Stack from "@mui/material/Stack";
import Typography from "@mui/material/Typography";
import Paper from "@mui/material/Paper";
import Box from "@mui/material/Box";
import IconButton from "@mui/material/IconButton";
import Tooltip from "@mui/material/Tooltip";
import ContentCopyIcon from "@mui/icons-material/ContentCopy";
import DownloadIcon from "@mui/icons-material/Download";
import CheckIcon from "@mui/icons-material/Check";
import { signOut, useUserDispatch, useUserState } from "../../contexts/UserContext";

export default function Success() {
  const location = useLocation();
  const navigate = useNavigate();
  const userDispatch = useUserDispatch();
  const { userId }: any = useUserState();
  // Access the data from the state object
  const data = location.state?.data;
  const isHostOwner = data?.hostOwner && userId && data.hostOwner === userId;
  const showClaimOrgRelogin = data?.reloginRequiredForHostOwner === true;
  console.log("data = ", data);

  const [copied, setCopied] = useState(false);

  const handleGoBack = () => {
    navigate("/");
  };

  const handleSignOut = () => {
    signOut(userDispatch, navigate);
  };

  const handleCopy = () => {
    if (data) {
      navigator.clipboard.writeText(JSON.stringify(data, null, 2))
        .then(() => {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        })
        .catch((err) => {
          console.error("Failed to copy text: ", err);
        });
    }
  };

  const handleDownload = () => {
    if (data) {
      const jsonString = JSON.stringify(data, null, 2);
      const blob = new Blob([jsonString], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "success-data.json";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  };

  return (
    <Stack spacing={2}>
      <Typography variant="h5">Success</Typography>
      {showClaimOrgRelogin ? (
        <Alert
          severity="info"
          action={
            isHostOwner ? (
              <Button color="inherit" size="small" onClick={handleSignOut}>
                LOG OUT
              </Button>
            ) : undefined
          }
        >
          {isHostOwner
            ? "Your current host was switched to the newly created host. Log out and log in again to access it with the new host and role claims."
            : "The host owner's current host was switched to the newly created host. The host owner must log out and log in again before accessing it."}
        </Alert>
      ) : null}
      {data ? (
        <Paper
          variant="outlined"
          sx={{
            borderRadius: 2,
            overflow: "hidden",
            borderColor: "divider",
            backgroundColor: "background.paper",
            boxShadow: "0 4px 20px 0 rgba(0,0,0,0.05)"
          }}
        >
          {/* Header Bar */}
          <Box
            sx={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              px: 2,
              py: 1.2,
              backgroundColor: "action.hover",
              borderBottom: 1,
              borderColor: "divider"
            }}
          >
            <Typography variant="subtitle2" color="text.secondary" sx={{ fontWeight: "bold", letterSpacing: "0.5px" }}>
              RESULT DATA
            </Typography>
            <Stack direction="row" spacing={1}>
              <Tooltip title={copied ? "Copied!" : "Copy to Clipboard"}>
                <IconButton
                  size="small"
                  color={copied ? "success" : "primary"}
                  onClick={handleCopy}
                  sx={{
                    transition: "all 0.2s",
                    transform: copied ? "scale(1.15)" : "scale(1)"
                  }}
                >
                  {copied ? <CheckIcon fontSize="small" /> : <ContentCopyIcon fontSize="small" />}
                </IconButton>
              </Tooltip>
              <Tooltip title="Download as File">
                <IconButton size="small" color="primary" onClick={handleDownload}>
                  <DownloadIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Stack>
          </Box>

          {/* Code Body */}
          <Box
            sx={{
              p: 2,
              backgroundColor: "background.default",
              maxHeight: "400px",
              overflowY: "auto"
            }}
          >
            <pre style={{ margin: 0, fontFamily: "Consolas, Monaco, 'Andale Mono', 'Ubuntu Mono', monospace", fontSize: "0.875rem", whiteSpace: "pre-wrap", wordBreak: "break-all" }}>
              {JSON.stringify(data, null, 2)}
            </pre>
          </Box>
        </Paper>
      ) : (
        <Typography variant="body1" color="text.secondary">
          No data received.
        </Typography>
      )}
      <Button variant="contained" color="primary" onClick={handleGoBack}>
        BACK TO DASHBOARD
      </Button>
    </Stack>
  );
}
