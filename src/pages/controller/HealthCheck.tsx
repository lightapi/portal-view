import React, { useEffect, useState } from 'react';
import Cookies from 'universal-cookie';
import CircularProgress from '@mui/material/CircularProgress';

export default function HealthCheck(props) {
  console.log(props.location.state.data);
  const id = props.location.state.data.id;

  const [check, setCheck] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(true);

  const url = '/services/check/' + id;
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
          console.log(data);
          setError(data);
          setLoading(false);
        } else {
          const data = await response.json();
          console.log(data);
          setCheck(data);
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

  console.log(loading, check, error);

  let wait;
  if (loading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    wait = <pre>{check ? JSON.stringify(check, null, 2) : error}</pre>;
  }

  return <div>{wait}</div>;
}
