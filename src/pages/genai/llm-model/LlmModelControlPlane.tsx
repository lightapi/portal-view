import { useState } from 'react';
import { Alert, Box, Tab, Tabs, Typography } from '@mui/material';
import { useUserState } from '../../../contexts/UserContext';
import { hasAnyRole } from '../../../utils/ownershipScope';
import PublicationPanel from './PublicationPanel';
import ResourcePanel from './ResourcePanel';
import { llmResources } from './types';

export default function LlmModelControlPlane() {
  const {host,roles} = useUserState() as {host?: string;roles?: string|null};
  const [tab,setTab] = useState(0);
  return <Box sx={{p:2}}>
    <Typography variant="h4" gutterBottom>LLM Model Control Plane</Typography>
    <Typography color="text.secondary" sx={{mb:2}}>Manage model inventory, provider deployments, external credential references, routing policy, and immutable gateway publications.</Typography>
    <Tabs value={tab} onChange={(_,value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{mb:2}}>
      {llmResources.map(resource => <Tab key={resource.key} label={resource.label}/>)}<Tab label="Publication"/>
    </Tabs>
    {tab < llmResources.length ? <ResourcePanel hostId={host ?? ''} resource={llmResources[tab]}
      canMutate={llmResources[tab].scope === 'host' || hasAnyRole(roles, ['admin'])}/>
      : host ? <PublicationPanel hostId={host}/> : <Alert severity="info">Select a host to administer Publication.</Alert>}
  </Box>;
}
