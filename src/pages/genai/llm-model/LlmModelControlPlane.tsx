import { useState } from 'react';
import { Alert, Box, Tab, Tabs, Typography } from '@mui/material';
import { useUserState } from '../../../contexts/UserContext';
import PublicationPanel from './PublicationPanel';
import ResourcePanel from './ResourcePanel';
import { llmResources } from './types';

export default function LlmModelControlPlane() {
  const {host} = useUserState() as {host?: string};
  const [tab,setTab] = useState(0);
  if (!host) return <Alert severity="info">Select a host to administer LLM models.</Alert>;
  return <Box sx={{p:2}}>
    <Typography variant="h4" gutterBottom>LLM Model Control Plane</Typography>
    <Typography color="text.secondary" sx={{mb:2}}>Manage model inventory, provider deployments, external credential references, routing policy, and immutable gateway publications.</Typography>
    <Tabs value={tab} onChange={(_,value) => setTab(value)} variant="scrollable" scrollButtons="auto" sx={{mb:2}}>
      {llmResources.map(resource => <Tab key={resource.key} label={resource.label}/>)}<Tab label="Publication"/>
    </Tabs>
    {tab < llmResources.length ? <ResourcePanel hostId={host} resource={llmResources[tab]}/> : <PublicationPanel hostId={host}/>} 
  </Box>;
}
