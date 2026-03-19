import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';
import Widget from '../../components/Widget/Widget';
import { useUserState } from '../../contexts/UserContext';
import { useApiGet } from '../../hooks/useApiGet';
import { useNavigate } from 'react-router-dom';

export default function EntityProfile() {
  const navigate = useNavigate();
  const { email } = useUserState();
  
  const cmd = {
    host: 'lightapi.net',
    service: 'covid',
    action: 'getEntity',
    version: '0.1.0',
    data: { email },
  };

  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};

  const { isLoading, data, error } = useApiGet({ url, headers });

  const deleteEntity = () => {
    if (window.confirm('Are you sure you want to delete the entity?')) {
      navigate('/app/covid/deleteEntity', {
        state: { data },
      });
    }
  };

  const updateEntity = () => {
    if (
      window.confirm(
        'Updating category and subcategory will remove the Website and Status.'
      )
    ) {
      navigate('/app/form/updateCovidEntity', {
        state: { data },
      });
    }
  };

  const createEntity = () => {
    navigate('/app/form/createCovidEntity');
  };

  const buttonSx = {
    '& > button': {
      m: 1,
    },
  };

  let buttons;
  if (data) {
    buttons = (
      <Box sx={buttonSx}>
        <Button variant="contained" color="primary" onClick={updateEntity}>
          Update
        </Button>
        <Button variant="contained" color="primary" onClick={deleteEntity}>
          Delete
        </Button>
      </Box>
    );
  } else {
    buttons = (
      <Box sx={buttonSx}>
        <Button variant="contained" color="primary" onClick={createEntity}>
          Create
        </Button>
      </Box>
    );
  }

  let wait;
  if (isLoading) {
    wait = (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  } else {
    wait = (
      <Widget
        title="Entity Profile"
        upperTitle
        sx={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}
        bodySx={{
          display: 'flex',
          flexGrow: 1,
          flexDirection: 'column',
          justifyContent: 'space-between',
        }}
      >
        {buttons}
        <Box component="pre" sx={{ overflowX: 'auto', p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
          {data ? JSON.stringify(data, null, 2) : error}
        </Box>
      </Widget>
    );
  }

  return <Box className="App">{wait}</Box>;
}
