import { useState } from 'react';
import { Alert, Button, Stack, TextField, Typography } from '@mui/material';
import { type CodingInput, codingPayload, importCodingRequest } from './codingRequest';

type Props = { value: CodingInput; onChange: (value: CodingInput) => void; onPrompt: (text: string) => void; disabled?: boolean };
export default function CodingRequestForm({ value, onChange, onPrompt, disabled }: Props) {
  const [importError, setImportError] = useState('');
  let validation = '';
  try { codingPayload(value); } catch (error) { validation = (error as Error).message; }
  const fields: Array<[keyof CodingInput, string]> = [
    ['artifactUri', 'Repository bundle URI'], ['digest', 'Bundle SHA-256'], ['size', 'Bundle size (bytes)'],
    ['baseRevision', 'Base commit'], ['workspaceRoot', 'Worker workspace root'],
    ['maximumPatchBytes', 'Maximum patch bytes'], ['maximumChangedFiles', 'Maximum changed files'],
  ];
  return <Stack spacing={1} sx={{ p: 2, overflow: 'auto', maxHeight: 320 }}>
    <Typography>Implementation turn using a runner-local immutable Git bundle. The published policy controls the adapter and credentials.</Typography>
    <Button component="label" disabled={disabled}>Import coding request JSON<input type="file" accept=".json,application/json" hidden onChange={async event => {
      const file = event.target.files?.[0]; event.target.value = '';
      if (!file) return;
      setImportError('');
      try {
        if (file.size > 1024 * 1024) throw new Error('Request file exceeds 1 MiB.');
        const imported = importCodingRequest(JSON.parse(await file.text()));
        onChange(imported.input); onPrompt(imported.text);
      } catch (error) { setImportError((error as Error).message); }
    }} /></Button>
    {fields.map(([key, label]) => <TextField key={key} size="small" label={label} value={value[key]} disabled={disabled} onChange={e => onChange({ ...value, [key]: e.target.value })} />)}
    {(importError || validation) && <Alert severity="warning">{importError || validation}</Alert>}
    <Typography variant="caption">Tools: fs.read, fs.write, process.exec. The bundle remains on the runner host; importing this JSON does not upload repository contents.</Typography>
  </Stack>;
}
