import React, { useEffect, useRef, useState } from 'react';
import Divider from '@mui/material/Divider';
import Paper from '@mui/material/Paper';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import ListItemIcon from '@mui/material/ListItemIcon';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Typography from '@mui/material/Typography';
import PermDataSettingIcon from '@mui/icons-material/PermDataSetting';
import GetAppIcon from '@mui/icons-material/GetApp';
import ShortcutIcon from '@mui/icons-material/Shortcut';
import { useLocation, useNavigate } from 'react-router-dom';
import { useController } from '../../contexts/ControllerContext';

export default function Logger() {
  const navigate = useNavigate();
  const location = useLocation();
  const { node } = (location.state as any)?.data || {};
  const runtimeInstanceId = node?.runtimeInstanceId;
  const { callTool } = useController();

  const [start, setStart] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<any>(null);
  const firstRender = useRef(true);

  const logRetrieval = async () => {
    if (!runtimeInstanceId) return;
    setLoading(true);
    setError(null);
    try {
      let startMilli = Date.now() - 1000 * (60 * start);
      const data = await callTool('get_log_content', {
        runtimeInstanceId,
        startTime: startMilli.toString(),
        loggerLevel: 'DEBUG'
      });
      navigate('/app/controller/logContent', { state: { data } });
    } catch (e: any) {
      console.error(e);
      setError(e?.message ?? JSON.stringify(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    if (start > 0) {
      logRetrieval();
    }
  }, [start]);

  const handleLevel = (minutes: number) => {
    setStart(minutes);
  };

  const handleLoggerConfig = () => {
    navigate('/app/controller/loggerConfig', { state: location.state });
  };

  const handleLogRetrieval = () => {
    navigate('/app/form/logRetrieval', { state: { data: { ...node } } });
  };

  if (!runtimeInstanceId) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">No runtime instance ID found. Please navigate from the Control Pane.</Typography>
        {import.meta.env.DEV && (
          <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
            <pre>{JSON.stringify(location.state, null, 2)}</pre>
          </Paper>
        )}
        <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate(-1)}>Go Back</Button>
      </Box>
    );
  }

  return (
    <Box sx={{ position: 'relative' }}>
      <Paper sx={{ width: 320, maxWidth: '100%' }}>
        <MenuList>
          <MenuItem onClick={() => handleLevel(5)} disabled={loading}>
            <ListItemIcon>
              <ShortcutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Last 5 Minutes</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleLevel(10)} disabled={loading}>
            <ListItemIcon>
              <ShortcutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Last 10 Minutes</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleLevel(30)} disabled={loading}>
            <ListItemIcon>
              <ShortcutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Last 30 Minutes</ListItemText>
          </MenuItem>
          <MenuItem onClick={() => handleLevel(60)} disabled={loading}>
            <ListItemIcon>
              <ShortcutIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Last 60 Minutes</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLogRetrieval} disabled={loading}>
            <ListItemIcon>
              <GetAppIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Log Retrieval</ListItemText>
          </MenuItem>
          <Divider />
          <MenuItem onClick={handleLoggerConfig} disabled={loading}>
            <ListItemIcon>
              <PermDataSettingIcon fontSize="small" />
            </ListItemIcon>
            <ListItemText>Logger Config</ListItemText>
          </MenuItem>
        </MenuList>
      </Paper>
      {loading && (
        <Box sx={{ 
          position: 'absolute', 
          top: 0, left: 0, right: 0, bottom: 0, 
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          bgcolor: 'rgba(255,255,255,0.7)',
          zIndex: 1
        }}>
          <CircularProgress />
        </Box>
      )}
      {error && (
        <Typography color="error" sx={{ mt: 1, px: 2 }}>{error}</Typography>
      )}
    </Box>
  );
}
