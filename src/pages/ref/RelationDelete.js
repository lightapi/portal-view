import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useApiPost } from '../../hooks/useApiPost';

export default function RelationDelete(props) {
  console.log(props.location.state.data);
  const relationId = props.location.state.data.relationId;
  const valueIdFrom = props.location.state.data.valueIdFrom;
  const valueIdTo = props.location.state.data.valueIdTo;
  const body = {
    host: 'lightapi.net',
    service: 'ref',
    action: 'deleteRelation',
    version: '0.1.0',
    data: { relationId, valueIdFrom, valueIdTo },
  };
  const url = '/portal/command';
  const headers = {};
  const { isLoading, data, error } = useApiPost({ url, headers, body });
  console.log(isLoading, data, error);
  let wait;
  if (isLoading) {
    wait = (
      <div>
        <CircularProgress />
      </div>
    );
  } else {
    wait = (
      <div>
        <pre>{data ? JSON.stringify(data, null, 2) : error}</pre>
      </div>
    );
  }

  return <div>{wait}</div>;
}
