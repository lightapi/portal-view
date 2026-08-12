import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, CircularProgress, MenuItem, Paper, Stack, Table, TableBody,
  TableCell, TableContainer, TableHead, TableRow, TextField, Typography,
} from '@mui/material';
import fetchClient from '../../../utils/fetchClient';
import { useNavigate } from 'react-router-dom';
import { commandLlm, queryLlm } from './api';
import { llmErrorMessage } from './error';

type RecordValue = Record<string, unknown>;

function records(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') as RecordValue[] : [];
}

function environmentNames(value: unknown): string[] {
  const source = Array.isArray(value) ? value : [];
  return [...new Set(source.map(item => {
    if (typeof item === 'string') return item;
    if (!item || typeof item !== 'object') return '';
    const option = item as RecordValue;
    return String(option.id ?? option.value ?? option.name ?? option.label ?? '');
  }).filter(Boolean))];
}

function pretty(value: unknown) { return JSON.stringify(value, null, 2); }

function instanceQuery(hostId: string, envTag: string) {
  const cmd = {
    host: 'lightapi.net', service: 'instance', action: 'getInstance', version: '0.1.0',
    data: {
      hostId, offset: 0, limit: 1000, active: true,
      sorting: JSON.stringify([{id:'instanceName',desc:false}]),
      filters: JSON.stringify([
        {id:'productId',value:'gtw'},
        {id:'envTag',value:envTag},
      ]),
      globalFilter: '',
    },
  };
  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
}

