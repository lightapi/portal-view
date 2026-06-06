import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import type { ConfigUpdateProperty } from './types';
import { parseStructuredValue, structuredInitialValue, toPrettyJson, toYaml } from './configValue';

type Props = {
  row: ConfigUpdateProperty | null;
  value: string;
  open: boolean;
  onClose: () => void;
  onSave: (value: string) => void;
};

export default function ConfigStructuredValueDialog({ row, value, open, onClose, onSave }: Props) {
  const [tab, setTab] = useState<'json' | 'yaml'>('json');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const initialJson = useMemo(
    () => toPrettyJson(structuredInitialValue(row?.valueType, value)),
    [row?.valueType, value],
  );

  useEffect(() => {
    if (!open) return;
    setTab('json');
    setText(initialJson);
    setError(null);
  }, [initialJson, open]);

  if (!row) return null;

  const handleTabChange = (_event: unknown, nextTab: 'json' | 'yaml') => {
    const parsed = parseStructuredValue(row.valueType, text, tab);
    if (parsed.error) {
      setError(parsed.error);
      setTab(nextTab);
      return;
    }

    setError(null);
    setTab(nextTab);
    setText(nextTab === 'yaml' ? toYaml(parsed.value ?? '') : toPrettyJson(parsed.value ?? ''));
  };

  const handleSave = () => {
    const parsed = parseStructuredValue(row.valueType, text, tab);
    if (parsed.error) {
      setError(parsed.error);
      return;
    }
    onSave(parsed.value ?? '');
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="md" fullWidth>
      <DialogTitle>
        {row.configName} / {row.propertyName}
      </DialogTitle>
      <DialogContent>
        <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
          <Tabs value={tab} onChange={handleTabChange}>
            <Tab value="json" label="JSON" />
            <Tab value="yaml" label="YAML" />
          </Tabs>
        </Box>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="caption" color="text.secondary">
          {row.valueType === 'list' ? 'Array value' : 'Object value'} stored as compact JSON.
        </Typography>
        <TextField
          value={text}
          onChange={(event) => setText(event.target.value)}
          multiline
          minRows={14}
          fullWidth
          sx={{ mt: 1 }}
          spellCheck={false}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button variant="contained" onClick={handleSave}>Stage Value</Button>
      </DialogActions>
    </Dialog>
  );
}
