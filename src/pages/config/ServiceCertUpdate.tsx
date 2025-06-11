import CircularProgress from '@mui/material/CircularProgress';
import React from 'react';
import { useApiPut } from '../../hooks/useApiPut';

export default function ServiceFileUpdate(props) {
	console.log(props);
	const body = props.location.state.data;
	console.log(body);
	const url = '/config-server/configs/service/cert';
	const headers = {};
	const { isLoading, data, error } = useApiPut({url, headers, body});
  	console.log(isLoading, data, error);
	let wait;
	if(isLoading) {
		wait = <div><CircularProgress/></div>;
	} else {
		wait = (
		<div>
	    	<pre>{ data ? JSON.stringify(data, null, 2) : error }</pre>
		</div>
		)  
	}	
  return <div>{wait}</div>;
}
