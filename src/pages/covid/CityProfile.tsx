import Button from '@mui/material/Button';
import { Box } from '@mui/material';
import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import Widget from '../../components/Widget/Widget';

export default function CityProfile() {
  const location = useLocation();
  const navigate = useNavigate();
  const data = location.state?.data;

  const updateCityMap = () => {
    navigate('/app/form/updateCityMap', {
      state: { data },
    });
  };

  const deleteCityMap = () => {
    if (window.confirm('Are you sure you want to delete the city?')) {
      navigate('/app/covid/deleteCity', {
        state: { data },
      });
    }
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
          <Button variant="contained" color="primary" onClick={updateCityMap}>
            Update
          </Button>
          <Button variant="contained" color="primary" onClick={deleteCityMap}>
            Delete
          </Button>
        </Box>
        <Box component="pre" sx={{ overflow: 'auto', mt: 2 }}>
          {JSON.stringify(data, null, 2)}
        </Box>
      </Widget>
    </Box>
  );
}
