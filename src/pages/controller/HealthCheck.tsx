import React, { useEffect, useState } from 'react';
import fetchClient from '../../utils/fetchClient';
import CircularProgress from '@mui/material/CircularProgress';

export default function HealthCheck(props) {
  console.log(props.location.state.data);
  const id = props.location.state.data.id;

  const [check, setCheck] = useState();
  const [error, setError] = useState();
  const [loading, setLoading] = useState(true);

  const url = '/services/check/' + id;
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const json = await fetchClient(url);
        setCheck(json);
        setLoading(false);
      } catch (error) {
        console.log(error);
        setError(error);
        setLoading(false);
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
