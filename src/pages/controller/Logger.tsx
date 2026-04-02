import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { SelectChangeEvent } from '@mui/material/Select';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs, { Dayjs } from 'dayjs';
import { useLocation, useNavigate } from 'react-router-dom';
import { useController } from '../../contexts/ControllerContext';

type LoggerEntry = {
  name: string;
  level: string;
};

type HistoryRow = {
  logger: string;
  timestamp: string;
  level: string;
  message: string;
  thread?: string;
  exception?: string;
  [key: string]: any;
};

type LiveRow = {
  timestamp: string;
  level: string;
  logger: string;
  message: string;
  thread?: string;
  exception?: string;
};

type LoggerNode = {
  runtimeInstanceId?: string;
  serviceId?: string;
  protocol?: string;
  address?: string;
  ipAddress?: string;
  port?: number;
  portNumber?: number;
  apiName?: string;
  envTag?: string;
};

const LOG_LEVELS = ['TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'FATAL', 'OFF'];
const LIVE_BUFFER_LIMIT = 1000;
const HISTORY_PRESETS = [
  { label: 'Last 5 Minutes', minutes: 5 },
  { label: 'Last 10 Minutes', minutes: 10 },
  { label: 'Last 30 Minutes', minutes: 30 },
  { label: 'Last 60 Minutes', minutes: 60 },
];

function parseDateTimeValue(value: Dayjs | null) {
  if (!value) {
    return undefined;
  }
  const parsed = value.valueOf();
  return Number.isNaN(parsed) ? undefined : parsed;
}

function formatTimestamp(value: any) {
  if (typeof value === 'number') {
    return new Date(value).toLocaleString();
  }
  if (typeof value === 'string' && /^\d+$/.test(value)) {
    return new Date(Number(value)).toLocaleString();
  }
  if (typeof value === 'string' && value) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleString();
    }
    return value;
  }
  return '';
}

function flattenHistoryContent(content: Record<string, any> | undefined): HistoryRow[] {
  if (!content || typeof content !== 'object') {
    return [];
  }

  const rows: HistoryRow[] = [];
  Object.entries(content).forEach(([loggerName, group]) => {
    const logs = Array.isArray(group?.logs) ? group.logs : [];
    logs.forEach((log: any) => {
      rows.push({
        logger: loggerName,
        timestamp: formatTimestamp(log?.timestamp),
        level: log?.level ?? '',
        message: log?.message ?? log?.logMessage ?? '',
        thread: log?.thread ?? '',
        exception: log?.exception ?? '',
        ...log,
      });
    });
  });

  rows.sort((left, right) => {
    const leftTime = new Date(left.timestamp).getTime();
    const rightTime = new Date(right.timestamp).getTime();
    return rightTime - leftTime;
  });

  return rows;
}

function tabIndexFromStateTab(rawTab: any) {
  switch (rawTab) {
    case 'config':
      return 0;
    case 'live':
      return 2;
    case 'history':
    default:
      return 1;
  }
}

function tabIndexFromPath(pathname: string) {
  if (pathname.endsWith('/loggerConfig')) {
    return 0;
  }
  if (pathname.endsWith('/logger')) {
    return 1;
  }
  if (pathname.endsWith('/logViewer') || pathname.endsWith('/logContent')) {
    return 1;
  }
  return 1;
}

