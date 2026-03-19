import Button from '@mui/material/Button';
import { Box } from '@mui/material';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Widget from '../../components/Widget/Widget';

export default function CityRegistry() {
  const location = useLocation();
  const navigate = useNavigate();
  const error = location.state?.error;

  const createCityMap = () => {
    navigate('/app/form/createCityMap');
  };

  return (
    <Box>
      <Widget
        title="City Map"
        upperTitle
        sx={{
          minHeight: '100%',
          display: 'flex',
          flexDirection: 'column',
        }}
        bodyStyle={{
          display: 'flex',
          flexGrow: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        <Box sx={{ '& > *': { m: 1 } }}>
          <Button variant="contained" color="primary" onClick={createCityMap}>
            Create
          </Button>
        </Box>
        <Box component="pre" sx={{ overflow: 'auto', mt: 2 }}>
          {JSON.stringify(error, null, 2)}
        </Box>
      </Widget>
    </Box>
  );
}
