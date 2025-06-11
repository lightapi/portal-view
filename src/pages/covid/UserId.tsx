import Button from '@mui/material/Button';
import TextField from '@mui/material/TextField';
import { makeStyles } from '@mui/styles';
import React, { useState } from 'react';

const useStyles = makeStyles((theme) => ({
  root: {
    '& > *': {
      margin: theme.spacing(1),
      width: '25ch',
    },
  },
}));

export default function UserId(props) {
  const classes = useStyles();
  const [userId, setUserId] = useState('');

  const onChange = (event) => {
    setUserId(event.target.value);
  };
  const website = () => {
    props.history.push({
      pathname: '/app/website',
      state: { data: { userId } },
    });
  };

  const status = () => {
    //console.log("status is called");
    props.history.push({
      pathname: '/app/covid/peerStatus',
      state: { data: { userId } },
    });
  };

  return (
    <form className={classes.root} noValidate autoComplete="off">
      <TextField id="userId" label="User Id" onChange={onChange} />
      <Button variant="contained" color="primary" onClick={website}>
        Website
      </Button>
      <Button variant="contained" color="primary" onClick={status}>
        Status
      </Button>
    </form>
  );
}
