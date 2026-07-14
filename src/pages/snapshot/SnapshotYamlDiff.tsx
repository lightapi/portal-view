import { useEffect, useRef, useState } from 'react';
import { Alert, Box, Button, CircularProgress, FormControlLabel, Stack, Switch, Typography } from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DownloadIcon from '@mui/icons-material/Download';
import NavigateBeforeIcon from '@mui/icons-material/NavigateBefore';
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
import { MergeView, goToNextChunk, goToPreviousChunk } from '@codemirror/merge';
import downloadText from '../../utils/downloadText';
import { getConfigSnapshotValues, verifySnapshotYamlDigest } from './configSnapshotValuesApi';
import type { SnapshotValues } from './configSnapshotValues.types';
import { snapshotValuesFilename } from './snapshotValuesFilename';
import { snapshotYamlDiffExtensions, YAML_DIFF_SCAN_LIMIT, YAML_DIFF_TIMEOUT_MS } from './snapshotYamlDiffConfig';

type SnapshotYamlDiffProps = {
  hostId: string;
  snapshotIds: [string, string];
};

export default function SnapshotYamlDiff({ hostId, snapshotIds }: SnapshotYamlDiffProps) {
  const parent = useRef<HTMLDivElement | null>(null);
  const mergeView = useRef<MergeView | null>(null);
  const [snapshots, setSnapshots] = useState<[SnapshotValues, SnapshotValues] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [wrap, setWrap] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setSnapshots(null);
    getConfigSnapshotValues({ hostId, snapshotIds, include: ['yaml'], signal: controller.signal })
      .then(async response => {
        if (response.snapshots.length !== 2 || response.snapshots.some(snapshot => typeof snapshot.yaml !== 'string')) {
          throw new Error('The server returned an incomplete YAML comparison.');
        }
        const verified = await Promise.all(response.snapshots.map(snapshot =>
          verifySnapshotYamlDigest(snapshot.yaml ?? '', snapshot.sha256)));
        if (verified.some(result => !result)) throw new Error('A snapshot digest did not match its returned YAML.');
        if (!controller.signal.aborted) setSnapshots(response.snapshots as [SnapshotValues, SnapshotValues]);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : 'Unable to load YAML diff.');
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [hostId, snapshotIds]);

  useEffect(() => {
    if (!parent.current || !snapshots) return;
    const readOnly = snapshotYamlDiffExtensions(wrap);
    const view = new MergeView({
      parent: parent.current,
      a: { doc: snapshots[0].yaml ?? '', extensions: readOnly },
      b: { doc: snapshots[1].yaml ?? '', extensions: readOnly },
      highlightChanges: true,
      gutter: true,
      collapseUnchanged: { margin: 3, minSize: 8 },
      diffConfig: { scanLimit: YAML_DIFF_SCAN_LIMIT, timeout: YAML_DIFF_TIMEOUT_MS },
    });
    mergeView.current = view;
    return () => {
      view.destroy();
      mergeView.current = null;
    };
  }, [snapshots, wrap]);

  const copy = async (snapshot: SnapshotValues) => {
    try {
      await navigator.clipboard.writeText(snapshot.yaml ?? '');
      setError(null);
    } catch {
      setError('Unable to copy values.yml to the clipboard.');
    }
  };

  const download = (snapshot: SnapshotValues) => {
    try {
      downloadText(snapshotValuesFilename(snapshot), snapshot.yaml ?? '', 'application/yaml;charset=utf-8');
      setError(null);
    } catch {
      setError('Unable to download values.yml.');
    }
  };

  return (
    <Stack spacing={2}>
      <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap" useFlexGap>
        <FormControlLabel
          control={<Switch checked={wrap} onChange={event => setWrap(event.target.checked)} />}
          label="Wrap lines"
        />
        <Button startIcon={<NavigateBeforeIcon />} onClick={() => mergeView.current && goToPreviousChunk(mergeView.current.a)}>
          Previous difference
        </Button>
        <Button startIcon={<NavigateNextIcon />} onClick={() => mergeView.current && goToNextChunk(mergeView.current.a)}>
          Next difference
        </Button>
      </Stack>
      {snapshots && (
        <Stack direction={{ xs: 'column', md: 'row' }} justifyContent="space-between" gap={1}>
          {snapshots.map(snapshot => (
            <Stack key={snapshot.snapshotId} direction="row" spacing={1} alignItems="center">
              <Typography variant="subtitle2">{snapshot.instanceName} · {snapshot.snapshotTs}</Typography>
              <Button size="small" startIcon={<ContentCopyIcon />} onClick={() => copy(snapshot)}>Copy</Button>
              <Button size="small" startIcon={<DownloadIcon />} onClick={() => download(snapshot)}>Download</Button>
            </Stack>
          ))}
        </Stack>
      )}
      {loading && <Box sx={{ display: 'flex', gap: 1 }}><CircularProgress size={20} /> Loading canonical YAML…</Box>}
      {error && <Alert severity="error">{error}</Alert>}
      <Box
        ref={parent}
        aria-label="Canonical YAML comparison"
        sx={{
          minHeight: 420,
          '& .cm-mergeView': { height: '65vh', overflow: 'auto', border: 1, borderColor: 'divider' },
          '& .cm-editor': { minWidth: 0 },
        }}
      />
    </Stack>
  );
}
