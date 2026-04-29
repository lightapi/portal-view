import { useState } from 'react';
import { Alert, Box, Stack, Typography } from '@mui/material';
import BusinessOutlinedIcon from '@mui/icons-material/BusinessOutlined';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import PublicOutlinedIcon from '@mui/icons-material/PublicOutlined';
import { config } from '../../../config';
import ChoiceCard from '../../components/ChoiceCard';

export type ApiOrigin = 'third-party';

interface Props {
  value: ApiOrigin | null;
  onChange: (o: ApiOrigin) => void;
}

export default function SelectApiOriginStep({ value, onChange }: Props) {
  const [linkOpened, setLinkOpened] = useState(false);

  const handleInternalClick = () => {
    window.open(config.apiOnboardUrl, '_blank', 'noopener,noreferrer');
    setLinkOpened(true);
  };

  return (
    <Stack spacing={3}>
      <Box sx={{ display: 'flex', gap: 3, flexDirection: { xs: 'column', sm: 'row' }, flexWrap: 'wrap' }}>
        <ChoiceCard
          icon={<BusinessOutlinedIcon sx={{ fontSize: 40 }} />}
          title="Internal API"
          description="This API is developed and operated within your organization. Use the platform's built-in API onboarding flow to register it."
          selected={false}
          onClick={handleInternalClick}
          badge={
            linkOpened ? (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'success.main' }}>
                <CheckCircleIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption" fontWeight={600}>Opened in new tab</Typography>
              </Box>
            ) : (
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, color: 'text.disabled' }}>
                <OpenInNewIcon sx={{ fontSize: 14 }} />
                <Typography variant="caption">Opens onboarding portal</Typography>
              </Box>
            )
          }
        />
        <ChoiceCard
          icon={<PublicOutlinedIcon sx={{ fontSize: 40 }} />}
          title="Third-party API"
          description="This API is provided by an external service or vendor. You can register it here by providing its spec and metadata, then expose it as an MCP server."
          selected={value === 'third-party'}
          onClick={() => onChange('third-party')}
        />
      </Box>

      {linkOpened && (
        <Alert severity="info" sx={{ borderRadius: 2 }}>
          The API onboarding portal has been opened in a new tab. You can close this wizard or continue here if you also need to register a third-party API.
        </Alert>
      )}
    </Stack>
  );
}
