import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useNavigate } from 'react-router-dom';
import Widget from '../../components/Widget/Widget';
import { useUserState } from '../../contexts/UserContext';
import { useApiGet } from '../../hooks/useApiGet';
import useStyles from './styles';

export default function Profile() {
  const navigate = useNavigate();
  const classes = useStyles();
  const { email } = useUserState();
  //console.log("isAuthenticated = " + isAuthenticated + " userId = " + userId);
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
      //console.log("confirmed");
      navigate('/app/deleteProfile', { state: { data } });
    }
  };

  const editProfile = () => {
    //console.log("editProfile is called");
    navigate('/app/form/updateProfile', {
      state: { data },
    });
  };

  let wait;
  if (isLoading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    wait = (
      <Widget
        title="User Profile"
        upperTitle
        bodyClass={classes.fullHeightBody}
        className={classes.card}
      >
        <div className={classes.button}>
          <Button variant="contained" color="primary" onClick={editProfile}>
            Edit
          </Button>
          <Button variant="contained" color="primary" onClick={deleteProfile}>
            Delete
          </Button>
        </div>
        <pre>{data ? JSON.stringify(data, null, 2) : 'Unauthorized'}</pre>
      </Widget>
    );
  }

  return <div className="App">{wait}</div>;
}
