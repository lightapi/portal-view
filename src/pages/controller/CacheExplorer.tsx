import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import DeleteSweepIcon from '@mui/icons-material/DeleteSweep';
import { useLocation, useNavigate } from 'react-router-dom';
import { useController } from '../../contexts/ControllerContext';

type CacheNode = {
  runtimeInstanceId?: string;
};

type CacheEntry = {
  key: string;
  value: any;
};

const PAGE_SIZE = 20;

export default function CacheExplorer() {
  const navigate = useNavigate();
  const location = useLocation();
  const { callTool } = useController();
  const stateData = (location.state as any)?.data || {};
  const node: CacheNode = stateData.node || stateData;
  const runtimeInstanceId = node.runtimeInstanceId;

  const [caches, setCaches] = useState<string[]>([]);
  const [selectedCache, setSelectedCache] = useState<string | null>(null);
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [search, setSearch] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [loadingCaches, setLoadingCaches] = useState(true);
  const [loadingEntries, setLoadingEntries] = useState(false);
  const [clearingCache, setClearingCache] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const fetchCaches = async () => {
    if (!runtimeInstanceId) {
      setLoadingCaches(false);
      setError('No runtime instance ID found. Please navigate from the Control Pane.');
      return;
    }
    setLoadingCaches(true);
    setError(null);
    setNotice(null);
    try {
      const result = await callTool('list_caches', { runtimeInstanceId });
      setCaches(Array.isArray(result?.caches) ? result.caches : []);
    } catch (err: any) {
      setError(err?.message ?? JSON.stringify(err));
    } finally {
      setLoadingCaches(false);
    }
  };

  const fetchEntries = async (cacheName: string) => {
    if (!runtimeInstanceId) {
      return;
    }
    setLoadingEntries(true);
    setError(null);
    setNotice(null);
    try {
      const result = await callTool('get_cache_entries', { runtimeInstanceId, name: cacheName });
      const rawEntries = result?.entries && typeof result.entries === 'object' ? result.entries : {};
      const normalizedEntries = Object.entries(rawEntries).map(([key, value]) => ({ key, value }));
      setEntries(normalizedEntries);
      setSelectedCache(cacheName);
      setPageIndex(0);
    } catch (err: any) {
      setError(err?.message ?? JSON.stringify(err));
      setEntries([]);
      setSelectedCache(null);
    } finally {
      setLoadingEntries(false);
    }
  };

  const clearSelectedCache = async () => {
    if (!runtimeInstanceId || !selectedCache) {
      return;
    }
    const cacheName = selectedCache;
    setClearingCache(true);
    setError(null);
    setNotice(null);
    try {
      const result = await callTool('clear_cache', { runtimeInstanceId, name: cacheName });
      if (result?.supported === false || result?.status === 'unsupported') {
        setError(result?.message ?? `Cache ${cacheName} cannot be cleared on this runtime instance.`);
        return;
      }
      if (result?.status && result.status !== 'success') {
        setError(result?.message ?? `Failed to clear cache ${cacheName}.`);
        return;
      }
      await fetchEntries(cacheName);
      const beforeSize = typeof result?.beforeSize === 'number' ? result.beforeSize : null;
      const afterSize = typeof result?.afterSize === 'number' ? result.afterSize : null;
      const sizeDetails = beforeSize !== null && afterSize !== null
        ? ` Entries: ${beforeSize} -> ${afterSize}.`
        : '';
      setNotice(`Cleared cache ${cacheName}.${sizeDetails}`);
    } catch (err: any) {
      setError(err?.message ?? JSON.stringify(err));
    } finally {
      setClearingCache(false);
      setClearDialogOpen(false);
    }
  };

  useEffect(() => {
    fetchCaches();
  }, [runtimeInstanceId]);

  const filteredEntries = useMemo(() => {
    const query = search.trim().toLowerCase();
    return entries.filter((entry) => {
      if (!query) {
        return true;
      }
      const haystack = `${entry.key} ${JSON.stringify(entry.value)}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [entries, search]);

  const pagedEntries = useMemo(() => {
    const start = pageIndex * PAGE_SIZE;
    return filteredEntries.slice(start, start + PAGE_SIZE);
  }, [filteredEntries, pageIndex]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));

  useEffect(() => {
    const maxPageIndex = Math.max(0, totalPages - 1);
    if (pageIndex > maxPageIndex) {
      setPageIndex(maxPageIndex);
    }
  }, [pageIndex, totalPages]);

  return (
    <Box sx={{ p: 2 }}>
      <Stack spacing={2}>
        <Paper variant="outlined" sx={{ p: 2 }}>
          <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} justifyContent="space-between">
            <Box>
              <Typography variant="h5">Cache Explorer</Typography>
              <Typography variant="body2" color="text.secondary">
                Runtime Instance: {runtimeInstanceId}
              </Typography>
            </Box>
            <Button variant="outlined" onClick={() => navigate(-1)}>
              Back
            </Button>
          </Stack>
        </Paper>

        {error && <Alert severity="error">{error}</Alert>}
        {notice && <Alert severity="success">{notice}</Alert>}

        <Stack direction={{ xs: 'column', lg: 'row' }} spacing={2}>
          <Paper variant="outlined" sx={{ p: 2, minWidth: 280 }}>
            <Stack spacing={1}>
              <Stack direction="row" spacing={1}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  Caches
                </Typography>
                <Button variant="outlined" size="small" onClick={fetchCaches} disabled={loadingCaches}>
                  Refresh
                </Button>
              </Stack>
              {loadingCaches ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                  <CircularProgress />
                </Box>
              ) : (
                caches.map((cacheName) => (
                  <Button
                    key={cacheName}
                    variant={selectedCache === cacheName ? 'contained' : 'text'}
                    onClick={() => fetchEntries(cacheName)}
                    sx={{ justifyContent: 'flex-start' }}
                  >
                    {cacheName}
                  </Button>
                ))
              )}
            </Stack>
          </Paper>

          <Paper variant="outlined" sx={{ p: 2, flexGrow: 1 }}>
            <Stack spacing={2}>
              <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems={{ md: 'center' }}>
                <Typography variant="h6" sx={{ flexGrow: 1 }}>
                  {selectedCache ? `Entries: ${selectedCache}` : 'Select a cache'}
                </Typography>
                <TextField
                  label="Search entries"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  fullWidth
                />
                <Button
                  color="error"
                  disabled={!selectedCache || loadingEntries || clearingCache}
                  startIcon={clearingCache ? <CircularProgress color="inherit" size={16} /> : <DeleteSweepIcon />}
                  variant="outlined"
                  onClick={() => setClearDialogOpen(true)}
                  sx={{ flexShrink: 0 }}
                >
                  Clear
                </Button>
              </Stack>

              {loadingEntries ? (
                <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}>
                  <CircularProgress />
                </Box>
              ) : (
                <TableContainer component={Paper} variant="outlined">
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>Key</TableCell>
                        <TableCell>Value</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {pagedEntries.map((entry) => (
                        <TableRow key={entry.key}>
                          <TableCell sx={{ verticalAlign: 'top', whiteSpace: 'nowrap' }}>{entry.key}</TableCell>
                          <TableCell sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                            {JSON.stringify(entry.value, null, 2)}
                          </TableCell>
                        </TableRow>
                      ))}
                      {pagedEntries.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2}>No cache entries loaded</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}

              {selectedCache && filteredEntries.length > 0 && (
                <Stack direction="row" spacing={1} justifyContent="flex-end">
                  <Button
                    variant="outlined"
                    disabled={pageIndex === 0}
                    onClick={() => setPageIndex((current) => Math.max(0, current - 1))}
                  >
                    Previous
                  </Button>
                  <Typography sx={{ alignSelf: 'center' }}>
                    Page {pageIndex + 1} / {totalPages}
                  </Typography>
                  <Button
                    variant="outlined"
                    disabled={pageIndex >= totalPages - 1}
                    onClick={() => setPageIndex((current) => Math.min(totalPages - 1, current + 1))}
                  >
                    Next
                  </Button>
                </Stack>
              )}
            </Stack>
          </Paper>
        </Stack>
      </Stack>

      <Dialog
        open={clearDialogOpen}
        onClose={() => {
          if (!clearingCache) {
            setClearDialogOpen(false);
          }
        }}
        maxWidth="xs"
        fullWidth
      >
        <DialogTitle>Clear Cache</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Clear all entries from {selectedCache}?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setClearDialogOpen(false)} disabled={clearingCache}>
            Cancel
          </Button>
          <Button
            color="error"
            onClick={clearSelectedCache}
            disabled={clearingCache}
            startIcon={clearingCache ? <CircularProgress color="inherit" size={16} /> : <DeleteSweepIcon />}
            variant="contained"
          >
            Clear
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
