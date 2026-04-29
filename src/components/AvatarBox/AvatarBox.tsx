import { Box } from '@mui/material';
import type { SxProps, Theme } from '@mui/material/styles';

interface AvatarBoxProps {
  /** Box width and height in pixels. Default: 32 */
  size?: number;
  /** MUI theme color token or CSS color string, e.g. 'primary.main' or '#4a90d9' */
  bgcolor: string;
  /** Border radius theme multiplier. Default: 1 (8px) */
  borderRadius?: number;
  children: React.ReactNode;
  sx?: SxProps<Theme>;
}

/**
 * A square avatar box with a background color and centred content (icon or initials).
 * Generic — no MCP-specific logic.
 */
export default function AvatarBox({
  size = 32,
  bgcolor,
  borderRadius = 1,
  children,
  sx,
}: AvatarBoxProps) {
  return (
    <Box
      sx={{
        width: size,
        height: size,
        borderRadius,
        bgcolor,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        color: '#fff',
        ...sx,
      }}
    >
      {children}
    </Box>
  );
}
