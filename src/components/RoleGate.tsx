import { Alert, Box, Typography } from '@mui/material';
import type { ReactNode } from 'react';
import { useUserState } from '../contexts/UserContext';
import { hasAnyRole } from '../utils/ownershipScope';

type Props = {
  roles: string[];
  children: ReactNode;
};

export default function RoleGate({ roles, children }: Props) {
  const { roles: userRoles } = useUserState() as { roles?: string | null };

  if (hasAnyRole(userRoles, ['admin']) || hasAnyRole(userRoles, roles)) {
    return <>{children}</>;
  }

  return (
    <Box sx={{ p: 3, maxWidth: 720 }}>
      <Typography variant="h5" sx={{ mb: 2 }}>Access Required</Typography>
      <Alert severity="warning">
        This page requires {roles.join(', ')} access.
      </Alert>
    </Box>
  );
}
