import React, { useState } from 'react';
import PropTypes from 'prop-types';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
  
export default function LogContent(props) {
	console.log("props = ", props);
	console.log("data = ", props.location.state.data);
	const data = props.location.state.data;
    return (
        <div>
            <p>This should be changed to multiple tabs with pagination.</p>
            <pre>{ JSON.stringify(data, null, 2) }</pre>
        </div>
    );
}
