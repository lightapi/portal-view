import CircularProgress from '@mui/material/CircularProgress';
import Cookies from 'universal-cookie';
import CssBaseline from '@mui/material/CssBaseline';
import Grid from '@mui/material/Grid';
import Paper from '@mui/material/Paper';
import React, { useEffect, useState } from 'react';
import ChaosFormSettings from './chaos/ChaosFormSettings';
import ExceptionForm from './chaos/ExceptionForm';
import KillAppForm from './chaos/KillAppForm';
import LatencyForm from './chaos/LatencyForm';
import MemoryForm from './chaos/MemoryForm';

export default function ChaosMonkey(props) {
  const { history } = props;
  const protocol = props.location.state.data.protocol;
  const address = props.location.state.data.address;
  const port = props.location.state.data.port;
  const baseUrl = props.location.state.data.baseUrl;

  const chaosFormTypes = ['initAssault', 'configAssault'];
  const chaosFormTypeDisplays = ['Initiate Assault', 'Configure Assault'];

  const chaosAssaultTypes = ['killApp', 'exception', 'memory', 'latency'];
  const chaosAssaultTypeDisplays = [
    'KillApp Assault Handler',
    'Exception Assault Handler',
    'Memory Assault Handler',
    'Latency Assault Handler',
  ];

  const [chaosFormType, setChaosMonkeyFormType] = useState('');
  const [chaosAssaultType, setChaosMonkeyAssaultType] = useState('');

  const [chaosMonkeyGetData, setChaosMonkeyGetData] = useState(null);

  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);

  /* build query params */
  console.log(baseUrl);
  var url = new URL(baseUrl + '/services/chaosmonkey'),
    params = {
      protocol: protocol,
      port: port,
      address: address,
      serviceId: 'serviceId',
      tag: 'tag',
    };
  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key])
  );

  const handleAssaultChange = (newVal) => {
    setChaosMonkeyAssaultType(newVal);
  };

  const handleFormTypeChange = (newVal) => {
    setChaosMonkeyFormType(newVal);
  };

  useEffect(() => {
    const cookies = new Cookies();
    const headers = { 'X-CSRF-TOKEN': cookies.get('csrf') };
    const abortController = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      try {
        const response = await fetch(url, {
          headers, credentials: 'include',
          signal: abortController.signal,
        });
        if (!response.ok) {
          const data = await response.json();
          setLoading(false);
          if (
            data.code === 'ERR10002' ||
            data.code === 'ERR10046' ||
            data.code === 'ERR10047'
          ) {
            history.push({
              pathname: '/login',
              state: { from: props.location },
            });
          } else {
            setError(data);
          }
        } else {
          const data = await response.json();
          setChaosMonkeyGetData(data);
          setLoading(false);
        }
      } catch (e) {
        if (!abortController.signal.aborted) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, []);

  let activeForm;
  if (chaosAssaultType === 'killApp') {
    activeForm = (
      <KillAppForm
        baseUrl={baseUrl}
        config={chaosMonkeyGetData['com.networknt.chaos.KillappAssaultHandler']}
        formType={chaosFormType}
        protocol={protocol}
        address={address}
        port={port}
      />
    );
  } else if (chaosAssaultType === 'exception') {
    activeForm = (
      <ExceptionForm
        baseUrl={baseUrl}
        config={
          chaosMonkeyGetData['com.networknt.chaos.ExceptionAssaultHandler']
        }
        formType={chaosFormType}
        protocol={protocol}
        address={address}
        port={port}
      />
    );
  } else if (chaosAssaultType === 'memory') {
    activeForm = (
      <MemoryForm
        baseUrl={baseUrl}
        config={chaosMonkeyGetData['com.networknt.chaos.MemoryAssaultHandler']}
        formType={chaosFormType}
        protocol={protocol}
        address={address}
        port={port}
      />
    );
  } else if (chaosAssaultType === 'latency') {
    activeForm = (
      <LatencyForm
        baseUrl={baseUrl}
        config={chaosMonkeyGetData['com.networknt.chaos.LatencyAssaultHandler']}
        formType={chaosFormType}
        protocol={protocol}
        address={address}
        port={port}
      />
    );
  }

  if (loading) {
    return (
      <div>
        <CircularProgress />
      </div>
    );
  } else if (error) {
    return (
      <div>
        <pre>{JSON.stringify(error, null, 2)}</pre>
      </div>
    );
  } else {
    return (
      <Paper style={{ padding: 16, margin: 16 }}>
        <Grid
          container
          alignItems="center"
          justifyContent="center"
          spacing={2}
          direction="row"
        >
          <CssBaseline />
          <Grid item xs={6}>
            <ChaosFormSettings
              label="Assault Type"
              options={chaosAssaultTypes}
              optionDisplays={chaosAssaultTypeDisplays}
              value={chaosAssaultType}
              onChange={handleAssaultChange}
            />
          </Grid>
          <Grid item xs={6}>
            <ChaosFormSettings
              label="Form Type"
              options={chaosFormTypes}
              optionDisplays={chaosFormTypeDisplays}
              value={chaosFormType}
              onChange={handleFormTypeChange}
            />
          </Grid>
          <Grid item>{activeForm}</Grid>
        </Grid>
      </Paper>
    );
  }
}
