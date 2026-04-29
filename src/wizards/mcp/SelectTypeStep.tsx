import { Box } from '@mui/material';
import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import SearchIcon from '@mui/icons-material/Search';
import ChoiceCard from '../../components/ChoiceCard';

export type McpCreationType = 'api' | 'api-continue' | 'existing-api' | 'server' | 'onboard';

interface Props {
  value: McpCreationType | null;
  onChange: (v: McpCreationType) => void;
}

export default function SelectTypeStep({ value, onChange }: Props) {
  return (
    <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap' }}>
      <ChoiceCard
        icon={<SearchIcon sx={{ fontSize: 40 }} />}
        title="Existing API"
        description="Pick an API already registered in the platform. Continue from wherever it is — version, gateway linkage, or tool selection."
        selected={value === 'existing-api'}
        onClick={() => onChange('existing-api')}
      />
      <ChoiceCard
        icon={<DnsOutlinedIcon sx={{ fontSize: 40 }} />}
        title="Standalone MCP Server"
        description="Create an API with type MCP. Provide the server URL in the transport config and the BFF will use it to discover available tools."
        selected={value === 'server'}
        onClick={() => onChange('server')}
      />
      <ChoiceCard
        icon={<ApiOutlinedIcon sx={{ fontSize: 40 }} />}
        title="New API as MCP"
        description="Upload an OpenAPI spec to create a new logical API, add a version, link it to a gateway, and configure MCP tool mappings in one guided flow."
        selected={value === 'api'}
        onClick={() => onChange('api')}
      />
    </Box>
  );
}