export default function PublicationPanel({hostId}: {hostId: string}) {
  const navigate = useNavigate();
  const [envTag,setEnvTag] = useState('dev');
  const [envTags,setEnvTags] = useState<string[]>(['dev']);
  const [instances,setInstances] = useState<RecordValue[]>([]);
  const [instanceId,setInstanceId] = useState('');
  const [candidate,setCandidate] = useState<RecordValue | null>(null);
  const [history,setHistory] = useState<RecordValue[]>([]);
  const [loading,setLoading] = useState(false);
  const [message,setMessage] = useState<{severity:'success'|'error'|'info'; text:string} | null>(null);
  const selectedInstance = useMemo(() => instances.find(item => item.instanceId === instanceId),[instances,instanceId]);
  const publicationEnvironment = String(selectedInstance?.environment ?? '');

  useEffect(() => {
    let active = true;
    void fetchClient(`/r/data?name=environment&host=${encodeURIComponent(hostId)}`)
      .then(value => {
        if (!active) return;
        const options = environmentNames(value);
        const next = options.length ? options : ['dev'];
        setEnvTags(next);
        setEnvTag(previous => next.includes(previous) ? previous : next[0]);
      })
      .catch(() => { if (active) setEnvTags(['dev']); });
    return () => { active = false; };
  },[hostId]);

  const loadInstances = useCallback(async () => {
    try {
      const response = await fetchClient(instanceQuery(hostId,envTag));
      const available = records(response && typeof response === 'object'
        ? (response as RecordValue).instances : []).filter(item =>
        String(item.productId ?? '').toLowerCase() === 'gtw'
          && String(item.envTag ?? '').toLowerCase() === envTag.toLowerCase());
      setInstances(available);
      setInstanceId(previous => available.some(item => item.instanceId === previous)
        ? previous : String(available[0]?.instanceId ?? ''));
    } catch (reason) {
      setInstances([]); setInstanceId('');
      setMessage({severity:'error',text:llmErrorMessage(reason)});
    }
  },[hostId,envTag]);

  const loadHistory = useCallback(async () => {
    if (!instanceId || !publicationEnvironment) { setHistory([]); return; }
    try {
      const publications = records(await queryLlm('getLlmGatewayPublicationHistory',
        {hostId,environment:publicationEnvironment,offset:0,limit:100}));
      setHistory(publications.filter(item => !item.instanceId || String(item.instanceId) === instanceId));
    } catch { setHistory([]); }
  },[hostId,publicationEnvironment,instanceId]);

  useEffect(() => { setCandidate(null); void loadInstances(); },[loadInstances]);
  useEffect(() => { setCandidate(null); void loadHistory(); },[loadHistory]);

  const generateCandidate = async () => {
    if (!instanceId || !publicationEnvironment) {
      setMessage({severity:'error',text:'The selected instance has no logical environment.'});
      return;
    }
    setLoading(true); setMessage(null);
    try {
      const value = await queryLlm('getLlmGatewayPublicationCandidate',
        {hostId,environment:publicationEnvironment,instanceId});
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The candidate service returned an invalid V3 projection.');
      setCandidate(value as RecordValue);
      setMessage({severity:'info',text:'Generated a V3 projection from the current active control-plane records. Publishing makes it available to the selected gateway; provider testing remains a separate action.'});
    } catch (reason) {
      setCandidate(null); setMessage({severity:'error',text:llmErrorMessage(reason)});
    } finally { setLoading(false); }
  };

  const publish = async () => {
    if (!candidate || !instanceId) return;
    const digest = String(candidate.sourceDigest ?? '');
    if (!window.confirm(`Publish ${digest} to ${String(selectedInstance?.instanceName ?? instanceId)}?`)) return;
    setLoading(true); setMessage(null);
    try {
      await commandLlm('publishLlmGatewayConfiguration',{
        hostId,environment:publicationEnvironment,instanceId,expectedPropertySetDigest:digest,
      });
      setMessage({severity:'success',text:'The V3 projection was published. Confirm an applied V3 acknowledgement from the gateway before retiring the V2 reader.'});
      setCandidate(null); await loadHistory();
    } catch (reason) { setMessage({severity:'error',text:llmErrorMessage(reason)}); }
    finally { setLoading(false); }
  };

  const changeEnvTag = (value: string) => {
    setEnvTag(value); setInstanceId(''); setCandidate(null); setMessage(null);
  };

  const resources = records(candidate?.resources);

  return <Stack spacing={2}>
    <Typography variant="h6">Gateway projection publication</Typography>
    <Alert severity="info">Publishing creates an immutable V3 manifest and resource bundle for one selected gateway instance. Existing model records are not rewritten.</Alert>
    <Box sx={{display:'flex',gap:2,flexWrap:'wrap'}}>
      <TextField select label="Instance Env Tag" value={envTag} onChange={event => changeEnvTag(event.target.value)} sx={{minWidth:220}}>
        {envTags.map(option => <MenuItem key={option} value={option}>{option}</MenuItem>)}
      </TextField>
      <TextField select label="LLM Gateway Instance" value={instanceId}
        onChange={event => { setInstanceId(event.target.value); setCandidate(null); setMessage(null); }} sx={{minWidth:360}}>
        {instances.map(item => <MenuItem key={String(item.instanceId)} value={String(item.instanceId)}>
          {String(item.instanceName ?? item.serviceId ?? item.instanceId)}{item.current ? ' (current)' : ''}
        </MenuItem>)}
      </TextField>
    </Box>
    {instanceId && publicationEnvironment && <Typography color="text.secondary">
      LLM environment: <code>{publicationEnvironment}</code>
    </Typography>}
    {!instances.length && <Alert severity="warning">No active <code>gtw</code> instance is registered for this host and env tag.</Alert>}
    {message && <Alert severity={message.severity}>{message.text}</Alert>}
    {message?.severity === 'success' && instanceId && <Box>
      <Button variant="outlined" onClick={() => navigate('/app/config/configSnapshot',
        {state:{data:{instanceId}}})}>Open config snapshots for this instance</Button>
    </Box>}

    <Paper variant="outlined" sx={{p:2}}>
      <Stack spacing={2}>
        <Box sx={{display:'flex',alignItems:'center',gap:1}}>
          <Typography variant="subtitle1" sx={{flexGrow:1}}>Generated V3 projection preview</Typography>
          <Button variant="outlined" disabled={loading || !instanceId} onClick={() => void generateCandidate()}>
            {loading ? <CircularProgress size={20}/> : 'Generate from active records'}
          </Button>
        </Box>
        {candidate ? <>
          <Typography>Source digest: <code>{String(candidate.sourceDigest)}</code></Typography>
          <Typography>Publication: <code>{String(candidate.gatewayPublicationId)}</code></Typography>
          <Typography>{resources.length} immutable projection {resources.length === 1 ? 'resource' : 'resources'} generated.</Typography>
          <TextField label="Generated V3 projection" multiline minRows={16} value={pretty({manifest:candidate.manifest,resources})}
            InputProps={{readOnly:true}} inputProps={{spellCheck:false}}/>
          <Button variant="contained" disabled={loading || !candidate.sourceDigest} onClick={() => void publish()}>
            Publish to instance
          </Button>
        </> : <Typography color="text.secondary">Select an instance and generate a read-only preview. The server regenerates and verifies its digest when you publish.</Typography>}
      </Stack>
    </Paper>

    <Paper variant="outlined" sx={{p:2}}>
      <Typography variant="subtitle1" sx={{mb:1}}>V3 publication history</Typography>
      {history.length === 0 ? <Typography color="text.secondary">No V3 projection has been published to this instance.</Typography>
        : <TableContainer><Table size="small">
          <TableHead><TableRow><TableCell>Schema</TableCell><TableCell>Revision</TableCell><TableCell>Digest</TableCell><TableCell>Published</TableCell><TableCell>Published by</TableCell></TableRow></TableHead>
          <TableBody>{history.map(item => <TableRow key={String(item.gatewayPublicationId)}>
            <TableCell>{String(item.projectionSchemaVersion ?? '—')}</TableCell>
            <TableCell>{String(item.publicationVersion ?? '—')}</TableCell>
            <TableCell><code>{String(item.sourceDigest ?? '—')}</code></TableCell>
            <TableCell>{String(item.updateTs ?? '—')}</TableCell>
            <TableCell>{String(item.updateUser ?? '—')}</TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>}
    </Paper>
  </Stack>;
}
