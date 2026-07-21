import { Alert, Box, Typography } from '@mui/material';
import { useUserState } from '../../contexts/UserContext';
import ResourcePanel from '../genai/llm-model/ResourcePanel';
import { llmCatalogResource } from '../genai/llm-model/types';

export default function LlmModelCatalog() {
  const {host} = useUserState() as {host?: string};
  if (!host) return <Alert severity="info">Select a host to browse and administer the LLM model catalog.</Alert>;
  return <Box sx={{p:2}}>
    <Typography variant="h4" gutterBottom>LLM Model Catalog</Typography>
    <Typography color="text.secondary" sx={{mb:2}}>
      Manage the provider model inventory used by registrations and deployments in the LLM Model Control Plane.
    </Typography>
    <ResourcePanel hostId={host} resource={llmCatalogResource}/>
  </Box>;
}
