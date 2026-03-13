import React, { useState, useEffect, useCallback, useMemo, ReactNode } from 'react';
import { useTheme } from '@mui/material/styles';
import { useLocation } from 'react-router-dom';
import {
  Grid, Card, CardHeader, CardContent, Typography, FormControl, FormControlLabel, FormLabel, RadioGroup, Radio,
  TextField, InputLabel, Select, MenuItem, IconButton, Tooltip, Box, SelectChangeEvent
} from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import RefreshIcon from '@mui/icons-material/Refresh';

import { AgGridReact } from 'ag-grid-react';
import { ColDef } from 'ag-grid-community';
import fetchClient from '../../utils/fetchClient';
import 'ag-grid-community/styles/ag-grid.css'
import 'ag-grid-community/styles/ag-theme-alpine.css'
import dayjs, { Dayjs } from 'dayjs';

interface NodeData {
    protocol: string;
    address: string;
    port: number;
    apiName?: string;
}

interface Logger {
    name: string;
    level: string;
}

interface LogEntry {
    timestamp: string;
    logName: string;
    level: string;
    logMessage: string;
    thread: string;
    correlationId: string;
    serviceId: string;
    class: string;
    lineNumber: string;
    method: string;
}

const LogViewer: React.FC = () => {
    const theme = useTheme() as any;
    const location = useLocation();
    const data = (location.state as any)?.data;
    const node: NodeData = data?.node || {};

    const logLevels = ['All', 'ERROR', 'WARN', 'INFO', 'DEBUG', 'TRACE'];
    const timePresets = [
      { label: '1m', seconds: 60 },
      { label: '5m', seconds: 300 },
      { label: '10m', seconds: 600 },
      { label: '30m', seconds: 1800 },
      { label: '1h', seconds: 3600 },
      { label: '1d', seconds: 86400 },
      { label: '1w', seconds: 604800 },
    ];

    const [logNames, setLogNames] = useState<Logger[]>([]);
    const [logName, setLogName] = useState('All');
    const [logLevel, setLogLevel] = useState('All');
    const [from, setFrom] = useState<Dayjs | null>(dayjs());
    const [to, setTo] = useState<Dayjs | null>(dayjs());
    const [preset, setPreset] = useState<string | null>(null);
    const [logData, setLogData] = useState<LogEntry[]>([]);

    const defaultColDef = useMemo<ColDef>(() => ({
      flex: 1,
      editable: false,
      sortable: true,
      resizable: true,
    }), []);

    const columnDefs = useMemo<ColDef<LogEntry>[]>(() => [
      { field: 'timestamp', headerName: 'Time', cellStyle: { textAlign: 'left' }, minWidth: 200 },
      { field: 'logName', headerName: 'Log Name', cellStyle: { textAlign: 'left' } },
      { field: 'level', headerName: 'Log Level', cellStyle: { textAlign: 'left' } },
      { field: 'logMessage', headerName: 'Log Message', cellStyle: { textAlign: 'left' }, minWidth: 400 },
      { field: 'thread', headerName: 'Thread', cellStyle: { textAlign: 'left' } },
      { field: 'correlationId', headerName: 'Correlation ID', cellStyle: { textAlign: 'left' } },
      { field: 'serviceId', headerName: 'Service ID', cellStyle: { textAlign: 'left' } },
      { field: 'class', headerName: 'Class', cellStyle: { textAlign: 'left' } },
      { field: 'lineNumber', headerName: 'Line #', cellStyle: { textAlign: 'left' } },
      { field: 'method', headerName: 'Method', cellStyle: { textAlign: 'left' } },
    ], []);

    useEffect(() => {
        const fetchLogNames = async () => {
            if (!node.protocol) return;
            try {
                const { protocol, address, port } = node;
                const result = await fetchClient(`/services/logger?protocol=${protocol}&address=${address}&port=${port}`);
                setLogNames(result || []);
            } catch (error) {
                setLogNames([]);
            }
        };
        fetchLogNames();
    }, [node]);

    const onChangeLogName = (event: SelectChangeEvent) => {
        setLogName(event.target.value);
    };

    const onChangeLogLevel = (event: SelectChangeEvent) => {
        setLogLevel(event.target.value);
    };

    const onChangeFrom = (val: Dayjs | null) => {
        setFrom(val);
        setPreset(null);
    };

    const onChangeTo = (val: Dayjs | null) => {
        setTo(val);
        setPreset(null);
    };

    const onChangePreset = (event: React.ChangeEvent<HTMLInputElement>) => {
        setPreset(event.target.value);
    };

    const onClickRefresh = useCallback(async () => {
        const { protocol, address, port } = node;
        const startTime = preset ? Date.now() - 1000 * parseInt(preset) : (from ? from.valueOf() : Date.now());
        const endTime = preset ? Date.now() : (to ? to.valueOf() : Date.now());

        try {
            const data = await fetchClient('/services/logger/content', {
                method: 'POST',
                body: JSON.stringify({
                    protocol,
                    address,
                    port,
                    startTime: startTime.toString(),
                    endTime: endTime.toString(),
                    loggerName: logName === 'All' ? undefined : logName,
                    loggerLevel: logLevel === 'All' ? 'TRACE' : logLevel,
                })
            });

            const processedData: LogEntry[] = Object.entries(data).reduce((a: LogEntry[], [k, v]: [string, any]) => 
                a.concat((v.logs || []).map((l: any) => ({ ...l, logName: k }))), []);
            setLogData(processedData);
        } catch (error) {
            setLogData([]);
        }
    }, [node, from, to, preset, logName, logLevel]);

    return (
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <Grid container spacing={2} sx={{ p: 2 }}>
          <Grid size={4} />
          <Grid size={4}>
            <Card elevation={2} sx={{ backgroundColor: theme?.palette?.tertiary?.light, width: '100%' }}>
              <CardHeader title={<Typography variant='h6' sx={{ textAlign: 'center' }}>{node?.apiName || 'Unknown API'}</Typography>} />
            </Card>
          </Grid>
          <Grid size={4} />
          <Grid size={12}>
            <Card elevation={2} sx={{ backgroundColor: theme?.palette?.tertiary?.light, width: '100%' }}>
              <CardHeader title={<Typography variant='h6'>Filters</Typography>} />
              <CardContent>
                <Grid container spacing={1} alignItems="center">
                  <Grid size={{ xs: 12, md: 2 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id='log-name-label'>Log Name</InputLabel>
                      <Select
                        labelId='log-name-label-id'
                        id='log-name-id'
                        value={logName}
                        onChange={onChangeLogName}
                        label='Log Name'
                      >
                        <MenuItem key={0} value={'All'}>All</MenuItem>
                        {logNames.map((l, i) => (
                          <MenuItem key={i + 1} value={l.name}>{l.name}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>
                  <Grid size={{ xs: 12, md: 1 }}>
                    <FormControl fullWidth size="small">
                      <InputLabel id='log-level-label'>Log Level</InputLabel>
                      <Select
                        labelId='log-level-label-id'
                        id='log-level-id'
                        value={logLevel}
                        onChange={onChangeLogLevel}
                        label='Log Level'
                      >
                        {logLevels.map((level, i) => (
                          <MenuItem key={i} value={level}>{level}</MenuItem>
                        ))}
                      </Select>
                    </FormControl>
                  </Grid>

                  <Grid size={{ xs: 12, md: 2 }}>
                    <DateTimePicker
                      label='From'
                      value={from}
                      onChange={onChangeFrom}
                      slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 2 }}>
                    <DateTimePicker
                      label='To'
                      value={to}
                      onChange={onChangeTo}
                      slotProps={{ textField: { size: 'small', fullWidth: true } }}
                    />
                  </Grid>

                  <Grid size={{ xs: 12, md: 4 }}>
                    <Card elevation={1} sx={{ backgroundColor: theme?.palette?.tertiary?.light, width: '100%', borderRadius: 2, p: 1 }}>
                      <FormControl component="fieldset" fullWidth>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                            <FormLabel component='legend' sx={{ mb: 0 }}><Typography variant='body2' sx={{ fontWeight: 600 }}>Last</Typography></FormLabel>
                            <RadioGroup
                                row
                                value={preset || ''}
                                onChange={onChangePreset}
                            >
                                {timePresets.map((p, i) => (
                                    <FormControlLabel
                                        key={i}
                                        value={p.seconds.toString()}
                                        control={<Radio sx={{ '& .MuiSvgIcon-root': { fontSize: 14 }, p: 0.5 }} />}
                                        label={<Typography variant='body2'>{p.label}</Typography>}
                                        labelPlacement='top'
                                    />
                                ))}
                            </RadioGroup>
                        </Box>
                      </FormControl>
                    </Card>
                  </Grid>

                  <Grid size={{ xs: 12, md: 1 }}>
                    <Tooltip title="Refresh">
                      <IconButton onClick={onClickRefresh}>
                        <RefreshIcon sx={{ color: 'green', fontSize: 32 }} />
                      </IconButton>
                    </Tooltip>
                  </Grid>
                </Grid>

              </CardContent>
            </Card>
          </Grid>
          <Grid size={12}>
            <Card elevation={2} sx={{ backgroundColor: theme?.palette?.tertiary?.light, width: '100%' }}>
              <CardHeader title={<Typography variant='h6'>Logs</Typography>} />
              <CardContent>
                <Box
                  className="ag-theme-alpine"
                  sx={{
                    height: '500px',
                    width: '100%',
                  }}
                >
                  <AgGridReact
                    columnDefs={columnDefs}
                    defaultColDef={defaultColDef}
                    rowData={logData}
                    tooltipShowDelay={0}
                    enableCellTextSelection={true}
                  />
                </Box>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      </LocalizationProvider>
    );
};

export default LogViewer;
