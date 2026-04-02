import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import CircularProgress from '@mui/material/CircularProgress';
import { useController } from '../../contexts/ControllerContext';

export default function HealthCheck() {
  const { state } = useLocation();
  const { runtimeInstanceId } = state?.data || {};
  const { callTool } = useController();

  const [check, setCheck] = useState<any>();
  const [error, setError] = useState<any>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!runtimeInstanceId) {
      setError('No runtime instance ID provided');
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await callTool('check', { runtimeInstanceId });
        setCheck(result);
      } catch (err: any) {
        setError(err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [runtimeInstanceId, callTool]);

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
