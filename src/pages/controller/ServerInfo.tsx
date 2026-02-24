import React, { useEffect, useState } from 'react';
import fetchClient from '../../utils/fetchClient';
import CircularProgress from '@mui/material/CircularProgress';

export default function ServerInfo(props) {
  const node = props.location.state.data.node;
  const protocol = props.location.state.data.protocol;
  const address = props.location.state.data.address;
  const port = props.location.state.data.port;
  const baseUrl = props.location.state.data.baseUrl;

  const [info, setInfo] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(true);

  /* build query params */
  var url = new URL(baseUrl + '/services/info'),
    params = { protocol: protocol, port: port, address: address };
  Object.keys(params).forEach((key) =>
    url.searchParams.append(key, params[key])
  );

  useEffect(() => {
    const abortController = new AbortController();
    const fetchData = async () => {
      setLoading(true);
      try {
        const json = await fetchClient(url.toString());
        setInfo(json);
        setLoading(false);
      } catch (error) {
        setError(error);
        setLoading(false);
      }
    };

    fetchData();

    return () => {
      abortController.abort();
    };
  }, []);
  let wait;
  if (loading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    wait = <pre>{info ? JSON.stringify(info, null, 2) : error}</pre>;
  }
  return <div>{wait}</div>;
}
