import Tooltip from '@mui/material/Tooltip';
import { PortalActions, PortalActionScope } from '../../components/PortalActions/PortalActions';
import { usePortalActionTableOptions } from '../../components/PortalActions/usePortalActionTableOptions';
import PortalActionIcon from '@mui/icons-material/ArrowForward';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, MenuItem, Paper, Stack, TextField, Typography,
} from '@mui/material';
import { MaterialReactTable, type MRT_ColumnDef, useMaterialReactTable } from 'material-react-table';
import { useUserState } from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';
import { apiPost } from '../../api/apiPost';
import { loadErrorMessage } from '../../utils/loadErrorMessage';
import A2aPublicationDialog from './A2aPublicationDialog';
import A2aAuthoringDialog from './A2aAuthoringDialog';
import { canonicalSha256 } from './a2aCanonical';

type Binding = {
  hostId: string; a2aBindingId: string; agentDefId: string; instanceApiId: string;
  runtimeInstanceId: string; environment: string; agentRef: string; bindingName: string;
  implementationKind: 'LIGHT_AGENT'|'EXTERNAL_SIDECAR'|'REMOTE_A2A';
  deploymentMode: 'NATIVE'|'SIDECAR'|'SHARED'; publicPath: string; runtimeServiceId: string;
  allowedHosts: string[];
  allowedPrincipalPrefixes: string[];
  publicMetadataId?: string; retentionProfileId: string; signingProfileId: string;
  accessPolicyRef?: string; backendBindingRef?: string; protocolProfile?: string;
  extensionIds?: string[]; extendedCardProfileId?: string; pushProfileId?: string;
  inboundEnabled: boolean; outboundEnabled: boolean; publicationState?: string;
  contentDigest?: string; aggregateVersion?: number;
  remoteProfile?: RemoteProfile;
};
type RemoteProfile = {
  gatewayPath: string; gatewayUri: string; approvedDestination: string;
  reviewState: 'APPROVED'|'PENDING'; signatureVerified: boolean; revoked: boolean;
  reviewExpiresAt: string; approvedCardDigest?: string; agentCard: Record<string, unknown>;
  catalogToolId: string; requiredExtensions: string[];
  callerRuntimeInstances: {instanceId:string}[];
  workflowRuntimeInstances: {instanceId:string}[];
  outboundPolicy: {
    dataBoundaryDigest: string; artifactHandling: 'MANAGED'|'EPHEMERAL';
    maximumDelegationDepth: number; maximumBudgetUnits: number;
    allowedCallingAgentRefs: string[]; allowedPrincipalPrefixes: string[];
    allowedDataBoundaryDigests: string[]; credentialFile?: string;
  };
};
type AuthoringOption={entityType:string;entityKey:string;values:Record<string,unknown>};
type AgentOption={agentDefId:string;agentName?:string;apiName?:string;apiVersion?:string};
type RuntimeOption={instanceId:string;serviceId:string;envTag?:string;productId?:string};
type InstanceApiOption={instanceApiId:string;instanceId:string;apiVersionId:string;apiType?:string;productId?:string;serviceId?:string};

const csv=(value:string)=>value.split(',').map(item=>item.trim()).filter(Boolean);
const defaultRemoteProfile=(agentRef:string):RemoteProfile=>({
  gatewayPath:`/internal/a2a/outbound/${agentRef||'agent'}`,gatewayUri:'',approvedDestination:'',
  reviewState:'PENDING',signatureVerified:false,revoked:false,reviewExpiresAt:'',agentCard:{},
  catalogToolId:crypto.randomUUID(),requiredExtensions:[],callerRuntimeInstances:[],workflowRuntimeInstances:[],
  outboundPolicy:{dataBoundaryDigest:'',artifactHandling:'EPHEMERAL',maximumDelegationDepth:4,
    maximumBudgetUnits:65536,allowedCallingAgentRefs:[],allowedPrincipalPrefixes:[],allowedDataBoundaryDigests:[]},
});

