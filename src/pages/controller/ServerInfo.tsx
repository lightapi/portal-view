import React, { useEffect, useState } from 'react';
import Cookies from 'universal-cookie';
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
          setError(data);
          setLoading(false);
        } else {
          const data = await response.json();
          setInfo(data);
          setLoading(false);
        }
      } catch (e) {
        if (!abortController.signal.aborted) {
          console.log(e);
          setLoading(false);
        }
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
