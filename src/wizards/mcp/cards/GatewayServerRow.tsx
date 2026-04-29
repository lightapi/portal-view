import { Box, Stack, Typography, Tooltip } from '@mui/material';
import { alpha } from '@mui/material/styles';
import ApiOutlinedIcon from '@mui/icons-material/ApiOutlined';
import DnsOutlinedIcon from '@mui/icons-material/DnsOutlined';
import { useNavigate } from 'react-router-dom';
import { apiIconColor, ConfigureButton } from '../McpStatusChip';
import ToolChipList from '../shared/ToolChipList';
import type { McpStatus } from '../listTypes';

export interface GatewayServer {
  instanceApiId: string;
  apiId: string;
  apiName: string;
  apiVersion: string;
  apiVersionId: string;
  apiType?: string;
  envTag?: string;
  mcpStatus: McpStatus;
}

interface GatewayServerRowProps {
  server: GatewayServer;
  instanceId: string;
  navigate: ReturnType<typeof useNavigate>;
}

export default function GatewayServerRow({ server, instanceId, navigate }: GatewayServerRowProps) {
  const iconBg = apiIconColor(server.apiName);
  const toolNames = server.mcpStatus.phase === 'ready' ? server.mcpStatus.tools : [];
  const phaseBorder =
    server.mcpStatus.phase === 'ready'
      ? 'success.main'
      : server.mcpStatus.phase === 'unconfigured' || server.mcpStatus.phase === 'no-tools'
      ? 'info.light'
      : 'divider';

  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'stretch',
        borderLeft: '3px solid',
        borderColor: phaseBorder,
        '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.03) },
        transition: 'background-color 0.15s',
      }}
    >
      {/* Column 1: name + id + version */}
      <Box
        sx={{
          minWidth: 0,
          width: { xs: '48%', md: 320 },
          px: 2,
          py: 1.5,
          borderRight: '1px solid',
          borderColor: 'divider',
          flexShrink: 0,
        }}
      >
        <Stack direction="row" alignItems="center" spacing={1.25}>
          {/* Avatar */}
          <Box
            sx={{
              width: 32, height: 32, borderRadius: 0.75,
              bgcolor: iconBg,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: '#fff', fontSize: '0.7rem', fontWeight: 700, flexShrink: 0,
            }}
          >
            {(server.apiName || server.apiId)[0].toUpperCase()}
          </Box>

          {/* Text rows */}
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack direction="row" alignItems="baseline" spacing={0.75}>
              <Typography variant="subtitle2" fontWeight={700} noWrap sx={{ minWidth: 0 }}>
                {server.apiName || server.apiId}
              </Typography>
              <Typography variant="caption" color="text.disabled" noWrap sx={{ fontFamily: 'monospace', flexShrink: 0 }}>
                {server.apiId}
              </Typography>
            </Stack>

            <Stack direction="row" alignItems="center" spacing={0.75} sx={{ mt: 0.3 }}>
              <Typography variant="caption" color="text.disabled" sx={{ fontFamily: 'monospace', fontWeight: 600, flexShrink: 0 }}>
                v{server.apiVersion}
              </Typography>
              <Tooltip title={server.apiType === 'mcp' ? 'Standalone MCP Server' : 'API-Based MCP Server'}>
                <Box sx={{ display: 'inline-flex', alignItems: 'center' }}>
                  {server.apiType === 'mcp'
                    ? <DnsOutlinedIcon sx={{ fontSize: 13, color: 'primary.main' }} />
                    : <ApiOutlinedIcon sx={{ fontSize: 13, color: 'text.secondary' }} />
                  }
                </Box>
              </Tooltip>
            </Stack>
          </Box>
        </Stack>
      </Box>

      {/* Column 2: tools */}
      <Box sx={{ flex: 1, minWidth: 0, px: 2, py: 1.5, display: 'flex', alignItems: 'center' }}>
        <ToolChipList tools={toolNames} maxVisible={3} chipHeight={20} fontSize="0.66rem" />
      </Box>

      {/* Column 3: configure */}
      <Box
        sx={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          px: 2, py: 1.5, flexShrink: 0,
          borderLeft: '1px solid', borderColor: 'divider',
        }}
      >
        <ConfigureButton
          onClick={() => navigate(`/app/mcp/wizard?instanceApiId=${server.instanceApiId}&instanceId=${instanceId}${server.apiType === 'mcp' ? '&flow=server' : ''}`)}
        />
      </Box>
    </Box>
  );
}
