import { PortalActionScope } from '../../components/PortalActions/PortalActions';
import { PortalActionTableCell } from '../../components/PortalActions/PortalActionTableCell';
import PortalDeleteIcon from '@mui/icons-material/DeleteForever';
import { useCallback, useEffect, useState } from 'react';
import {
  Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControlLabel, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow,
  Typography,
} from '@mui/material';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { loadErrorMessage } from '../../utils/loadErrorMessage';

type BindingRef = {hostId:string; a2aBindingId:string; bindingName:string};
type Candidate = {
  candidateDigest:string; publicationId:string; expectedPublicationVersion:number;
  publicationVersion:number; unsignedAgentCard:unknown; unsignedExtendedAgentCard?:unknown; propertyComparisons?:Array<{
    audience:string; property:string; action:string; currentValue:unknown; proposedValue:unknown;
  }>;
};
type History = {publicationId:string; publicationVersion:number; publicationState:string;
  contentDigest?:string; updateTs?:string};

const rpc=(action:string,data:Record<string,unknown>)=>({
  host:'lightapi.net',service:'genai',action,version:'0.1.0',data,
});

export default function A2aPublicationDialog({open,binding,onClose,onPublished}:{
  open:boolean; binding:BindingRef|null; onClose:()=>void; onPublished:()=>void;
}) {
  const [candidate,setCandidate]=useState<Candidate|null>(null);
  const [history,setHistory]=useState<History[]>([]);
  const [confirmed,setConfirmed]=useState(false);
  const [emergency,setEmergency]=useState(false);
  const [busy,setBusy]=useState(false);
  const [message,setMessage]=useState<{severity:'info'|'success'|'error';text:string}|null>(null);

  const loadHistory=useCallback(async()=>{
    if(!open||!binding)return;
    try {
      const value=await fetchClient('/portal/query?cmd='+encodeURIComponent(JSON.stringify(
        rpc('getA2aPublicationHistory',{hostId:binding.hostId,a2aBindingId:binding.a2aBindingId}))));
      setHistory(value.a2aPublications??[]);
    } catch(reason) { setMessage({severity:'error',text:loadErrorMessage(reason)}); }
  },[binding,open]);

  useEffect(()=>{ if(open){setCandidate(null);setConfirmed(false);setEmergency(false);setMessage(null);void loadHistory();}},[loadHistory,open]);

  const preview=async()=>{
    if(!binding)return; setBusy(true); setMessage(null);
    try {
      const value=await fetchClient('/portal/query?cmd='+encodeURIComponent(JSON.stringify(
        rpc('getA2aPublicationCandidate',{hostId:binding.hostId,a2aBindingId:binding.a2aBindingId}))));
      setCandidate(value as Candidate); setConfirmed(false);
      setMessage({severity:'info',text:'Review the exact signed card and desired property changes. Publication stages one Config Server generation; it does not move the active snapshot.'});
    } catch(reason) { setMessage({severity:'error',text:loadErrorMessage(reason)}); }
    finally { setBusy(false); }
  };

  const publish=async()=>{
    if(!binding||!candidate)return; setBusy(true); setMessage(null);
    const prepare=await apiPost({url:'/portal/command',headers:{},body:rpc('prepareA2aPublication',{
      hostId:binding.hostId,a2aBindingId:binding.a2aBindingId,publicationId:candidate.publicationId,
      expectedPublicationVersion:candidate.expectedPublicationVersion,candidateDigest:candidate.candidateDigest,
    })});
    if(prepare.error){setBusy(false);setMessage({severity:'error',text:loadErrorMessage(prepare.error)});return;}
    const signed=await apiPost({url:'/portal/command',headers:{},body:rpc('publishA2aPublication',{
      hostId:binding.hostId,a2aBindingId:binding.a2aBindingId,publicationId:candidate.publicationId,
    })});
    setBusy(false);
    if(signed.error){setMessage({severity:'error',text:loadErrorMessage(signed.error)});await loadHistory();return;}
    setCandidate(null); setConfirmed(false);
    setMessage({severity:'success',text:`Publication ${candidate.publicationVersion} is signed and staged. Create and activate the instance Config Server snapshot, then trigger the normal module reload.`});
    await loadHistory(); onPublished();
  };

  const revoke=async(row:History)=>{
    if(!binding||!window.confirm(`Revoke publication ${row.publicationVersion}?`))return;
    setBusy(true);
    const result=await apiPost({url:'/portal/command',headers:{},body:rpc('revokeA2aPublication',{
      hostId:binding.hostId,a2aBindingId:binding.a2aBindingId,publicationId:row.publicationId,
      emergencyRevokeSigningProfile:emergency,
    })});
    setBusy(false);
    if(result.error)setMessage({severity:'error',text:loadErrorMessage(result.error)});
    else {setMessage({severity:'success',text:'Revocation desired state is staged. Activate a Config Server snapshot to deploy it.'});await loadHistory();onPublished();}
  };

  return <Dialog open={open} onClose={busy?undefined:onClose} maxWidth="lg" fullWidth>
    <DialogTitle>Publish A2A Agent Card · {binding?.bindingName}</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{pt:1}}>
      <Alert severity="info">The immutable card is signed by light-oauth. Portal UUIDs, private skill content, and signing keys are not disclosed in the public card.</Alert>
      {message&&<Alert severity={message.severity}>{message.text}</Alert>}
      {candidate&&<>
        <Typography variant="h6">Compiled preview · version {candidate.publicationVersion}</Typography>
        <Paper variant="outlined" sx={{p:2,maxHeight:280,overflow:'auto'}}><pre style={{margin:0,whiteSpace:'pre-wrap'}}>{JSON.stringify(candidate.unsignedAgentCard,null,2)}</pre></Paper>
        {candidate.unsignedExtendedAgentCard&&<><Typography variant="subtitle1">Authenticated extended Agent Card</Typography><Paper variant="outlined" sx={{p:2,maxHeight:280,overflow:'auto'}}><pre style={{margin:0,whiteSpace:'pre-wrap'}}>{JSON.stringify(candidate.unsignedExtendedAgentCard,null,2)}</pre></Paper></>}
        <Table size="small"><TableHead><TableRow><TableCell>Audience</TableCell><TableCell>Property</TableCell><TableCell>Action</TableCell></TableRow></TableHead>
          <TableBody>{(candidate.propertyComparisons??[]).map((change,index)=><TableRow key={`${change.property}-${index}`}><TableCell>{change.audience}</TableCell><TableCell>{change.property}</TableCell><TableCell>{change.action}</TableCell></TableRow>)}</TableBody></Table>
        <FormControlLabel control={<Checkbox checked={confirmed} onChange={event=>setConfirmed(event.target.checked)}/>} label="I reviewed the card, signing profile, access policy, runtime targets, and staged property changes."/>
      </>}
      <Typography variant="h6">Publication history</Typography>
      <FormControlLabel control={<Checkbox checked={emergency} onChange={event=>setEmergency(event.target.checked)}/>} label="Emergency revocation: also advance the signing profile revocation epoch"/>
      <PortalActionScope><Table size="small"><TableHead><TableRow><TableCell>Version</TableCell><TableCell>State</TableCell><TableCell>Digest</TableCell><TableCell>Updated</TableCell><TableCell /></TableRow></TableHead>
        <TableBody>{history.map(row => <TableRow key={row.publicationId}><TableCell>{row.publicationVersion}</TableCell><TableCell>{row.publicationState}</TableCell><TableCell sx={{ fontFamily: 'monospace' }}>{row.contentDigest}</TableCell><TableCell>{row.updateTs}</TableCell><PortalActionTableCell row={row} actions={[
          { id: 'revoke', label: 'Revoke', description: 'Stage revocation of this publication.', icon: <PortalDeleteIcon />, destructive: true, disabledReason: () => !['STAGED', 'ACTIVE'].includes(row.publicationState) ? 'Only staged or active publications can be revoked.' : null, loading: () => busy, onSelect: () => void revoke(row) },
        ]} /></TableRow>)}</TableBody></Table></PortalActionScope>
    </Stack></DialogContent>
    <DialogActions><Button onClick={onClose} disabled={busy}>Close</Button><Button onClick={()=>void preview()} disabled={busy||!binding}>Preview</Button><Button variant="contained" onClick={()=>void publish()} disabled={busy||!candidate||!confirmed}>Sign and stage</Button></DialogActions>
  </Dialog>;
}
