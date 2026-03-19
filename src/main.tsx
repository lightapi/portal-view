import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { CssBaseline } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { theme } from "./themes";
import { LayoutProvider } from "./contexts/LayoutContext.tsx";
import { UserProvider } from "./contexts/UserContext.tsx";
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
