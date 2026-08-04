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
      setHistory(records(await queryLlm('getLlmGatewayInstancePublicationHistory',
        {hostId,environment:publicationEnvironment,instanceId,offset:0,limit:100})));
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
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('The candidate service returned an invalid property set.');
      setCandidate(value as RecordValue);
      setMessage({severity:'info',text:'Generated from current active records. Portal has not contacted the provider; test after creating a snapshot and restarting the selected gateway.'});
    } catch (reason) {
      setCandidate(null); setMessage({severity:'error',text:llmErrorMessage(reason)});
    } finally { setLoading(false); }
  };

  const publish = async () => {
    if (!candidate || !instanceId) return;
    const digest = String(candidate.propertySetDigest ?? '');
    if (!window.confirm(`Publish ${digest} to ${String(selectedInstance?.instanceName ?? instanceId)}?`)) return;
    setLoading(true); setMessage(null);
    try {
      await commandLlm('publishLlmGatewayConfiguration',{
        hostId,environment:publicationEnvironment,instanceId,expectedPropertySetDigest:digest,
      });
      setMessage({severity:'success',text:'Configuration properties were applied atomically. Create and promote a config snapshot for this instance, then restart or reload the gateway to test it.'});
      setCandidate(null); await loadHistory();
    } catch (reason) { setMessage({severity:'error',text:llmErrorMessage(reason)}); }
    finally { setLoading(false); }
  };

  const applyExactRevision = async (item: RecordValue) => {
    if (!instanceId) return;
    const digest = String(item.configPropertiesDigest ?? item.propertySetDigest ?? '');
    if (!window.confirm(`Apply exact revision ${String(item.publicationVersion ?? '—')} to ${String(selectedInstance?.instanceName ?? instanceId)}?`)) return;
    setLoading(true); setMessage(null);
    try {
      await commandLlm('rollbackLlmGatewayConfiguration',{
        hostId,environment:publicationEnvironment,instanceId,expectedPropertySetDigest:digest,
        gatewayPublicationId:item.gatewayPublicationId,
        rollbackOfInstancePublicationId:item.instancePublicationId,
      });
      setMessage({severity:'success',text:'The exact stored revision was reapplied. Create and promote a new config snapshot before restarting or reloading the gateway.'});
      await loadHistory();
    } catch (reason) { setMessage({severity:'error',text:llmErrorMessage(reason)}); }
    finally { setLoading(false); }
  };

  const changeEnvTag = (value: string) => {
    setEnvTag(value); setInstanceId(''); setCandidate(null); setMessage(null);
  };

  const properties = records(candidate?.configProperties);
  const differences = records(candidate?.differences);

  return <Stack spacing={2}>
    <Typography variant="h6">Gateway configuration publication</Typography>
    <Alert severity="info">Publishing writes generated <code>llm-router</code> properties to one selected gateway instance. Snapshot creation, restart or reload, and provider testing remain explicit user actions.</Alert>
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
          <Typography variant="subtitle1" sx={{flexGrow:1}}>Generated property preview</Typography>
          <Button variant="outlined" disabled={loading || !instanceId} onClick={() => void generateCandidate()}>
            {loading ? <CircularProgress size={20}/> : 'Generate from active records'}
          </Button>
        </Box>
        {candidate ? <>
          <Typography>Source digest: <code>{String(candidate.sourceDigest)}</code></Typography>
          <Typography>Property digest: <code>{String(candidate.propertySetDigest)}</code></Typography>
          <Typography>{differences.length} managed {differences.length === 1 ? 'property differs' : 'properties differ'} from the selected instance.</Typography>
          <TextField label="Generated llm-router properties" multiline minRows={16} value={pretty(properties)}
            InputProps={{readOnly:true}} inputProps={{spellCheck:false}}/>
          <Button variant="contained" disabled={loading || !candidate.propertySetDigest} onClick={() => void publish()}>
            Publish to instance
          </Button>
        </> : <Typography color="text.secondary">Select an instance and generate a read-only preview. The server regenerates and verifies its digest when you publish.</Typography>}
      </Stack>
    </Paper>

    <Paper variant="outlined" sx={{p:2}}>
      <Typography variant="subtitle1" sx={{mb:1}}>Instance publication history</Typography>
      {history.length === 0 ? <Typography color="text.secondary">No LLM configuration has been applied to this instance.</Typography>
        : <TableContainer><Table size="small">
          <TableHead><TableRow><TableCell>Application</TableCell><TableCell>Revision</TableCell><TableCell>Digest</TableCell><TableCell>Applied</TableCell><TableCell>Applied by</TableCell><TableCell/></TableRow></TableHead>
          <TableBody>{history.map(item => <TableRow key={String(item.instancePublicationId)}>
            <TableCell>{String(item.applicationVersion ?? '—')}</TableCell>
            <TableCell>{String(item.publicationVersion ?? '—')}</TableCell>
            <TableCell><code>{String(item.configPropertiesDigest ?? item.propertySetDigest ?? '—')}</code></TableCell>
            <TableCell>{String(item.updateTs ?? '—')}</TableCell>
            <TableCell>{String(item.updateUser ?? '—')}</TableCell>
            <TableCell><Button size="small" disabled={loading} onClick={() => void applyExactRevision(item)}>Apply exact revision</Button></TableCell>
          </TableRow>)}</TableBody>
        </Table></TableContainer>}
    </Paper>
  </Stack>;
}
