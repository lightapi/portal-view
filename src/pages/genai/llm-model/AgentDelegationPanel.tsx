import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Checkbox, FormControlLabel, Link, MenuItem, Stack, TextField, Typography } from '@mui/material';
import fetchClient from '../../../utils/fetchClient';
import { commandLlm, queryLlm } from './api';
import { llmErrorMessage } from './error';

type Row = Record<string, unknown>;
const endpoints = ['/v1/chat/completions@post', '/v1/responses@post', '/anthropic/v1/messages@post'];
const requiredDefaults = () => Object.fromEntries(endpoints.map(endpoint => [endpoint, true]));

async function allRows(action: string, hostId: string): Promise<Row[]> {
  const result: Row[] = [];
  for (let offset = 0; ; offset += 200) {
    const page = await queryLlm(action, { hostId, offset, limit: 200, active: true });
    if (!Array.isArray(page)) throw new Error('The authoring service returned an invalid list.');
    result.push(...page);
    if (page.length < 200) return result;
  }
}

export default function AgentDelegationPanel({hostId, initialInstanceId = ''}: {hostId: string; initialInstanceId?: string}) {
  const [instances, setInstances] = useState<Row[]>([]);
  const [instanceId, setInstanceId] = useState(initialInstanceId);
  const [profiles, setProfiles] = useState<Row[]>([]);
  const [policies, setPolicies] = useState<Row[]>([]);
  const [issuer, setIssuer] = useState('');
  const [audience, setAudience] = useState('');
  const [requirements, setRequirements] = useState<Record<string, boolean>>(requiredDefaults);
  const [ownership, setOwnership] = useState<Row | null>(null);
  const [preview, setPreview] = useState<Row | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const instance = instances.find(row => row.instanceId === instanceId);
  const environment = String(instance?.environment ?? '');
  const profile = profiles.find(row => row.environment === environment);
  const policy = policies.find(row => row.instanceId === instanceId);

  const load = useCallback(async () => {
    const cmd = { host:'lightapi.net', service:'instance', action:'getInstance', version:'0.1.0',
      data:{hostId, offset:0, limit:1000, active:true, filters:JSON.stringify([{id:'productId',value:'gtw'}]), sorting:'[]', globalFilter:''} };
    const [response, nextProfiles, nextPolicies] = await Promise.all([
      fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd))),
      allRows('getLlmGatewaySecurityProfile',hostId), allRows('getLlmGatewayDelegationPolicy',hostId),
    ]);
    const available = ((response as {instances?:Row[]})?.instances ?? [])
      .filter(row => row.productId === 'gtw' && !row.readonly && row.environment);
    setInstances(available); setProfiles(nextProfiles); setPolicies(nextPolicies);
    setInstanceId(previous => available.some(row => row.instanceId === previous) ? previous : String(available[0]?.instanceId ?? ''));
  },[hostId]);

  useEffect(() => { void load().catch(reason => setError(llmErrorMessage(reason))); },[load]);
  useEffect(() => {
    setIssuer(String(profile?.userIssuer ?? '')); setAudience(String(profile?.userAudience ?? ''));
    setRequirements(policy?.endpoints as Record<string, boolean> ?? requiredDefaults());
    setPreview(null); setOwnership(null);
    let active = true;
    if(instanceId) void queryLlm('getLlmGatewayOwnershipState',{hostId,instanceId})
      .then(value => { if(active) setOwnership(value as Row); })
      .catch(reason => { if(active) setError(llmErrorMessage(reason)); });
    return () => { active = false; };
  },[hostId, instanceId, profile, policy]);

  const run = async (operation: () => Promise<void>) => {
    setBusy(true); setError(''); setNotice('');
    try { await operation(); } catch(reason) { setError(llmErrorMessage(reason)); } finally { setBusy(false); }
  };
  const saveProfile = () => run(async () => {
    await commandLlm(profile ? 'updateLlmGatewaySecurityProfile' : 'createLlmGatewaySecurityProfile',{
      hostId,environment,userIssuer:issuer,userAudience:audience,schemaVersion:1,
      ...(profile ? {securityProfileId:profile.securityProfileId,aggregateVersion:profile.aggregateVersion} : {}),
    });
    await load(); setNotice('Security profile saved. All gateways in this logical environment share this profile. Publish to apply runtime changes.');
  });
  const savePolicy = () => run(async () => {
    await commandLlm(policy ? 'updateLlmGatewayDelegationPolicy' : 'createLlmGatewayDelegationPolicy',{
      hostId,instanceId,securityProfileId:profile?.securityProfileId,endpoints:requirements,schemaVersion:1,
      ...(policy ? {aggregateVersion:policy.aggregateVersion} : {}),
    });
    await load(); setNotice('Endpoint policy saved. Generate and publish a new revision in Publication to apply it.');
  });
  const inspect = () => run(async () => {
    setPreview(await queryLlm('getLlmGatewayPublicationCandidate',{hostId,environment,instanceId}) as Row);
  });
  const release = () => run(async () => {
    if(!window.confirm('Release all managed LLM properties to generic configuration? Later publication must explicitly reclaim them.')) return;
    await commandLlm('releaseLlmGatewayOwnership',{hostId,instanceId,instancePublicationId:ownership?.instancePublicationId});
    setOwnership(await queryLlm('getLlmGatewayOwnershipState',{hostId,instanceId}) as Row);
    setNotice('Ownership released with generic event baselines. The running gateway configuration has not changed.');
  });
  const generated = (preview?.configProperties as Row[] | undefined)?.find(row => row.propertyName === 'agentDelegation')?.propertyValue;
  const bindings = (generated as Row | undefined)?.bindings as Row[] | undefined;
  const dirty = JSON.stringify(requirements) !== JSON.stringify(policy?.endpoints ?? requiredDefaults())
    || issuer !== String(profile?.userIssuer ?? '') || audience !== String(profile?.userAudience ?? '');

  return <Stack spacing={2}>
    <Typography variant="h6">Agent Delegation</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {notice && <Alert severity="success">{notice}</Alert>}
    <TextField select label="Gateway instance" value={instanceId} disabled={busy}
      onChange={event => {setInstanceId(event.target.value); setError('');}}>
      {instances.map(row => <MenuItem key={String(row.instanceId)} value={String(row.instanceId)}>
        {String(row.instanceName)} ({String(row.envTag)} / {String(row.environment)})
      </MenuItem>)}
    </TextField>
    {!instanceId ? <Alert severity="info">Create a writable gateway instance to author its endpoint policy.</Alert> : <>
      <Typography>Logical environment: {environment}</Typography>
      <Alert severity="info">User issuer and audience are shared by this host and logical environment. Endpoint requirements apply only to the selected instance.</Alert>
      <TextField label="User issuer" value={issuer} disabled={busy} onChange={event => setIssuer(event.target.value)}/>
      <TextField label="User audience" value={audience} disabled={busy} onChange={event => setAudience(event.target.value)}/>
      <Button disabled={busy || !issuer.trim() || !audience.trim()} onClick={saveProfile}>Save security profile</Button>
      {endpoints.map(endpoint => <FormControlLabel key={endpoint}
        control={<Checkbox checked={requirements[endpoint] ?? true} disabled={busy}
          onChange={event => setRequirements(previous => ({...previous,[endpoint]:event.target.checked}))}/>}
        label={`Require agent workload token: ${endpoint}`}/>)}
      <Alert severity="info">Optional permits authenticated direct-user inference on public aliases. Invalid supplied workload tokens remain rejected; agent-bound aliases still require their agent.</Alert>
      {dirty && <Alert severity="warning">Unsaved authoring changes. Saving does not publish or activate runtime configuration.</Alert>}
      <Button disabled={busy || !profile} onClick={savePolicy}>Save endpoint policy</Button>
      <Button disabled={busy || !policy || dirty} onClick={inspect}>Preview saved policy and derived bindings</Button>
      {preview && <><Typography>Source fingerprint: {String(preview.sourceDigest)}</Typography>
        <Typography component="pre" sx={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify(generated,null,2)}</Typography>
        {bindings?.map(binding => <Stack key={String(binding.clientId)} direction="row" spacing={2}>
          <Link href={`/app/genai/AgentDefinition?agentDefId=${encodeURIComponent(String(binding.agentDefId))}`}>Agent {String(binding.agentDefId)}</Link>
          <Link href={`/app/oauth/authClient?clientId=${encodeURIComponent(String(binding.clientId))}`}>OAuth client {String(binding.clientId)}</Link>
        </Stack>)}
      </>}
      {ownership?.managed === true && <>
        <Typography>Managed by LLM Model Control Plane. Publication: {String(ownership.instancePublicationId)}</Typography>
        <Button color="warning" disabled={busy} onClick={release}>Release to generic configuration</Button>
      </>}
    </>}
  </Stack>;
}
