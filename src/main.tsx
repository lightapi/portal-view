import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "./themes";
import { LayoutProvider } from "./contexts/LayoutContext.tsx";
import { UserProvider } from "./contexts/UserContext.tsx";
import { ActionDisplayProvider } from "./contexts/ActionDisplayContext";
import { SiteProvider } from "./contexts/SiteContext.tsx";
import { AppProvider } from "./contexts/AppContext.tsx";
import { ControllerProvider } from "./contexts/ControllerContext.tsx";
import { PublicClientApplication } from "@azure/msal-browser";
import { MsalProvider } from "@azure/msal-react";
import "./index.css";
import App from "./App.tsx";
import { msalConfig } from "./authConfig.js";
import { isSsoEnabled } from "../config";

const instance = isSsoEnabled ? new PublicClientApplication(msalConfig) : null;

const appTree = (
  <LayoutProvider>
    <ThemeProvider theme={theme}>
      <ActionDisplayProvider>
      <UserProvider>
        <SiteProvider>
          <AppProvider>
            <ControllerProvider>
              <CssBaseline />
              <App />
            </ControllerProvider>
          </AppProvider>
        </SiteProvider>
      </UserProvider>
      </ActionDisplayProvider>
    </ThemeProvider>
  </LayoutProvider>
);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {isSsoEnabled && instance ? (
      <MsalProvider instance={instance}>{appTree}</MsalProvider>
    ) : (
      appTree
    )}
  </StrictMode>,
);
