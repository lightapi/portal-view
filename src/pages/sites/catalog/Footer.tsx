import { Box, Typography, Link } from '@mui/material';
import React from 'react';

interface FooterProps {
  storeName?: string;
  site?: {
    home?: {
      name?: string;
    };
  };
}

const Footer = ({ site }: FooterProps) => {
  return (
    <Box
      component="footer"
      sx={{
        color: '#999',
        fontSize: '14px',
        textAlign: 'center',
        padding: '32px',
        background: '#ddd',
        '& strong': {
          color: '#666',
        },
      }}
    >
      <Typography
        sx={{
          marginBottom: '24px',
          '& a': {
            margin: '0 8px',
            color: '#666',
            textDecoration: 'none',
            '&:hover': {
              textDecoration: 'underline',
            }
          },
        }}
      >
        Want your website like this up in hours?{' '}
        <Link href="http://doc.maproot.net/website/" target="_blank">
          Create it on your own
        </Link>
        <span> / </span>
        <Link href="mailto:stevehu@gmail.com" target="_blank">
          We can help
        </Link>
      </Typography>
      <Typography variant="body2">
        &copy; 2020 <strong>maproot.net</strong> -{' '}
        {site?.home?.name ? site.home.name : 'we are all connected!'}
      </Typography>
    </Box>
  );
};

export default Footer;
