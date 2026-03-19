import { Button, Grid, Paper, Typography, Box } from '@mui/material';
import React from 'react';
import { Link } from 'react-router-dom';
// logo
import logo from './logo.svg';

export default function Error() {
  return (
    <Box
      sx={{
        height: '100vh',
        width: '100vw',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'primary.main',
        position: 'fixed',
        top: 0,
        left: 0,
      }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          mb: 4,
        }}
      >
        <img
          src={logo}
          alt="logo"
          style={{
            width: 100,
            marginRight: 24,
          }}
        />
        <Typography
          variant="h3"
          sx={{
            color: 'white',
            fontWeight: 500,
          }}
        >
          Light Portal
        </Typography>
      </Box>
      <Paper
        sx={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          p: 6,
          boxShadow: '0px 3px 11px 0px #E8EAFC, 0 3px 3px -2px #B2B2B2, 0 1px 8px 0 #9A9A9A',
        }}
      >
        <Typography
          variant="h1"
          color="primary"
          sx={{
            fontWeight: 500,
            fontSize: '12rem',
          }}
        >
          404
        </Typography>
        <Typography
          variant="h5"
          color="primary"
          sx={{
            mb: 2,
            fontWeight: 400,
          }}
        >
          Oops. Looks like the page you're looking for no longer exists
        </Typography>
        <Typography
          variant="h6"
          color="textSecondary"
          sx={{
            mb: 4,
            textAlign: 'center',
          }}
        >
          But we're here to bring you back to safety
        </Typography>
        <Button
          variant="contained"
          color="primary"
          component={Link}
          to="/"
          size="large"
          sx={{
            textTransform: 'none',
            fontSize: 22,
          }}
        >
          Back to Home
        </Button>
      </Paper>
    </Box>
  );
}