export default function Logger() {
  const navigate = useNavigate();
  const location = useLocation();
  const { callTool, subscribeToNotifications } = useController();
  const stateData = (location.state as any)?.data || {};
  const node: LoggerNode = stateData.node || stateData;
  const runtimeInstanceId = node?.runtimeInstanceId;

  const [tabIndex, setTabIndex] = useState(() =>
    stateData.tab ? tabIndexFromStateTab(stateData.tab) : tabIndexFromPath(location.pathname),
  );

  useEffect(() => {
    setTabIndex(stateData.tab ? tabIndexFromStateTab(stateData.tab) : tabIndexFromPath(location.pathname));
  }, [location.pathname, stateData.tab]);

  const [loggers, setLoggers] = useState<LoggerEntry[]>([]);
  const [configFilter, setConfigFilter] = useState('');
  const [pendingLoggers, setPendingLoggers] = useState<Record<string, string>>({});
  const [newLoggers, setNewLoggers] = useState<LoggerEntry[]>([]);
  const [configLoading, setConfigLoading] = useState(true);
  const [configApplying, setConfigApplying] = useState(false);
  const [configError, setConfigError] = useState<string | null>(null);
  const [configSuccess, setConfigSuccess] = useState<string | null>(null);
  const [loggerChangedThisSession, setLoggerChangedThisSession] = useState(false);

  const [historyStart, setHistoryStart] = useState<Dayjs | null>(() =>
    dayjs(Date.now() - 5 * 60 * 1000),
  );
  const [historyEnd, setHistoryEnd] = useState<Dayjs | null>(null);
  const [historyLevel, setHistoryLevel] = useState('DEBUG');
  const [historyRows, setHistoryRows] = useState<HistoryRow[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historySearch, setHistorySearch] = useState('');
  const [historyLoggerFilter, setHistoryLoggerFilter] = useState('All');

  const [streamLevel, setStreamLevel] = useState('INFO');
  const [liveRows, setLiveRows] = useState<LiveRow[]>([]);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'connecting' | 'streaming' | 'stopped' | 'error'>('idle');
  const [streamError, setStreamError] = useState<string | null>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [liveSearch, setLiveSearch] = useState('');
  const [liveLoggerFilter, setLiveLoggerFilter] = useState('All');
  const liveActiveRef = useRef(false);
  const liveBottomRef = useRef<HTMLDivElement | null>(null);

  const fetchLoggers = async () => {
    if (!runtimeInstanceId) {
      setConfigLoading(false);
      return;
    }

    setConfigLoading(true);
    setConfigError(null);
    try {
      const result = await callTool('get_loggers', { runtimeInstanceId });
      setLoggers(Array.isArray(result) ? result : []);
      setPendingLoggers({});
      setNewLoggers([]);
    } catch (err: any) {
      setConfigError(err?.message ?? JSON.stringify(err));
    } finally {
      setConfigLoading(false);
    }
  };

  useEffect(() => {
    fetchLoggers();
  }, [runtimeInstanceId]);

  useEffect(() => {
    return subscribeToNotifications((method, params) => {
      if (method !== 'notifications/log' || !liveActiveRef.current) {
        return;
      }

      const row: LiveRow = {
        timestamp: formatTimestamp(params?.timestamp),
        level: params?.level ?? '',
        logger: params?.logger ?? '',
        message: params?.message ?? '',
        thread: params?.thread ?? '',
        exception: params?.exception ?? '',
      };

      setLiveRows((current) => {
        const next = [...current, row];
        return next.length > LIVE_BUFFER_LIMIT ? next.slice(next.length - LIVE_BUFFER_LIMIT) : next;
      });
    });
  }, [subscribeToNotifications]);

  useEffect(() => {
    if (!autoScroll) {
      return;
    }
    liveBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [autoScroll, liveRows]);

  useEffect(() => {
    return () => {
      if (liveActiveRef.current && runtimeInstanceId) {
        callTool('stop_logs', { runtimeInstanceId }).catch(() => undefined);
      }
    };
  }, [callTool, runtimeInstanceId]);

  const filteredLoggers = useMemo(() => {
    return loggers.filter((logger) =>
      logger.name.toLowerCase().includes(configFilter.toLowerCase()),
    );
  }, [configFilter, loggers]);

  const configValidationError = useMemo(() => {
    const names = new Set<string>();

    for (const logger of loggers) {
      names.add(logger.name);
    }

    for (let i = 0; i < newLoggers.length; i += 1) {
      const name = newLoggers[i].name.trim();
      if (!name) {
        return `New logger row ${i + 1} is missing a name`;
      }
      if (!newLoggers[i].level) {
        return `New logger '${name}' is missing a level`;
      }
      if (names.has(name)) {
        return `Logger '${name}' already exists`;
      }
      names.add(name);
    }

    return null;
  }, [loggers, newLoggers]);

  const hasPendingConfigChanges =
    Object.keys(pendingLoggers).length > 0 || newLoggers.length > 0;

  const historyLoggerOptions = useMemo(() => {
    const names = new Set(historyRows.map((row) => row.logger).filter(Boolean));
    return ['All', ...Array.from(names).sort()];
  }, [historyRows]);

  const filteredHistoryRows = useMemo(() => {
    const search = historySearch.trim().toLowerCase();
    return historyRows.filter((row) => {
      if (historyLoggerFilter !== 'All' && row.logger !== historyLoggerFilter) {
        return false;
      }
      if (!search) {
        return true;
      }
      const haystack = [
        row.timestamp,
        row.level,
        row.logger,
        row.message,
        row.thread,
        row.exception,
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [historyLoggerFilter, historyRows, historySearch]);

  const liveLoggerOptions = useMemo(() => {
    const names = new Set(liveRows.map((row) => row.logger).filter(Boolean));
    return ['All', ...Array.from(names).sort()];
  }, [liveRows]);

  const filteredLiveRows = useMemo(() => {
    const search = liveSearch.trim().toLowerCase();
    return liveRows.filter((row) => {
      if (liveLoggerFilter !== 'All' && row.logger !== liveLoggerFilter) {
        return false;
      }
      if (!search) {
        return true;
      }
      const haystack = [row.timestamp, row.level, row.logger, row.message, row.thread, row.exception]
        .join(' ')
        .toLowerCase();
      return haystack.includes(search);
    });
  }, [liveLoggerFilter, liveRows, liveSearch]);

  const handleExistingLevelChange = (name: string, level: string) => {
    setConfigSuccess(null);
    setPendingLoggers((current) => ({ ...current, [name]: level }));
  };

  const handleNewLoggerChange = (index: number, key: keyof LoggerEntry, value: string) => {
    setConfigSuccess(null);
    setNewLoggers((current) =>
      current.map((logger, currentIndex) =>
        currentIndex === index ? { ...logger, [key]: value } : logger,
      ),
    );
  };

  const handleAddLoggerRow = () => {
    setNewLoggers((current) => [...current, { name: '', level: 'INFO' }]);
  };

  const handleRemoveNewLogger = (index: number) => {
    setNewLoggers((current) => current.filter((_, currentIndex) => currentIndex !== index));
  };

  const handleApplyConfig = async () => {
    if (!runtimeInstanceId || configValidationError) {
      return;
    }

    const changedExisting = Object.entries(pendingLoggers).map(([name, level]) => ({ name, level }));
    const added = newLoggers.map((logger) => ({ name: logger.name.trim(), level: logger.level }));
    const updates = [...changedExisting, ...added];
    if (updates.length === 0) {
      return;
    }

    setConfigApplying(true);
    setConfigError(null);
    setConfigSuccess(null);
    try {
      await callTool('set_loggers', { runtimeInstanceId, loggers: updates });
      setConfigSuccess('Logger changes applied');
      setLoggerChangedThisSession(true);
      await fetchLoggers();
    } catch (err: any) {
      setConfigError(err?.message ?? JSON.stringify(err));
    } finally {
      setConfigApplying(false);
    }
  };

  const handleHistoryPreset = (minutes: number) => {
    setHistoryStart(dayjs(Date.now() - minutes * 60 * 1000));
    setHistoryEnd(null);
  };

  const handleFetchHistory = async () => {
    if (!runtimeInstanceId) {
      return;
    }

    const startTime = parseDateTimeValue(historyStart);
    const endTime = parseDateTimeValue(historyEnd);
    if (!startTime) {
      setHistoryError('Start time is required');
      return;
    }
    if (endTime && endTime < startTime) {
      setHistoryError('End time must be after start time');
      return;
    }

    setHistoryLoading(true);
    setHistoryError(null);
    try {
      const args: Record<string, string> = {
        runtimeInstanceId,
        startTime: String(startTime),
      };
      if (endTime) {
        args.endTime = String(endTime);
      }
      if (historyLevel) {
        args.loggerLevel = historyLevel;
      }
      const result = await callTool('get_log_content', args);
      setHistoryRows(flattenHistoryContent(result?.content));
    } catch (err: any) {
      setHistoryError(err?.message ?? JSON.stringify(err));
      setHistoryRows([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleStartStream = async () => {
    if (!runtimeInstanceId) {
      return;
    }

    setStreamStatus('connecting');
    setStreamError(null);
    try {
      await callTool('start_logs', {
        runtimeInstanceId,
        ...(streamLevel ? { level: streamLevel } : {}),
      });
      liveActiveRef.current = true;
      setStreamStatus('streaming');
    } catch (err: any) {
      liveActiveRef.current = false;
      setStreamStatus('error');
      setStreamError(err?.message ?? JSON.stringify(err));
    }
  };

  const handleStopStream = async () => {
    if (!runtimeInstanceId) {
      return;
    }

    try {
      await callTool('stop_logs', { runtimeInstanceId });
    } catch (err: any) {
      setStreamError(err?.message ?? JSON.stringify(err));
      setStreamStatus('error');
      return;
    }

    liveActiveRef.current = false;
    setStreamStatus('stopped');
  };

  const streamStatusChip = useMemo(() => {
    switch (streamStatus) {
      case 'streaming':
        return { label: 'Streaming', color: 'success' as const };
      case 'connecting':
        return { label: 'Starting', color: 'warning' as const };
      case 'stopped':
        return { label: 'Stopped', color: 'default' as const };
      case 'error':
        return { label: 'Error', color: 'error' as const };
      default:
        return { label: 'Idle', color: 'default' as const };
    }
  }, [streamStatus]);

  if (!runtimeInstanceId) {
    return (
      <Box sx={{ p: 3 }}>
        <Typography color="error">
          No runtime instance ID found. Please navigate from the Control Pane.
        </Typography>
        <Button sx={{ mt: 2 }} variant="outlined" onClick={() => navigate(-1)}>
          Go Back
        </Button>
      </Box>
    );
  }

  const serviceLabel = node.apiName || node.serviceId || 'Logger';
  const addressLabel = node.address || node.ipAddress || 'unknown';
  const portLabel = node.port || node.portNumber || 'unknown';

  return (
    <LocalizationProvider dateAdapter={AdapterDayjs}>
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h5">{serviceLabel}</Typography>
              <Typography variant="body2" color="text.secondary">
                Runtime Instance: {runtimeInstanceId}
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Endpoint: {addressLabel}:{portLabel}
              </Typography>
            </Box>
            <Stack direction="row" spacing={1} alignItems="flex-start">
              <Button variant="outlined" onClick={() => navigate(-1)}>
                Back
              </Button>
            </Stack>
          </Stack>
        </Paper>

        <Paper variant="outlined">
          <Tabs value={tabIndex} onChange={(_, value) => setTabIndex(value)}>
            <Tab label="Config" />
            <Tab label="History" />
            <Tab label="Live Stream" />
          </Tabs>
          <Divider />

          {tabIndex === 0 && (
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
                  <TextField
                    label="Filter loggers"
                    size="small"
                    value={configFilter}
                    onChange={(event) => setConfigFilter(event.target.value)}
                    sx={{ minWidth: 260 }}
                  />
                  <Stack direction="row" spacing={1}>
                    <Button variant="outlined" onClick={handleAddLoggerRow}>
                      Add Logger
                    </Button>
                    <Button variant="outlined" onClick={fetchLoggers} disabled={configLoading || configApplying}>
                      Refresh
                    </Button>
                    <Button
                      variant="contained"
                      onClick={handleApplyConfig}
                      disabled={!hasPendingConfigChanges || !!configValidationError || configApplying}
                    >
                      {configApplying ? <CircularProgress size={20} /> : 'Apply Changes'}
                    </Button>
                  </Stack>
                </Stack>

                {configValidationError && <Alert severity="warning">{configValidationError}</Alert>}
                {configError && <Alert severity="error">{configError}</Alert>}
                {configSuccess && <Alert severity="success">{configSuccess}</Alert>}

                {configLoading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                    <CircularProgress />
                  </Box>
                ) : (
                  <>
                    <TableContainer component={Paper} variant="outlined">
                      <Table size="small">
                        <TableHead>
                          <TableRow>
                            <TableCell>Logger Name</TableCell>
                            <TableCell width={180}>Current Level</TableCell>
                            <TableCell width={180}>New Level</TableCell>
                          </TableRow>
                        </TableHead>
                        <TableBody>
                          {filteredLoggers.map((logger) => (
                            <TableRow key={logger.name}>
                              <TableCell>{logger.name}</TableCell>
                              <TableCell>{logger.level}</TableCell>
                              <TableCell>
                                <Select
                                  size="small"
                                  fullWidth
                                  value={pendingLoggers[logger.name] || logger.level}
                                  onChange={(event) =>
                                    handleExistingLevelChange(logger.name, event.target.value)
                                  }
                                >
                                  {LOG_LEVELS.map((level) => (
                                    <MenuItem key={level} value={level}>
                                      {level}
                                    </MenuItem>
                                  ))}
                                </Select>
                              </TableCell>
                            </TableRow>
                          ))}
                          {filteredLoggers.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3}>No matching loggers</TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </TableContainer>

                    {newLoggers.length > 0 && (
                      <TableContainer component={Paper} variant="outlined">
                        <Table size="small">
                          <TableHead>
                            <TableRow>
                              <TableCell>New Logger Name</TableCell>
                              <TableCell width={180}>Level</TableCell>
                              <TableCell width={120}>Action</TableCell>
                            </TableRow>
                          </TableHead>
                          <TableBody>
                            {newLoggers.map((logger, index) => (
                              <TableRow key={`new-${index}`}>
                                <TableCell>
                                  <TextField
                                    size="small"
                                    fullWidth
                                    value={logger.name}
                                    onChange={(event) =>
                                      handleNewLoggerChange(index, 'name', event.target.value)
                                    }
                                  />
                                </TableCell>
                                <TableCell>
                                  <Select
                                    size="small"
                                    fullWidth
                                    value={logger.level}
                                    onChange={(event) =>
                                      handleNewLoggerChange(index, 'level', event.target.value)
                                    }
                                  >
                                    {LOG_LEVELS.map((level) => (
                                      <MenuItem key={level} value={level}>
                                        {level}
                                      </MenuItem>
                                    ))}
                                  </Select>
                                </TableCell>
                                <TableCell>
                                  <Button color="error" onClick={() => handleRemoveNewLogger(index)}>
                                    Remove
                                  </Button>
                                </TableCell>
                              </TableRow>
                            ))}
                          </TableBody>
                        </Table>
                      </TableContainer>
                    )}
                  </>
                )}
              </Stack>
            </Box>
          )}

          {tabIndex === 1 && (
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                <Stack direction="row" spacing={1} flexWrap="wrap">
                  {HISTORY_PRESETS.map((preset) => (
                    <Button
                      key={preset.minutes}
                      variant="outlined"
                      onClick={() => handleHistoryPreset(preset.minutes)}
                    >
                      {preset.label}
                    </Button>
                  ))}
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <DateTimePicker
                    label="Start Time"
                    value={historyStart}
                    onChange={(value) => setHistoryStart(value)}
                    slotProps={{ textField: { fullWidth: true } }}
                  />
                  <DateTimePicker
                    label="End Time"
                    value={historyEnd}
                    onChange={(value) => setHistoryEnd(value)}
                    slotProps={{
                      textField: {
                        fullWidth: true,
                        helperText: 'Optional. Leave blank to use current time.',
                      },
                    }}
                  />
                  <FormControl fullWidth>
                    <InputLabel id="history-level-label">Min Level</InputLabel>
                    <Select
                      labelId="history-level-label"
                      value={historyLevel}
                      label="Min Level"
                      onChange={(event: SelectChangeEvent) => setHistoryLevel(event.target.value)}
                    >
                      {LOG_LEVELS.filter((level) => level !== 'OFF').map((level) => (
                        <MenuItem key={level} value={level}>
                          {level}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button variant="contained" onClick={handleFetchHistory} disabled={historyLoading}>
                    {historyLoading ? <CircularProgress size={20} /> : 'Fetch Logs'}
                  </Button>
                </Stack>

                {historyError && <Alert severity="error">{historyError}</Alert>}

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <FormControl sx={{ minWidth: 220 }}>
                    <InputLabel id="history-logger-filter-label">Logger</InputLabel>
                    <Select
                      labelId="history-logger-filter-label"
                      value={historyLoggerFilter}
                      label="Logger"
                      onChange={(event: SelectChangeEvent) =>
                        setHistoryLoggerFilter(event.target.value)
                      }
                    >
                      {historyLoggerOptions.map((loggerName) => (
                        <MenuItem key={loggerName} value={loggerName}>
                          {loggerName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Search returned logs"
                    value={historySearch}
                    onChange={(event) => setHistorySearch(event.target.value)}
                    fullWidth
                  />
                </Stack>

                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell>Logger</TableCell>
                        <TableCell>Message</TableCell>
                        <TableCell>Thread</TableCell>
                        <TableCell>Exception</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredHistoryRows.map((row, index) => (
                        <TableRow key={`${row.logger}-${row.timestamp}-${index}`}>
                          <TableCell>{row.timestamp}</TableCell>
                          <TableCell>{row.level}</TableCell>
                          <TableCell>{row.logger}</TableCell>
                          <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{row.message}</TableCell>
                          <TableCell>{row.thread}</TableCell>
                          <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{row.exception}</TableCell>
                        </TableRow>
                      ))}
                      {filteredHistoryRows.length === 0 && !historyLoading && (
                        <TableRow>
                          <TableCell colSpan={6}>No history rows loaded</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              </Stack>
            </Box>
          )}

          {tabIndex === 2 && (
            <Box sx={{ p: 2 }}>
              <Stack spacing={2}>
                {loggerChangedThisSession && (
                  <Alert severity="warning">
                    Logger levels were changed during this session. Stopping the live stream will
                    not restore them automatically.
                  </Alert>
                )}
                {streamError && <Alert severity="error">{streamError}</Alert>}

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                  <FormControl sx={{ minWidth: 200 }}>
                    <InputLabel id="stream-level-label">Min Level</InputLabel>
                    <Select
                      labelId="stream-level-label"
                      value={streamLevel}
                      label="Min Level"
                      onChange={(event: SelectChangeEvent) => setStreamLevel(event.target.value)}
                    >
                      {LOG_LEVELS.filter((level) => level !== 'OFF').map((level) => (
                        <MenuItem key={level} value={level}>
                          {level}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <Button
                    variant="contained"
                    onClick={handleStartStream}
                    disabled={streamStatus === 'connecting' || streamStatus === 'streaming'}
                  >
                    Start Stream
                  </Button>
                  <Button
                    variant="outlined"
                    onClick={handleStopStream}
                    disabled={streamStatus !== 'streaming'}
                  >
                    Stop Stream
                  </Button>
                  <Button variant="outlined" onClick={() => setLiveRows([])}>
                    Clear
                  </Button>
                  <Button variant="text" onClick={() => setAutoScroll((current) => !current)}>
                    {autoScroll ? 'Auto-scroll On' : 'Auto-scroll Off'}
                  </Button>
                  <Chip label={streamStatusChip.label} color={streamStatusChip.color} variant="outlined" />
                </Stack>

                <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
                  <FormControl sx={{ minWidth: 220 }}>
                    <InputLabel id="live-logger-filter-label">Logger</InputLabel>
                    <Select
                      labelId="live-logger-filter-label"
                      value={liveLoggerFilter}
                      label="Logger"
                      onChange={(event: SelectChangeEvent) => setLiveLoggerFilter(event.target.value)}
                    >
                      {liveLoggerOptions.map((loggerName) => (
                        <MenuItem key={loggerName} value={loggerName}>
                          {loggerName}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  <TextField
                    label="Search streamed logs"
                    value={liveSearch}
                    onChange={(event) => setLiveSearch(event.target.value)}
                    fullWidth
                  />
                </Stack>

                <TableContainer component={Paper} variant="outlined" sx={{ maxHeight: 600 }}>
                  <Table stickyHeader size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Timestamp</TableCell>
                        <TableCell>Level</TableCell>
                        <TableCell>Logger</TableCell>
                        <TableCell>Message</TableCell>
                        <TableCell>Thread</TableCell>
                        <TableCell>Exception</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredLiveRows.map((row, index) => (
                        <TableRow key={`${row.logger}-${row.timestamp}-${index}`}>
                          <TableCell>{row.timestamp}</TableCell>
                          <TableCell>{row.level}</TableCell>
                          <TableCell>{row.logger}</TableCell>
                          <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{row.message}</TableCell>
                          <TableCell>{row.thread}</TableCell>
                          <TableCell sx={{ whiteSpace: 'pre-wrap' }}>{row.exception}</TableCell>
                        </TableRow>
                      ))}
                      {filteredLiveRows.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6}>No live logs received</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                  <div ref={liveBottomRef} />
                </TableContainer>
              </Stack>
            </Box>
          )}
        </Paper>
      </Stack>
    </Box>
    </LocalizationProvider>
  );
}