const empty = (hostId: string, environment: string): Binding => ({
  hostId, a2aBindingId: '', agentDefId: '', instanceApiId: '', runtimeInstanceId: '', environment,
  agentRef: '', bindingName: '', implementationKind: 'LIGHT_AGENT', deploymentMode: 'NATIVE',
  publicPath: '/a2a/', runtimeServiceId: '', retentionProfileId: '', signingProfileId: '',
  allowedHosts: [],
  allowedPrincipalPrefixes: [],
  extensionIds: [],
  inboundEnabled: true, outboundEnabled: false,
});

export default function A2aBindings() {
  const { host } = useUserState() as {host?: string};
  const [environment, setEnvironment] = useState('dev');
  const [rows, setRows] = useState<Binding[]>([]);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<Binding|null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState<Binding|null>(null);
  const [authoring, setAuthoring] = useState(false);
  const [remoteCardJson,setRemoteCardJson]=useState('');
  const [authoringOptions,setAuthoringOptions]=useState<AuthoringOption[]>([]);
  const [agents,setAgents]=useState<AgentOption[]>([]);
  const [runtimes,setRuntimes]=useState<RuntimeOption[]>([]);
  const [workflowRuntimes,setWorkflowRuntimes]=useState<RuntimeOption[]>([]);
  const [gatewayLinks,setGatewayLinks]=useState<InstanceApiOption[]>([]);

  const load = useCallback(async () => {
    if (!host || !environment.trim()) return;
    const cmd = {host:'lightapi.net',service:'genai',action:'getA2aBinding',version:'0.1.0',
      data:{hostId:host,environment,active:true}};
    try {
      const result = await fetchClient('/portal/query?cmd='+encodeURIComponent(JSON.stringify(cmd)));
      setRows(result.a2aBindings ?? []); setError('');
    } catch (reason) { setError(loadErrorMessage(reason)); }
  }, [host, environment]);
  useEffect(()=>{ void load(); },[load]);
  const loadAuthoring=useCallback(async()=>{
    if(!host)return;
    try{const result=await fetchClient('/portal/query?cmd='+encodeURIComponent(JSON.stringify({host:'lightapi.net',service:'genai',action:'getA2aAuthoring',version:'0.1.0',data:{hostId:host,environment}})));setAuthoringOptions(result.a2aAuthoring??[]);}catch{/* binding table remains usable while authoring options are unavailable */}
  },[environment,host]);
  useEffect(()=>{void loadAuthoring();},[loadAuthoring]);
  const loadRelationships=useCallback(async()=>{
    if(!host)return;
    const query=(service:string,action:string,data:Record<string,unknown>)=>fetchClient('/portal/query?cmd='+encodeURIComponent(JSON.stringify({host:'lightapi.net',service,action,version:'0.1.0',data})));
    const common={hostId:host,offset:0,limit:1000,active:true,sorting:'[]',globalFilter:''};
    try{
      const [agentData,instanceData,linkData]=await Promise.all([
        query('genai','getAgentDefinition',common),
        query('instance','getInstance',{...common,filters:JSON.stringify([{id:'envTag',value:environment}])}),
        query('instance','getInstanceApi',{...common,filters:JSON.stringify([{id:'apiType',value:'agt'}])}),
      ]);
      setAgents((agentData.agentDefinitions??agentData.agents??[]) as AgentOption[]);
      const instances=(instanceData.instances??[]) as RuntimeOption[];
      setRuntimes(instances.filter(item=>item.productId==='agt'&&(!item.envTag||item.envTag===environment)));
      setWorkflowRuntimes(instances.filter(item=>item.serviceId?.includes('light-workflow')&&(!item.envTag||item.envTag===environment)));
      setGatewayLinks(((linkData.instanceApis??[]) as InstanceApiOption[]).filter(item=>item.productId==='gtw'&&item.apiType?.toLowerCase()==='agt'));
    }catch(reason){setError(loadErrorMessage(reason));}
  },[environment,host]);
  useEffect(()=>{void loadRelationships();},[loadRelationships]);
  const options=(entityType:string)=>authoringOptions.filter(option=>option.entityType===entityType);

  const save = async () => {
    if (!editing) return;
    setSaving(true);
    const creating=!editing.a2aBindingId;
    let remoteProfile=editing.remoteProfile;
    if(editing.implementationKind==='REMOTE_A2A'){
      remoteProfile=remoteProfile??defaultRemoteProfile(editing.agentRef);
      try{remoteProfile={...remoteProfile,agentCard:JSON.parse(remoteCardJson||JSON.stringify(remoteProfile.agentCard)) as Record<string,unknown>};}
      catch{setSaving(false);setError('Reviewed Agent Card must be valid JSON.');return;}
      remoteProfile={...remoteProfile,approvedCardDigest:await canonicalSha256(remoteProfile.agentCard)};
    }
    const data={
      hostId:editing.hostId,a2aBindingId:editing.a2aBindingId||undefined,
      agentDefId:editing.agentDefId,instanceApiId:editing.instanceApiId,
      runtimeInstanceId:editing.runtimeInstanceId,publicMetadataId:editing.publicMetadataId||undefined,
      retentionProfileId:editing.retentionProfileId,signingProfileId:editing.signingProfileId,
      environment:editing.environment,agentRef:editing.agentRef,bindingName:editing.bindingName,
      implementationKind:editing.implementationKind,deploymentMode:editing.deploymentMode,
      publicPath:editing.publicPath,runtimeServiceId:editing.runtimeServiceId,
      allowedHosts:editing.allowedHosts,
      allowedPrincipalPrefixes:editing.allowedPrincipalPrefixes,
      protocolProfile:editing.protocolProfile??'a2a-v1-jsonrpc',
      accessPolicyRef:editing.accessPolicyRef,backendBindingRef:editing.backendBindingRef,
      inboundEnabled:editing.inboundEnabled,outboundEnabled:editing.outboundEnabled,
      extensionIds:editing.extensionIds??[],extendedCardProfileId:editing.extendedCardProfileId||undefined,
      pushProfileId:editing.pushProfileId||undefined,
      remoteProfile:editing.implementationKind==='REMOTE_A2A'?remoteProfile:undefined,
    };
    const cmd={host:'lightapi.net',service:'genai',action:creating?'createA2aBinding':'updateA2aBinding',version:'0.1.0',data};
    const result=await apiPost({url:'/portal/command',headers:{},body:cmd});
    setSaving(false);
    if (result.error) { setError(loadErrorMessage(result.error)); return; }
    setEditing(null); await load();
  };

  const remove = async (row: Binding) => {
    if (!window.confirm(`Revoke A2A binding ${row.bindingName}?`)) return;
    const cmd={host:'lightapi.net',service:'genai',action:'deleteA2aBinding',version:'0.1.0',
      data:{hostId:row.hostId,a2aBindingId:row.a2aBindingId}};
    const result=await apiPost({url:'/portal/command',headers:{},body:cmd});
    if (result.error) setError(loadErrorMessage(result.error)); else await load();
  };

  const columns=useMemo<MRT_ColumnDef<Binding>[]>(()=>[
    {accessorKey:'bindingName',header:'Binding'}, {accessorKey:'agentRef',header:'Public agent ref'},
    {accessorKey:'implementationKind',header:'Runtime'}, {accessorKey:'publicPath',header:'Public prefix'},
    {accessorKey:'publicationState',header:'Publication'}, {accessorKey:'contentDigest',header:'Digest'},
  ],[]);
  const table=useMaterialReactTable(usePortalActionTableOptions({columns,data:rows,enableColumnFilters:true,
    renderRowActions: ({ row }) => <PortalActions row={row} actions={[
      {
        id: "edit",
        label: "Edit",
        icon: <PortalActionIcon />,
        onSelect: () => { setRemoteCardJson(row.original.remoteProfile ? JSON.stringify(row.original.remoteProfile.agentCard, null, 2) : ''); setEditing({ ...row.original }); }
      },
      {
        id: "publish",
        label: "Publish",
        icon: <PortalActionIcon />,
        onSelect: () => setPublishing(row.original)
      },
      {
        id: "revoke",
        label: "Revoke",
        icon: <PortalActionIcon />,
        destructive: true,
        onSelect: () => void remove(row.original)
      }
    ]} />,enableRowActions:true,positionActionsColumn:'last'}));

  const set=<K extends keyof Binding>(key:K,value:Binding[K])=>setEditing(current=>current?{...current,[key]:value}:current);
  const setRemote=(patch:Partial<RemoteProfile>)=>setEditing(current=>current?{...current,
    remoteProfile:{...(current.remoteProfile??defaultRemoteProfile(current.agentRef)),...patch}}:current);
  const setOutbound=(patch:Partial<RemoteProfile['outboundPolicy']>)=>setEditing(current=>{
    if(!current)return current;const remote=current.remoteProfile??defaultRemoteProfile(current.agentRef);
    return {...current,remoteProfile:{...remote,outboundPolicy:{...remote.outboundPolicy,...patch}}};
  });
  return <Box sx={{p:3}}>
    <Stack direction="row" spacing={2} alignItems="center" sx={{mb:2}}>
      <Typography variant="h5">A2A Bindings</Typography>
      <TextField size="small" label="Environment" value={environment} onChange={e=>setEnvironment(e.target.value)}/>
      <Button variant="contained" disabled={!host} onClick={()=>{setRemoteCardJson('');setEditing(empty(host!,environment));}}>Create binding</Button>
      <Tooltip describeChild title={!host ? 'Select a host to manage publication profiles.' : ''}>
        <span style={{ display: 'inline-flex' }}>
          <Button disabled={!host} onClick={()=>setAuthoring(true)}>Manage publication profiles</Button>
        </span>
      </Tooltip>
    </Stack>
    <Typography color="text.secondary" sx={{mb:2}}>
      UUID selectors identify Portal relationships only. Runtime configuration is published through the existing Config Server snapshot for host, serviceId, and envTag.
    </Typography>
    {error&&<Alert severity="error" sx={{mb:2}}>{error}</Alert>}
    <Paper><PortalActionScope><MaterialReactTable table={table} /></PortalActionScope></Paper>
    <Dialog open={Boolean(editing)} onClose={()=>setEditing(null)} maxWidth="md" fullWidth>
      <DialogTitle>{editing?.a2aBindingId?'Update':'Create'} A2A binding</DialogTitle>
      {editing&&<DialogContent><Stack spacing={2} sx={{mt:1}}>
        <Stack direction={{xs:'column',md:'row'}} spacing={2}>
          <TextField fullWidth label="Binding name" value={editing.bindingName} onChange={e=>set('bindingName',e.target.value)}/>
          <TextField fullWidth label="Public agent alias" value={editing.agentRef} onChange={e=>set('agentRef',e.target.value.toLowerCase())}/>
        </Stack>
        <Stack direction={{xs:'column',md:'row'}} spacing={2}>
          <TextField select fullWidth label="Implementation" value={editing.implementationKind} onChange={e=>{
            const kind=e.target.value as Binding['implementationKind']; setEditing({...editing,implementationKind:kind,deploymentMode:kind==='LIGHT_AGENT'?'NATIVE':'SIDECAR',backendBindingRef:kind==='EXTERNAL_SIDECAR'?editing.backendBindingRef:undefined,remoteProfile:kind==='REMOTE_A2A'?(editing.remoteProfile??defaultRemoteProfile(editing.agentRef)):undefined});
          }}><MenuItem value="LIGHT_AGENT">Native light-agent</MenuItem><MenuItem value="EXTERNAL_SIDECAR">External agent sidecar</MenuItem><MenuItem value="REMOTE_A2A">Remote A2A facade</MenuItem></TextField>
          <TextField select fullWidth label="Deployment mode" value={editing.deploymentMode} disabled={editing.implementationKind==='LIGHT_AGENT'} onChange={e=>set('deploymentMode',e.target.value as Binding['deploymentMode'])}><MenuItem value="NATIVE">Native</MenuItem><MenuItem value="SIDECAR">Sidecar</MenuItem><MenuItem value="SHARED">Shared</MenuItem></TextField>
        </Stack>
        <TextField select label="Agent definition" value={editing.agentDefId} onChange={e=>set('agentDefId',e.target.value)}>{agents.map(agent=><MenuItem key={agent.agentDefId} value={agent.agentDefId}>{agent.agentName??agent.apiName??agent.agentDefId}{agent.apiVersion?` · ${agent.apiVersion}`:''}</MenuItem>)}</TextField>
        <TextField select label="Gateway Instance API association" value={editing.instanceApiId} onChange={e=>set('instanceApiId',e.target.value)}>{gatewayLinks.filter(link=>link.apiVersionId===editing.agentDefId).map(link=><MenuItem key={link.instanceApiId} value={link.instanceApiId}>{link.serviceId??link.instanceId} · {link.instanceApiId}</MenuItem>)}</TextField>
        <TextField select label="Runtime instance" value={editing.runtimeInstanceId} onChange={e=>{const runtime=runtimes.find(item=>item.instanceId===e.target.value);setEditing(current=>current?{...current,runtimeInstanceId:e.target.value,runtimeServiceId:runtime?.serviceId??''}:current);}}>{runtimes.map(runtime=><MenuItem key={runtime.instanceId} value={runtime.instanceId}>{runtime.serviceId} · {runtime.instanceId}</MenuItem>)}</TextField>
        <TextField label="Resolved runtime serviceId" value={editing.runtimeServiceId} InputProps={{readOnly:true}}/>
        <TextField label="Public path prefix" value={editing.publicPath} onChange={e=>set('publicPath',e.target.value)}/>
        <TextField label="Allowed public hosts" value={editing.allowedHosts.join(', ')}
          helperText="Comma-separated canonical DNS names; schemes and paths are not allowed."
          onChange={e=>set('allowedHosts',e.target.value.split(',').map(value=>value.trim().toLowerCase()).filter(Boolean))}/>
        <TextField select label="Public metadata profile (optional)" value={editing.publicMetadataId??''} onChange={e=>set('publicMetadataId',e.target.value)}><MenuItem value="">Use API metadata precedence</MenuItem>{options('PUBLIC_METADATA').map(option=><MenuItem key={option.entityKey} value={option.entityKey}>{String(option.values.displayName??option.values.agentDefId??option.entityKey)}</MenuItem>)}</TextField>
        <TextField select label="Artifact retention profile" value={editing.retentionProfileId} onChange={e=>set('retentionProfileId',e.target.value)}>{options('RETENTION_PROFILE').map(option=><MenuItem key={option.entityKey} value={option.entityKey}>{String(option.values.profileName??option.entityKey)}</MenuItem>)}</TextField>
        <TextField select label="Purpose-scoped signing profile" value={editing.signingProfileId} onChange={e=>set('signingProfileId',e.target.value)}>{options('SIGNING_PROFILE').map(option=><MenuItem key={option.entityKey} value={option.entityKey}>{String(option.values.profileName??option.entityKey)} · {String(option.values.purpose??'')}</MenuItem>)}</TextField>
        <TextField label="Fine-grained access policy reference" value={editing.accessPolicyRef??''} onChange={e=>set('accessPolicyRef',e.target.value)}/>
        <TextField required label="Allowed authenticated principal prefixes" value={(editing.allowedPrincipalPrefixes??[]).join(', ')} helperText="Required runtime enforcement boundary; comma-separated subject prefixes." onChange={e=>set('allowedPrincipalPrefixes',csv(e.target.value))}/>
        {editing.implementationKind==='EXTERNAL_SIDECAR'&&<TextField select required label="Approved external backend transport" value={editing.backendBindingRef??''} onChange={e=>set('backendBindingRef',e.target.value)} helperText="Portal projects the fixed loopback origin, contract digest, key-file reference, audience, and limits; an A2A caller cannot override them.">{options('BACKEND_TRANSPORT_PROFILE').map(option=><MenuItem key={option.entityKey} value={option.entityKey}>{String(option.values.profileName??option.entityKey)} · {String(option.values.origin??'')}</MenuItem>)}</TextField>}
        {editing.implementationKind==='REMOTE_A2A'&&(()=>{const remote=editing.remoteProfile??defaultRemoteProfile(editing.agentRef);const policy=remote.outboundPolicy;return <Stack spacing={2}>
          <Alert severity="warning">Paste only discovery-worker output. Approval freezes the exact card digest; a changed card must be reviewed and published again.</Alert>
          <TextField required label="Approved remote A2A destination" value={remote.approvedDestination} onChange={e=>setRemote({approvedDestination:e.target.value})}/>
          <TextField required label="Published Gateway URI" value={remote.gatewayUri} onChange={e=>setRemote({gatewayUri:e.target.value})}/>
          <TextField required label="Gateway path" value={remote.gatewayPath} onChange={e=>setRemote({gatewayPath:e.target.value})}/>
          <TextField required label="Catalog tool UUID" value={remote.catalogToolId} helperText="Stable UUID used for governed action evidence." onChange={e=>setRemote({catalogToolId:e.target.value})}/>
          <TextField required multiline minRows={6} label="Reviewed Agent Card JSON" value={remoteCardJson||JSON.stringify(remote.agentCard,null,2)} onChange={e=>setRemoteCardJson(e.target.value)}/>
          <Stack direction={{xs:'column',md:'row'}} spacing={2}>
            <TextField select fullWidth label="Review state" value={remote.reviewState} onChange={e=>setRemote({reviewState:e.target.value as RemoteProfile['reviewState']})}><MenuItem value="PENDING">Pending</MenuItem><MenuItem value="APPROVED">Approved</MenuItem></TextField>
            <TextField fullWidth type="datetime-local" label="Review expires" InputLabelProps={{shrink:true}} value={remote.reviewExpiresAt.slice(0,16)} onChange={e=>setRemote({reviewExpiresAt:e.target.value?new Date(e.target.value).toISOString():''})}/>
          </Stack>
          <Stack direction="row"><FormControlLabel control={<Checkbox checked={remote.signatureVerified} onChange={e=>setRemote({signatureVerified:e.target.checked})}/>} label="Signature verified by discovery workflow"/><FormControlLabel control={<Checkbox checked={remote.revoked} onChange={e=>setRemote({revoked:e.target.checked})}/>} label="Revoked"/></Stack>
          <TextField label="Allowed calling agent refs" value={policy.allowedCallingAgentRefs.join(', ')} onChange={e=>setOutbound({allowedCallingAgentRefs:csv(e.target.value)})}/>
          <TextField label="Allowed principal prefixes" value={policy.allowedPrincipalPrefixes.join(', ')} onChange={e=>setOutbound({allowedPrincipalPrefixes:csv(e.target.value)})}/>
          <TextField label="Allowed data-boundary digests" value={policy.allowedDataBoundaryDigests.join(', ')} onChange={e=>setOutbound({allowedDataBoundaryDigests:csv(e.target.value),dataBoundaryDigest:csv(e.target.value)[0]??''})}/>
          <Stack direction={{xs:'column',md:'row'}} spacing={2}><TextField fullWidth type="number" inputProps={{min:1,max:65535,step:1}} label="Maximum delegation depth" value={policy.maximumDelegationDepth} onChange={e=>setOutbound({maximumDelegationDepth:Number(e.target.value)})}/><TextField fullWidth type="number" inputProps={{min:1,step:1}} label="Maximum budget units" value={policy.maximumBudgetUnits} onChange={e=>setOutbound({maximumBudgetUnits:Number(e.target.value)})}/></Stack>
          <TextField select label="Artifact handling" value={policy.artifactHandling} onChange={e=>setOutbound({artifactHandling:e.target.value as RemoteProfile['outboundPolicy']['artifactHandling']})}><MenuItem value="EPHEMERAL">Ephemeral remote reference</MenuItem><MenuItem value="MANAGED">Import into tenant storage</MenuItem></TextField>
          <TextField label="Server-owned credential file (optional)" value={policy.credentialFile??''} onChange={e=>setOutbound({credentialFile:e.target.value||undefined})}/>
          <TextField select SelectProps={{multiple:true}} label="Assigned light-agent runtimes" value={remote.callerRuntimeInstances.map(item=>item.instanceId)} onChange={e=>setRemote({callerRuntimeInstances:(typeof e.target.value==='string'?csv(e.target.value):e.target.value as string[]).map(instanceId=>({instanceId}))})}>{runtimes.map(runtime=><MenuItem key={runtime.instanceId} value={runtime.instanceId}>{runtime.serviceId} · {runtime.instanceId}</MenuItem>)}</TextField>
          <TextField select SelectProps={{multiple:true}} label="Assigned light-workflow runtimes" value={remote.workflowRuntimeInstances.map(item=>item.instanceId)} onChange={e=>setRemote({workflowRuntimeInstances:(typeof e.target.value==='string'?csv(e.target.value):e.target.value as string[]).map(instanceId=>({instanceId}))})}>{workflowRuntimes.map(runtime=><MenuItem key={runtime.instanceId} value={runtime.instanceId}>{runtime.serviceId} · {runtime.instanceId}</MenuItem>)}</TextField>
        </Stack>;})()}
        <TextField select label="Protocol profile" value={editing.protocolProfile??'a2a-v1-jsonrpc'} onChange={e=>set('protocolProfile',e.target.value)}><MenuItem value="a2a-v1-jsonrpc">A2A 1.0 JSON-RPC</MenuItem><MenuItem value="a2a-v03-jsonrpc">A2A 0.3 compatibility</MenuItem></TextField>
        {editing.implementationKind==='EXTERNAL_SIDECAR'&&(editing.protocolProfile??'a2a-v1-jsonrpc')==='a2a-v1-jsonrpc'&&<Stack spacing={2}>
          <Alert severity="info">Phase 6 capabilities are independent reviewed profiles. Leaving every selector empty preserves the first-production profile.</Alert>
          <TextField select SelectProps={{multiple:true}} label="Optional data-only extensions" value={editing.extensionIds??[]} onChange={e=>set('extensionIds',typeof e.target.value==='string'?csv(e.target.value):e.target.value as string[])}>{options('EXTENSION').filter(option=>option.values.activationState==='OPTIONAL_DATA').map(option=><MenuItem key={option.entityKey} value={option.entityKey}>{String(option.values.extensionUri??option.entityKey)}</MenuItem>)}</TextField>
          <TextField select label="Extended Agent Card profile (optional)" value={editing.extendedCardProfileId??''} onChange={e=>set('extendedCardProfileId',e.target.value||undefined)}><MenuItem value="">Disabled</MenuItem>{options('EXTENDED_CARD_PROFILE').filter(option=>option.values.profileState==='APPROVED').map(option=><MenuItem key={option.entityKey} value={option.entityKey}>{String(option.values.profileName??option.entityKey)}</MenuItem>)}</TextField>
          <TextField select label="Push delivery profile (optional)" value={editing.pushProfileId??''} onChange={e=>set('pushProfileId',e.target.value||undefined)}><MenuItem value="">Disabled</MenuItem>{options('PUSH_PROFILE').filter(option=>option.values.profileState==='APPROVED').map(option=><MenuItem key={option.entityKey} value={option.entityKey}>{String(option.values.profileName??option.entityKey)}</MenuItem>)}</TextField>
        </Stack>}
        <Stack direction="row"><FormControlLabel control={<Checkbox checked={editing.inboundEnabled} onChange={e=>set('inboundEnabled',e.target.checked)}/>} label="Inbound"/><FormControlLabel control={<Checkbox checked={editing.outboundEnabled} onChange={e=>set('outboundEnabled',e.target.checked)}/>} label="Outbound"/></Stack>
        <Alert severity="info">Required extensions, raw binding JSON, caller-selected destinations, and caller-selected signing keys remain prohibited.</Alert>
      </Stack></DialogContent>}
      <DialogActions><Button onClick={()=>setEditing(null)}>Cancel</Button><Button variant="contained" disabled={saving} onClick={()=>void save()}>Save</Button></DialogActions>
    </Dialog>
    <A2aPublicationDialog open={Boolean(publishing)} binding={publishing}
      onClose={()=>setPublishing(null)} onPublished={()=>void load()}/>
    <A2aAuthoringDialog open={authoring} hostId={host??''} environment={environment}
      onClose={()=>{setAuthoring(false);void loadAuthoring();}}/>
  </Box>;
}
