import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import Widget from '../../components/Widget/Widget';
import { useUserState } from '../../contexts/UserContext';
import { useApiGet } from '../../hooks/useApiGet';
import useStyles from './styles';

export default function Payment(props) {
  const classes = useStyles();
  const { email } = useUserState();
  const cmd = {
    host: 'lightapi.net',
    service: 'user',
    action: 'getPayment',
    version: '0.1.0',
    data: { email },
  };

  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};

  const { isLoading, data, error } = useApiGet({ url, headers });

  const deletePayment = () => {
    if (
      window.confirm(
        'Are you sure you want to delete all your payment methods?'
      )
    ) {
      props.history.push({ pathname: '/app/deletePayment', state: { data } });
    }
  };

  const updatePayment = () => {
    props.history.push({
      pathname: '/app/form/updatePayment',
      state: { data: { email, payments: data } },
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
        title="User Payment"
        upperTitle
        bodyClass={classes.fullHeightBody}
        className={classes.card}
      >
        <div className={classes.button}>
          <Button variant="contained" color="primary" onClick={updatePayment}>
            {error ? 'Create' : 'Update'}
          </Button>
          <Button variant="contained" color="primary" onClick={deletePayment}>
            Delete
          </Button>
        </div>
        <pre>{data ? JSON.stringify(data, null, 2) : error}</pre>
      </Widget>
    );
  }

  return <div className="App">{wait}</div>;
}
