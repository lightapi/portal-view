import { createTheme } from '@mui/material/styles';
import defaultTheme from './default';
const overrides = {
  typography: {
    fontFamily: [
      '-apple-system',
      'BlinkMacSystemFont',
      '"Segoe UI"',
      'Roboto',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
      '"Apple Color Emoji"',
      '"Segoe UI Emoji"',
      '"Segoe UI Symbol"',
    ].join(','),
    // h1: {
    //   fontSize: '3rem',
    // },
    // h2: {
    //   fontSize: '2rem',
    // },
    // h3: {
    //   fontSize: '1.64rem',
    // },
    // h4: {
    //   fontSize: '1.5rem',
    // },
    // h5: {
    //   fontSize: '1.285rem',
    // },
    // h6: {
    //   fontSize: '1.142rem',
    // },
    // fontSize: '6rem',
  },
  zIndex: {
    appBar: 1250,
  },
};

export const theme = createTheme({ ...defaultTheme, ...overrides });

