import { Stack, TextField, Typography } from '@mui/material';
import RouterOutlinedIcon from '@mui/icons-material/RouterOutlined';
import { SectionCard } from './SectionCard';
import type { CreateApiVersionForm } from './types';

interface TransportConfigPanelProps {
  form: CreateApiVersionForm;
  errors: Partial<Record<keyof CreateApiVersionForm, string>>;
  useStructuredTransport: boolean;
  parsedTransport: Record<string, string>;
  patchTransport: (changes: Record<string, string>) => void;
  patch: (p: Partial<CreateApiVersionForm>) => void;
}

/**
 * MCP transport configuration section inside CreateApiVersionStep.
 * Only rendered when `form.apiType === 'mcp'`.
 */
export default function TransportConfigPanel({
  form, errors, useStructuredTransport, parsedTransport, patchTransport, patch,
}: TransportConfigPanelProps) {
  return (
    <SectionCard
      title={useStructuredTransport ? 'Server Connection' : 'MCP Transport Config'}
      icon={<RouterOutlinedIcon />}
    >
      {useStructuredTransport ? (
        <Stack spacing={2}>
          <TextField
            label="Transport"
            fullWidth
            value="Streamable HTTP"
            disabled
            helperText="Only Streamable HTTP is supported at this time"
          />
          <TextField
            label="Server URL"
            fullWidth
            required
            value={parsedTransport.url ?? ''}
            onChange={(e) => patchTransport({ url: e.target.value })}
            error={!!errors.transportConfig}
            helperText={errors.transportConfig || 'The endpoint the BFF will connect to for tool discovery and invocation'}
            placeholder="https://your-mcp-server.example.com/mcp"
          />
        </Stack>
      ) : (
        <Stack spacing={1}>
          <Typography variant="body2" color="text.secondary">
            JSON configuration for the MCP transport layer.
          </Typography>
          <TextField
            fullWidth
            multiline
            minRows={4}
            value={form.transportConfig}
            onChange={(e) => patch({ transportConfig: e.target.value })}
            error={!!errors.transportConfig}
            helperText={errors.transportConfig}
            slotProps={{ input: { sx: { fontFamily: 'monospace', fontSize: '0.85rem' } } }}
          />
        </Stack>
      )}
    </SectionCard>
  );
}
