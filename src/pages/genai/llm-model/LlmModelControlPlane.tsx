import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import AgentDelegationPanel from './AgentDelegationPanel';
import { Alert, Box, Button, Tab, Tabs, Typography } from '@mui/material';
import { useUserState } from '../../../contexts/UserContext';
import { hasAnyRole } from '../../../utils/ownershipScope';
import PublicationPanel from './PublicationPanel';
import ResourcePanel from './ResourcePanel';
import { llmResources, type LlmRecord } from './types';

export default function LlmModelControlPlane() {
  const {host,roles} = useUserState() as {host?: string;roles?: string|null};
  const [search] = useSearchParams();
  const [tab,setTab] = useState(search.get("tab") === "agent-delegation" ? llmResources.length : 0);
  const [routeAlias, setRouteAlias] = useState<LlmRecord | null>(null);
  const [previousHost, setPreviousHost] = useState(host);
  if (previousHost !== host) {
    setPreviousHost(host);
    setRouteAlias(null);
  }
  const viewRoutes = (row: LlmRecord) => {
    setRouteAlias({...row, hostId: host});
    setTab(llmResources.findIndex(resource => resource.key === 'routes'));
  };
  const selectedAlias = routeAlias?.hostId === host ? routeAlias : null;
  return <Box sx={{p:2}}>
    <Typography variant="h4" gutterBottom>LLM Model Control Plane</Typography>
    <Typography color="text.secondary" sx={{mb:2}}>Manage model inventory, provider deployments, external credential references, routing policy, and immutable gateway publications.</Typography>
    <Tabs value={tab} onChange={(_,value) => { setTab(value); setRouteAlias(null); }} variant="scrollable" scrollButtons="auto" sx={{mb:2}}>
      {llmResources.map(resource => <Tab key={resource.key} label={resource.label}/>)}<Tab label="Agent Delegation"/><Tab label="Publication"/>
    </Tabs>
    {llmResources[tab]?.key === 'routes' && selectedAlias && <Alert severity="info" sx={{mb:2}}
      action={<Button color="inherit" size="small" onClick={() => setRouteAlias(null)}>Show all routes</Button>}>
      Routes for {String(selectedAlias.aliasName)} ({String(selectedAlias.environment)})
    </Alert>}
    {tab < llmResources.length ? <ResourcePanel key={`${llmResources[tab].scope === 'host' ? host ?? '' : 'global'}:${llmResources[tab].key}`} onViewRoutes={viewRoutes}
      routeAliasId={selectedAlias ? String(selectedAlias.publicAliasId) : undefined} hostId={host ?? ''} resource={llmResources[tab]}
      canMutate={llmResources[tab].scope === 'host' || hasAnyRole(roles, ['admin'])}/>
      : host ? (tab === llmResources.length + 1 ? <PublicationPanel hostId={host}/>
        : <AgentDelegationPanel hostId={host} initialInstanceId={search.get("instanceId") ?? ""}/>)
        : <Alert severity="info">Select a host to administer gateway configuration.</Alert>}
  </Box>;
}
