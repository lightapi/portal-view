import SearchIcon from '@mui/icons-material/Search';
import { Box } from '@mui/material';
import React from 'react';

const NoResult = () => {
  return (
    <Box sx={{ textAlign: 'center', p: 4, mt: 4 }}>
      <SearchIcon sx={{ fontSize: 60, color: 'text.secondary' }} />
      <Box component="h2">Sorry, no products matched your search!</Box>
      <Box component="p">Enter a different keyword and try.</Box>
    </Box>
  );
};

export default NoResult;
