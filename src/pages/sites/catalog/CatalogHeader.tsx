import { Box, Typography } from '@mui/material';
import React from 'react';

interface CatalogHeaderProps {
  storeName: string;
  storeTitle: string;
}

const CatalogHeader = ({ storeName, storeTitle }: CatalogHeaderProps) => {
  return (
    <Box
      component="header"
      sx={{
        width: '100%',
        minHeight: '100px',
        padding: '20px',
        border: '1px solid #ccc',
        backgroundColor: '#fa4303',
        color: 'white',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center'
      }}
    >
      <Typography variant="h4" component="h1" sx={{ m: 0 }}>{storeName}</Typography>
      <Typography variant="h6" component="h3" sx={{ m: 0 }}>{storeTitle}</Typography>
    </Box>
  );
};

export default CatalogHeader;
