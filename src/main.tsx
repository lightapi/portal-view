import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CssBaseline } from '@mui/material'
import { ThemeProvider } from '@mui/material/styles'
import { ThemeProvider as StylesThemeProvider } from '@mui/styles';
import { theme } from './themes'
import { LayoutProvider } from './contexts/LayoutContext.tsx'
import { UserProvider } from './contexts/UserContext.tsx'
import { SiteProvider } from './contexts/SiteContext.tsx'
import { AppProvider } from './contexts/AppContext.tsx'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LayoutProvider>
      <ThemeProvider theme={theme}>
        <StylesThemeProvider theme={theme}>
          <UserProvider>
            <SiteProvider>
              <AppProvider>
                <CssBaseline />
                <App />
              </AppProvider>
            </SiteProvider>
          </UserProvider>
        </StylesThemeProvider>
      </ThemeProvider>
    </LayoutProvider>
  </StrictMode>
)
