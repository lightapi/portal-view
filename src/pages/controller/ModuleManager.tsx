import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useController } from '../../contexts/ControllerContext';

type ModuleNode = {
  runtimeInstanceId?: string;
  apiName?: string;
  address?: string;
  ipAddress?: string;
  port?: number;
  portNumber?: number;
};

export default function ModuleManager() {
  const navigate = useNavigate();
  const location = useLocation();
  const { callTool } = useController();
  const stateData = (location.state as any)?.data || {};
  const node: ModuleNode = stateData.node || stateData;
  const runtimeInstanceId = node.runtimeInstanceId;

  const [modules, setModules] = useState<string[]>([]);
  const [selected, setSelected] = useState<Record<string, boolean>>({});
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchModules = async () => {
    if (!runtimeInstanceId) {
      setLoading(false);
      setError('No runtime instance ID found. Please navigate from the Control Pane.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await callTool('get_modules', { runtimeInstanceId });
      const nextModules = Array.isArray(result?.modules) ? result.modules : [];
      setModules(nextModules);
      setSelected((current) => {
        const validModules = new Set(nextModules);
        return Object.fromEntries(
          Object.entries(current).filter(
            ([moduleName, isSelected]) => isSelected && validModules.has(moduleName),
          ),
        );
      });
    } catch (err: any) {
      setError(err?.message ?? JSON.stringify(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModules();
  }, [runtimeInstanceId]);

  const filteredModules = useMemo(() => {
    const query = filter.trim().toLowerCase();
    return modules.filter((moduleName) => moduleName.toLowerCase().includes(query));
  }, [filter, modules]);

  const selectedModules = useMemo(
    () => Object.entries(selected).filter(([, checked]) => checked).map(([name]) => name),
    [selected],
  );

  const handleReload = async (reloadAll: boolean) => {
    if (!runtimeInstanceId) {
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    try {
      const result = await callTool('reload_modules', reloadAll ? { runtimeInstanceId } : {
        runtimeInstanceId,
        modules: selectedModules,
      });
      const reloaded = Array.isArray(result?.modules) ? result.modules : [];
      setSuccess(`Reloaded ${reloaded.length} module(s)`);
      await fetchModules();
    } catch (err: any) {
      setError(err?.message ?? JSON.stringify(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h5">Module Registry</Typography>
              <Typography variant="body2" color="text.secondary">
                Runtime Instance: {runtimeInstanceId}
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Back
            </Button>
          </Stack>
        </Paper>

        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack spacing={2}>
            <Stack direction={{ xs: 'column', md: 'row' }} spacing={2}>
              <TextField
                label="Filter modules"
                value={filter}
                onChange={(event) => setFilter(event.target.value)}
                fullWidth
              />
              <Button variant="outlined" onClick={fetchModules} disabled={loading || submitting}>
                Refresh
              </Button>
              <Button
                variant="outlined"
                onClick={() => handleReload(false)}
                disabled={submitting || selectedModules.length === 0}
              >
                Reload Selected
              </Button>
              <Button variant="contained" onClick={() => handleReload(true)} disabled={submitting}>
                Reload All
              </Button>
            </Stack>

            {error && <Alert severity="error">{error}</Alert>}
            {success && <Alert severity="success">{success}</Alert>}

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              <TableContainer component={Paper} variant="outlined">
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell padding="checkbox" />
                      <TableCell>Module / Plugin Class</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {filteredModules.map((moduleName) => (
                      <TableRow key={moduleName}>
                        <TableCell padding="checkbox">
                          <Checkbox
                            checked={Boolean(selected[moduleName])}
                            onChange={(event) =>
                              setSelected((current) => ({
                                ...current,
                                [moduleName]: event.target.checked,
                              }))
                            }
                            inputProps={{ 'aria-label': `Select module ${moduleName}` }}
                          />
                        </TableCell>
                        <TableCell>{moduleName}</TableCell>
                      </TableRow>
                    ))}
                    {filteredModules.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={2}>No modules found</TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Stack>
        </Paper>
      </Stack>
    </Box>
  );
}
