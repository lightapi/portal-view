import React, { useState } from 'react';
import { useStyles } from '../Constants';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import CssBaseline from '@mui/material/CssBaseline';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import FormControlLabel from '@mui/material/FormControlLabel';
import FormGroup from '@mui/material/FormGroup';
import Switch from '@mui/material/Switch';
import ChaosInfoPopper from './ChaosInfoPopper';
import Typography from '@mui/material/Typography';

export default function ExeptionForm(props) {
  const classes = useStyles();
  const formType = props.formType;
  const address = props.address;
  const port = props.port;
  const protocol = props.protocol;
  const assaultType = 'com.networknt.chaos.ExceptionAssaultHandler';

  const [endpoint, setEndpoint] = useState();
  const [requests, setRequests] = useState();

  const [enabled, setEnabled] = useState(props.config['enabled']);
  const [bypass, setBypass] = useState(props.config['bypass']);
  const [level, setLevel] = useState(props.config['level']);

  const handleEndpointChange = (e) => {
    setEndpoint(e.target.value);
  };

  const handleChangeRequests = (e) => {
    setRequests(e.target.value);
  };

  const handleEnabledChange = (e) => {
    setEnabled(e.target.value);
  };

  const handleBypassChange = (e) => {
    setBypass(e.target.value);
  };

  const handleLevelChange = (e) => {
    setLevel(e.target.value);
  };

  const handleExceptionSubmit = (event) => {
    event.preventDefault();
    var headers = {
      Authorization: 'Basic ' + localStorage.getItem('user'),
      'Content-Type': 'application/json',
    };
    let url;
    let data;
    if (formType === 'initAssault') {
      url = new URL(props.baseUrl + '/services/chaosmonkey/assault');
      data = JSON.stringify({
        protocol: protocol,
        address: address,
        assaultType: assaultType,
        port: port,
        endpoint: endpoint,
        requests: requests,
      });
    } else if (formType === 'configAssault') {
      url = new URL(props.baseUrl + '/services/chaosmonkey');
      data = JSON.stringify({
        protocol: protocol,
        port: port,
        address: address,
        assaultType: assaultType,
        assaultConfig: {
          enabled: enabled,
          bypass: bypass,
          level: level,
        },
      });
    }
    return fetch(url, {
      method: 'POST',
      body: data,
      headers: headers,
    })
      .then((response) => {
        if (response.status >= 200 && response.status < 300) {
          window.location.reload();
        } else {
          console.log('something went wrong');
        }
      })
      .catch((err) => err);
  };

  let formTitle = '';
  let form = <div></div>;

  if (formType === 'initAssault') {
    formTitle = 'Trigger';
    form = (
      <React.Fragment>
        <Grid item xs={6}>
          <TextField
            type="text"
            fullWidth
            onChange={handleEndpointChange}
            variant="outlined"
            label="endpoint"
            margin="none"
          />
        </Grid>
        <Grid item xs={6}>
          <TextField
            type="number"
            onChange={handleChangeRequests}
            fullWidth
            variant="outlined"
            label="requests"
            margin="none"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            type="text"
            variant="filled"
            fullWidth
            label="assaultType"
            disabled
            value={assaultType}
            inputProps={{ readOnly: true }}
            margin="none"
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            type="text"
            variant="filled"
            label="protcol"
            fullWidth
            value={protocol}
            disabled
            inputProps={{ readOnly: true }}
            margin="none"
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            type="text"
            variant="filled"
            label="address"
            fullWidth
            disabled
            value={address}
            inputProps={{ readOnly: true }}
            margin="none"
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            type="text"
            variant="filled"
            label="port"
            fullWidth
            disabled
            value={port}
            inputProps={{ readOnly: true }}
            margin="none"
          />
        </Grid>
      </React.Fragment>
    );
  } else if (formType === 'configAssault') {
    formTitle = 'Configuration';
    form = (
      <React.Fragment>
        <Grid item xs={8}>
          <FormGroup row>
            <FormControlLabel
              control={
                <Switch
                  onChange={handleEnabledChange}
                  defaultChecked={props.config['enabled']}
                  color="primary"
                />
              }
              label="Enabled"
            />
            <FormControlLabel
              control={
                <Switch
                  onChange={handleBypassChange}
                  defaultChecked={props.config['bypass']}
                  color="primary"
                />
              }
              label="Bypass"
            />
          </FormGroup>
        </Grid>
        <Grid item xs={4}>
          <TextField
            type="number"
            variant="outlined"
            onChange={handleLevelChange}
            defaultValue={props.config['level']}
            fullWidth
            required
            label="Level"
            margin="none"
          />
        </Grid>
        <Grid item xs={12}>
          <TextField
            type="text"
            variant="filled"
            fullWidth
            label="assaultType"
            value={assaultType}
            disabled
            inputProps={{ readOnly: true }}
            margin="none"
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            type="text"
            variant="filled"
            label="protcol"
            fullWidth
            disabled
            value={protocol}
            inputProps={{ readOnly: true }}
            margin="none"
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            type="text"
            variant="filled"
            label="address"
            fullWidth
            disabled
            value={address}
            inputProps={{ readOnly: true }}
            margin="none"
          />
        </Grid>
        <Grid item xs={4}>
          <TextField
            type="text"
            variant="filled"
            label="port"
            disabled
            fullWidth
            value={port}
            inputProps={{ readOnly: true }}
            margin="none"
          />
        </Grid>
      </React.Fragment>
    );
  }
  let nullForm = Boolean(assaultType === '' || formType === '');
  if (!nullForm) {
    return (
      <div>
        <CssBaseline />
        <form
          className={classes.form}
          noValidate
          onSubmit={handleExceptionSubmit}
        >
          <Paper style={{ padding: 16 }}>
            <Grid
              container
              alignItems="center"
              justifyContent="center"
              spacing={2}
              direction="row"
            >
              <Grid item xs={12} style={{ padding: 0, margin: 0 }}>
                <Typography
                  variant="h4"
                  component="h1"
                  align="left"
                  gutterBottom
                >
                  Exception Assault {formTitle} Form
                  <ChaosInfoPopper
                    formType={formType}
                    handlerName="Exception Assault Handler"
                  />
                </Typography>
              </Grid>
              {form}
              <Grid item xs={3}>
                <Button
                  type="submit"
                  fullWidth
                  variant="contained"
                  color="primary"
                  className={classes.submit}
                >
                  Go
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </form>
      </div>
    );
  } else {
    return <div></div>;
  }
}
