import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Box, Button, Paper, Stack, TextField, Typography } from '@mui/material';
import { commandLlm, queryLlm } from './api';
import { gatewaySupports, validatePublicationCandidate } from './validation';

export default function PublicationPanel({hostId}: {hostId: string}) {
  const [environment,setEnvironment] = useState('dev');
  const [current,setCurrent] = useState<unknown>(null);
  const [payload,setPayload] = useState(JSON.stringify({
    environment:'dev', publicationVersion:1, minimumGatewayVersion:'0.1.0',
    enabledRoutingFeatures:[], publicationState:'PUBLISHED', deliveryState:'PENDING',
    manifest:{schemaVersion:1,resources:[]}, resources:[]
  },null,2));
  const [message,setMessage] = useState('');
  const parsed = useMemo(() => { try { return JSON.parse(payload) as Record<string,unknown>; } catch { return null; } },[payload]);
  const currentRecord = current && typeof current === 'object' ? current as Record<string,unknown> : null;
  const evidence = currentRecord?.deliveryEvidence && typeof currentRecord.deliveryEvidence === 'object'
    ? currentRecord.deliveryEvidence as Record<string,unknown> : null;
  const validationErrors = parsed ? validatePublicationCandidate(parsed) : ['Publication JSON is invalid.'];
  const compatibilityErrors = parsed ? gatewaySupports(parsed,evidence) : [];
  const refresh = useCallback(async () => {
    try { setCurrent(await queryLlm('getLlmGatewayPublication',{hostId,environment})); }
    catch { setCurrent(null); }
  },[hostId,environment]);
  useEffect(() => { void refresh(); },[refresh]);
  const publish = async (rollback: boolean) => {
    try {
      const data = JSON.parse(payload);
      const errors = [...validatePublicationCandidate(data),...gatewaySupports(data,evidence)];
      if (errors.length) throw new Error(errors.join(' '));
      if (!window.confirm(`${rollback ? 'Append rollback' : 'Publish'} version ${data.publicationVersion} to ${environment}? This changes all affected aliases.`)) return;
      await commandLlm(rollback ? 'rollbackLlmGatewayConfiguration' : 'publishLlmGatewayConfiguration',
        {...data,hostId,environment});
      setMessage(rollback ? 'Rollback publication appended.' : 'Publication accepted atomically.');
      await refresh();
    } catch (reason) { setMessage(reason instanceof Error ? reason.message : String(reason)); }
  };
  return <Stack spacing={2}>
    <Typography variant="h6">Gateway publication</Typography>
    <Alert severity="warning">A publication must contain a full manifest and every referenced immutable resource. Rollback appends a new publication; it never mutates history.</Alert>
    {message && <Alert severity={message.includes('accepted') || message.includes('appended') ? 'success':'error'}>{message}</Alert>}
    {[...validationErrors,...compatibilityErrors].map(error => <Alert severity="warning" key={error}>{error}</Alert>)}
    <TextField label="Environment" value={environment} onChange={event => setEnvironment(event.target.value)} sx={{maxWidth:240}}/>
    <TextField label="Publication JSON" multiline minRows={18} value={payload} onChange={event => setPayload(event.target.value)} inputProps={{spellCheck:false}}/>
    <Paper variant="outlined" sx={{p:2}}><Typography variant="subtitle2">Candidate review</Typography>
      <Typography>Version: {String(parsed?.publicationVersion ?? '—')} · Resources: {Array.isArray(parsed?.resources) ? parsed.resources.length : 0} · Requested features: {Array.isArray(parsed?.enabledRoutingFeatures) ? parsed.enabledRoutingFeatures.join(', ') || 'none' : 'none'}</Typography>
      <Typography>Target compiler acknowledgement: {String(evidence?.compilerVersion ?? 'unavailable')}</Typography>
    </Paper>
    <Box sx={{display:'flex',gap:1}}><Button variant="contained" disabled={validationErrors.length>0 || compatibilityErrors.length>0} onClick={() => void publish(false)}>Validate and publish</Button>
      <Button color="warning" variant="outlined" disabled={validationErrors.length>0 || compatibilityErrors.length>0 || !parsed?.rollbackOfPublicationId} onClick={() => void publish(true)}>Append rollback</Button></Box>
    <Paper variant="outlined" sx={{p:2,overflow:'auto'}}><Typography variant="subtitle2">Current publication</Typography><pre>{JSON.stringify(current,null,2)}</pre></Paper>
  </Stack>;
}
