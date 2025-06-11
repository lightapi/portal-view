import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useApiDelete } from '../../hooks/useApiDelete';

export default function ServiceFileDelete(props) {
  console.log(props.location.state.data);
  const sid = props.location.state.data.file.sid;
  const filename = props.location.state.data.file.filename;

  const url = '/config-server/configs/service/file?sid=' + sid + "&filename=" + filename;
  const headers = {};
  const { isLoading, data, error } = useApiDelete({ url, headers });
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
        <pre>{error ? error : "Record deleted"}</pre>
      </div>
    );
  }
  return <div>{wait}</div>;
}
