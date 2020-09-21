import React from 'react';
import CircularProgress from '@material-ui/core/CircularProgress';
import { useApiPost } from '../../hooks/useApiPost';
import { useUserState } from '../../context/UserContext';


export default function BlogDelete(props) {
	console.log(props.location.state.data);
	const id = props.location.state.data.id;
	const { host } = useUserState();
	const body = {
		host: 'lightapi.net',
		service: 'market',
		action: 'deleteBlog',
		version: '0.1.0',
		data: { id, host }
	};
	const url = '/portal/command';
	const headers = {};
	const { isLoading, data, error } = useApiPost({url, headers, body});
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
	return (
	<div>
		{wait}
	</div>
	);
}
