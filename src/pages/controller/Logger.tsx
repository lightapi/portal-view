import React, { useEffect, useRef, useState } from 'react';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import PermDataSettingIcon from '@mui/icons-material/PermDataSetting';
import GetAppIcon from '@mui/icons-material/GetApp';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import Cookies from 'universal-cookie';
import { useApiPost } from '../../hooks/useApiPost';



export default function Logger(props) {
    console.log("props = ", props);
	  console.log("node = ", props.location.state.data.node);
	  const node = props.location.state.data.node;
    const [start, setStart] = useState(0);
    const [data, setData] = useState(null);
    const [error, setError] = useState(null);
    const firstRender = useRef(true);

    const logRetrieval = async (url, headers) => {
      try {
        let startMilli = Date.now() - 1000 * (60 * start); 
        const response = await fetch(url, { method: 'POST', headers, credentials: 'include', 
          body: JSON.stringify({
            ...node,
            startTime: startMilli.toString(),
            loggerLevel: 'DEBUG'
          })
        });
        if (!response.ok) {
          const error = await response.json();
          setError(error.description);
          setData(null);
        } else {
          const data = await response.json();
          setData(data);
        }
      } catch (e) {
        console.log(e);
        setError(e);
        setData(null);
      }
    };

    useEffect(() => {
      if(firstRender.current) {
        firstRender.current = false;
        return;
      }
      const cookies = new Cookies();
      const headers = { 'X-CSRF-TOKEN': cookies.get('csrf'), 'Content-Type': 'application/json' };
      const url = '/services/logger/content';
      console.log('logRetrieval is called.');
      logRetrieval(url, headers);
    }, [start]);

    useEffect(() => {
      if(data) {
        props.history.push({ pathname: '/app/controller/logContent', state: { data } });
      }
    }, [data]);
    
    const handle5Minutes = () => {
        console.log("handle5Minutes is called");
        setStart(5);
    }

    const handle10Minutes = () => {
        console.log("handle10Minutes is called");
        setStart(10);
    }

    const handle30Minutes = () => {
        console.log("handle30Minutes is called");
        setStart(30);
    }

    const handle60Minutes = () => {
        console.log("handle60Minutes is called");
        setStart(60);
    }

    const handleLoggerConfig = () => {
        console.log("handleLoggerConfig is called");
        props.history.push({ pathname: '/app/controller/loggerConfig', state: { data: props.location.state.data } });
    }

    const handleLogRetrieval = () => {
        console.log("handleLogRetrieval is called");
        props.history.push({ pathname: '/app/form/logRetrieval', state: { data: {...node} } });
    }
    
    return (
        <Paper sx={{ width: 320, maxWidth: '100%' }}>
        <MenuList>
          <MenuItem onClick={handle5Minutes}>
            <ListItemIcon>
              <ShortcutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Last 5 Minutes</ListItemText>
          </MenuItem>
          <MenuItem onClick={handle10Minutes}>
            <ListItemIcon>
              <ShortcutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Last 10 Minutes</ListItemText>
          </MenuItem>
          <MenuItem onClick={handle30Minutes}>
            <ListItemIcon>
              <ShortcutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Last 30 Minutes</ListItemText>
          </MenuItem>
          <MenuItem onClick={handle60Minutes}>
            <ListItemIcon>
              <ShortcutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Last 60 Minutes</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogRetrieval}>
            <ListItemIcon>
              <GetAppIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Log Retrieval</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLoggerConfig}>
            <ListItemIcon>
              <PermDataSettingIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Logger Config</ListItemText>
          </MenuItem>
        </MenuList>
      </Paper>
    );
}
