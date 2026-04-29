import { Box, Divider, Paper, Skeleton, Stack } from '@mui/material';
import { alpha } from '@mui/material/styles';

interface SkeletonCardRowProps {
  /** Number of skeleton rows to render. Default: 3 */
  count?: number;
  /** Avatar skeleton size in pixels. Default: 36 */
  avatarSize?: number;
  /**
   * Whether to render a Divider + extra row below the header skeleton,
   * matching cards that have a details section. Default: true
   */
  showDetailsRow?: boolean;
}

/**
 * Loading placeholder that mimics the outline card + avatar + two text lines
 * pattern used throughout the MCP and admin pages.
 * Generic — no domain-specific logic.
 */
export default function SkeletonCardRow({
  count = 3,
  avatarSize = 36,
  showDetailsRow = true,
}: SkeletonCardRowProps) {
  return (
    <Stack spacing={1.5}>
      {Array.from({ length: count }).map((_, i) => (
        <Paper
          key={i}
          variant="outlined"
          sx={{ borderRadius: 2, overflow: 'hidden', borderColor: (t) => alpha(t.palette.divider, 0.7) }}
        >
          <Box
            sx={{
              display: 'flex',
              alignItems: 'center',
              gap: 1.5,
              px: 2,
              py: 1.5,
              bgcolor: (t) => alpha(t.palette.common.black, 0.02),
            }}
          >
            <Skeleton
              variant="rounded"
              width={avatarSize}
              height={avatarSize}
              sx={{ borderRadius: avatarSize <= 32 ? 1 : 1.5, flexShrink: 0 }}
            />
            <Box sx={{ flex: 1 }}>
              <Skeleton width={160} height={16} />
              <Skeleton width={240} height={13} sx={{ mt: 0.5 }} />
            </Box>
          </Box>
          {showDetailsRow && (
            <>
              <Divider />
              <Box sx={{ px: 2, py: 1.5 }}>
                <Skeleton width={200} height={14} />
              </Box>
            </>
          )}
        </Paper>
      ))}
    </Stack>
  );
}
