import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { Box } from '@mui/material';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function UserId() {
  const navigate = useNavigate();
  const [userId, setUserId] = useState('');

  const onChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setUserId(event.target.value);
  };
  
  const website = () => {
    navigate('/app/website', {
      state: { data: { userId } },
    });
  };

  const status = () => {
    navigate('/app/covid/peerStatus', {
      state: { data: { userId } },
    });
  };

  return (
    <Box
      component="form"
      sx={{
        '& > *': {
          m: 1,
          width: '25ch',
        },
      }}
      noValidate
      autoComplete="off"
    >
      <TextField id="userId" label="User Id" onChange={onChange} value={userId} />
      <Button variant="contained" color="primary" onClick={website}>
        Website
      </Button>
      <Button variant="contained" color="primary" onClick={status}>
        Status
      </Button>
    </Box>
  );
}
