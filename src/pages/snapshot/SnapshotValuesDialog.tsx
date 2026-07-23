import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Stack,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import downloadText from '../../utils/downloadText';
import { getConfigSnapshotValues, verifySnapshotYamlDigest } from './configSnapshotValuesApi';
import type { ConfigSnapshotSummary, SnapshotValues } from './configSnapshotValues.types';
import { snapshotValuesFilename } from './snapshotValuesFilename';

type SnapshotValuesDialogProps = {
  hostId: string | null | undefined;
  snapshot: ConfigSnapshotSummary | null;
  onClose: () => void;
};

export default function SnapshotValuesDialog({ hostId, snapshot, onClose }: SnapshotValuesDialogProps) {
  const navigate = useNavigate();
  const [values, setValues] = useState<SnapshotValues | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setValues(null);
    setError(null);
    setCopied(false);
    if (!snapshot || !hostId) return;
    const controller = new AbortController();
    setLoading(true);

    getConfigSnapshotValues({
      hostId,
      snapshotIds: [snapshot.snapshotId],
      include: ['yaml'],
      signal: controller.signal,
    }).then(async response => {
      const loaded = response.snapshots[0];
      if (!loaded || loaded.snapshotId !== snapshot.snapshotId || typeof loaded.yaml !== 'string') {
        throw new Error('The server returned an incomplete snapshot.');
      }
      if (!await verifySnapshotYamlDigest(loaded.yaml, loaded.sha256)) {
        throw new Error('The snapshot digest did not match the returned YAML.');
      }
      if (!controller.signal.aborted) setValues(loaded);
    }).catch((caught: unknown) => {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      if (!controller.signal.aborted) {
        setError(caught instanceof Error ? caught.message : 'Unable to load snapshot values.');
      }
    }).finally(() => {
      if (!controller.signal.aborted) setLoading(false);
    });

    return () => controller.abort();
  }, [hostId, snapshot]);

  const filename = useMemo(() => values ? snapshotValuesFilename(values) : '', [values]);
  const yaml = values?.yaml;

  const copy = async () => {
    if (yaml === undefined) return;
    try {
      await navigator.clipboard.writeText(yaml);
      setCopied(true);
      setError(null);
    } catch {
      setError('Unable to copy values.yml to the clipboard.');
    }
  };

  const download = () => {
    if (yaml === undefined) return;
    try {
      downloadText(filename, yaml, 'application/yaml;charset=utf-8');
      setError(null);
    } catch {
      setError('Unable to download values.yml.');
    }
  };

  const openProperties = () => {
    if (!snapshot) return;
    onClose();
    navigate('/app/config/configSnapshotProperty', { state: { data: snapshot } });
  };

  return (
    <Dialog open={Boolean(snapshot)} onClose={onClose} fullWidth maxWidth="lg">
      <DialogTitle>Canonical values.yml</DialogTitle>
      <DialogContent dividers>
        {snapshot && (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              <Chip label={snapshot.instanceName || snapshot.instanceId} />
              <Chip label={snapshot.snapshotTs} />
              <Chip label={`${values?.propertyCount ?? snapshot.propertyCount ?? 0} properties`} />
              {values?.sha256 && <Chip label={values.sha256} variant="outlined" />}
            </Stack>
            <Link component="button" type="button" onClick={openProperties} sx={{ alignSelf: 'flex-start' }}>
              Open Snapshot Properties
            </Link>
            {loading && (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <CircularProgress size={20} />
                <Typography>Loading complete snapshot values…</Typography>
              </Box>
            )}
            {error && <Alert severity="error">{error}</Alert>}
            {!loading && values && values.propertyCount === 0 && (
              <Alert severity="info">This snapshot has no runtime Config properties. Its values.yml is empty.</Alert>
            )}
            {yaml !== undefined && yaml !== '' && (
              <Box
                component="pre"
                aria-label="values.yml preview"
                sx={{
                  m: 0,
                  p: 2,
                  maxHeight: '60vh',
                  overflow: 'auto',
                  bgcolor: 'grey.900',
                  color: 'grey.100',
                  borderRadius: 1,
                  fontFamily: 'monospace',
                  fontSize: 13,
                }}
              >
                {yaml}
              </Box>
            )}
          </Stack>
        )}
      </DialogContent>
      <DialogActions>
        {copied && <Typography color="success.main">Copied</Typography>}
        <Button onClick={copy} disabled={yaml === undefined} startIcon={<ContentCopyIcon />}>
          Copy
        </Button>
        <Button onClick={download} disabled={yaml === undefined} startIcon={<DownloadIcon />}>
          Download
        </Button>
        <Button onClick={onClose}>Close</Button>
      </DialogActions>
    </Dialog>
  );
}
