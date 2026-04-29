import { Box } from '@mui/material';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined';
import ChoiceCard from '../../components/ChoiceCard';

export type GatewayMode = 'centralized' | 'distributed';

interface Props {
  value: GatewayMode | null;
  onChange: (mode: GatewayMode) => void;
  /** When provided, distributed is only enabled if this list is non-empty. */
  distributedInstanceIds?: string[];
  /** Override the tooltip shown when distributed is disabled. */
  distributedDisabledReason?: string;
}

export default function SelectGatewayModeStep({ value, onChange, distributedInstanceIds, distributedDisabledReason }: Props) {
  const distributedDisabled = distributedInstanceIds !== undefined && distributedInstanceIds.length === 0;
  const comingSoon = !!distributedDisabledReason?.toLowerCase().includes('coming soon');
  const disabledReason = distributedDisabledReason ??
    'This API has no qualifying service instances deployed. Deploy it on a service instance first, or choose Centralized.';
  return (
    <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap' }}>
      <ChoiceCard
        icon={<RouterOutlinedIcon sx={{ fontSize: 40 }} />}
        title="Centralized MCP Gateway"
        description="Expose this API through a shared centralized gateway instance. Best when multiple APIs or teams share a single managed gateway."
        selected={value === 'centralized'}
        onClick={() => onChange('centralized')}
      />
      <ChoiceCard
        icon={<DnsOutlinedIcon sx={{ fontSize: 40 }} />}
        title="Distributed"
        description="Deploy directly on the service's own instance. Best for per-service MCP tool ownership with independent deployment lifecycles."
        selected={value === 'distributed'}
        disabled={distributedDisabled}
        disabledReason={disabledReason}
        comingSoon={comingSoon}
        onClick={() => onChange('distributed')}
      />
    </Box>
  );
}
