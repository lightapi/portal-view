import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Widget from '../../components/Widget/Widget';
import { useUserState } from '../../contexts/UserContext';
import { useApiGet } from '../../hooks/useApiGet';

export default function Profile() {
  const navigate = useNavigate();
  const { email } = useUserState();

  const cmd = {
    host: 'lightapi.net',
    service: 'user',
    action: 'queryUserByEmail',
    version: '0.1.0',
    data: { email },
  };

  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};

  const { isLoading, data } = useApiGet({ url, headers });

  const deleteProfile = () => {
    if (window.confirm('Are you sure you want to delete your profile?')) {
      navigate('/app/deleteProfile', { state: { data } });
    }
  };

  const editProfile = () => {
    navigate('/app/form/updateProfile', {
      state: { data },
    });
  };

  if (isLoading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Widget
        title="User Profile"
        upperTitle
        bodySx={{ height: '100%', display: 'flex', flexDirection: 'column' }}
        sx={{ minHeight: '100%' }}
      >
        <Box sx={{ mb: 2, display: 'flex', gap: 1 }}>
          <Button variant="contained" color="primary" onClick={editProfile}>
            Edit
          </Button>
          <Button variant="contained" color="primary" onClick={deleteProfile}>
            Delete
          </Button>
        </Box>
        <Box
          component="pre"
          sx={{
            p: 2,
            backgroundColor: '#f5f5f5',
            borderRadius: 1,
            overflow: 'auto',
          }}
        >
          {data ? JSON.stringify(data, null, 2) : 'Unauthorized'}
        </Box>
      </Widget>
    </Box>
  );
}
