import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Divider,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import type { ReactElement } from 'react';
import AddBoxIcon from '@mui/icons-material/AddBox';
import DetailsIcon from '@mui/icons-material/Details';
import FormatListBulletedIcon from '@mui/icons-material/FormatListBulleted';
import HubIcon from '@mui/icons-material/Hub';
import LayersIcon from '@mui/icons-material/Layers';
import RouteIcon from '@mui/icons-material/Route';
import SecurityIcon from '@mui/icons-material/Security';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import type { ApiCatalogItem, ApiCatalogSummary, CatalogViewMode } from '../hooks/useApiCatalog';
import { formatTaxonomyLabel } from '../hooks/useApiCatalog';

type ApiCatalogCardProps = {
  api: ApiCatalogItem;
  summary?: ApiCatalogSummary;
  isSummaryLoading: boolean;
  viewMode: CatalogViewMode;
  canModify: boolean;
  isUpdating: boolean;
  onDetails: (api: ApiCatalogItem) => void;
  onOpenEndpoints: (api: ApiCatalogItem, summary?: ApiCatalogSummary) => void;
  onCreateVersion: (api: ApiCatalogItem) => void;
  onUpdate: (api: ApiCatalogItem) => void;
};

function limited(values: string[] | undefined, limit: number) {
  const source = values ?? [];
  return {
    visible: source.slice(0, limit),
    hiddenCount: Math.max(0, source.length - limit),
  };
}

function TaxonomyChips({ values, limit, emptyLabel }: { values?: string[]; limit: number; emptyLabel: string }) {
  const { visible, hiddenCount } = limited(values, limit);

  if (visible.length === 0) {
    return <Chip size="small" variant="outlined" label={emptyLabel} />;
  }

  return (
    <>
      {visible.map((value) => (
        <Chip key={value} size="small" variant="outlined" label={formatTaxonomyLabel(value)} />
      ))}
      {hiddenCount > 0 && <Chip size="small" label={`+${hiddenCount}`} />}
    </>
  );
}

function metaValue(value: unknown) {
  if (value == null || value === '') return null;
  return String(value);
}

function countLabel(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

function SummaryChip({
  icon,
  label,
  tooltip,
}: {
  icon: ReactElement;
  label: string;
  tooltip: string;
}) {
  return (
    <Tooltip title={tooltip}>
      <Chip
        size="small"
        icon={icon}
        label={label}
        variant="outlined"
        sx={{
          maxWidth: '100%',
          '& .MuiChip-label': {
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          },
        }}
      />
    </Tooltip>
  );
}

export default function ApiCatalogCard({
  api,
  summary,
  isSummaryLoading,
  viewMode,
  canModify,
  isUpdating,
  onDetails,
  onOpenEndpoints,
  onCreateVersion,
  onUpdate,
}: ApiCatalogCardProps) {
  const title = api.apiName || api.apiId;
  const status = api.apiStatus || (api.active ? 'active' : 'inactive');
  const meta = [
    metaValue(api.businessGroup),
    metaValue(api.lob),
    metaValue(api.platform),
    metaValue(api.capability),
  ].filter(Boolean);
  const runtimeTooltip = summary?.runtimeNames.length
    ? summary.runtimeNames.join(', ')
    : 'No runtime binding found';
  const accessLabel = summary && summary.accessRuleCount > 0
    ? `${summary.protectedEndpointCount}/${summary.endpointCount} protected`
    : 'No rules';

  return (
    <Card
      variant="outlined"
      sx={{
        height: '100%',
        borderRadius: 1,
        display: 'flex',
        flexDirection: viewMode === 'list' ? { xs: 'column', md: 'row' } : 'column',
      }}
    >
      <CardContent sx={{ flex: 1, minWidth: 0, pb: 1.5 }}>
        <Stack spacing={1.5}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1.5 }}>
            <Box sx={{ minWidth: 0 }}>
              <Tooltip title={title}>
                <Typography
                  variant="h6"
                  sx={{
                    fontSize: 18,
                    lineHeight: 1.25,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {title}
                </Typography>
              </Tooltip>
              <Typography variant="caption" color="text.secondary">
                {api.apiId}
              </Typography>
            </Box>
            <Chip size="small" color={api.active ? 'success' : 'default'} variant="outlined" label={formatTaxonomyLabel(status)} />
          </Box>

          <Typography
            variant="body2"
            color="text.secondary"
            sx={{
              minHeight: viewMode === 'list' ? 0 : 42,
              display: '-webkit-box',
              WebkitLineClamp: viewMode === 'list' ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {api.apiDesc || 'No description'}
          </Typography>

          {meta.length > 0 && (
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              {meta.join(' / ')}
            </Typography>
          )}

          <Stack direction="row" gap={0.75} flexWrap="wrap">
            {isSummaryLoading ? (
              <>
                <Skeleton variant="rounded" width={118} height={24} />
                <Skeleton variant="rounded" width={104} height={24} />
                <Skeleton variant="rounded" width={98} height={24} />
              </>
            ) : (
              <>
                <SummaryChip
                  icon={<LayersIcon fontSize="small" />}
                  label={summary?.latestVersion ? `${summary.latestVersion} (${summary.versionCount})` : countLabel(0, 'version')}
                  tooltip={summary?.latestVersion
                    ? `${countLabel(summary.versionCount, 'version')} registered. Latest: ${summary.latestVersion}.`
                    : 'No active API versions found.'}
                />
                <SummaryChip
                  icon={<RouteIcon fontSize="small" />}
                  label={countLabel(summary?.endpointCount ?? 0, 'endpoint')}
                  tooltip={`${countLabel(summary?.endpointCount ?? 0, 'endpoint')} across active versions.`}
                />
                <SummaryChip
                  icon={<HubIcon fontSize="small" />}
                  label={countLabel(summary?.runtimeCount ?? 0, 'runtime')}
                  tooltip={runtimeTooltip}
                />
                <SummaryChip
                  icon={<SecurityIcon fontSize="small" />}
                  label={accessLabel}
                  tooltip={summary && summary.accessRuleCount > 0
                    ? `${countLabel(summary.accessRuleCount, 'access rule')} on ${countLabel(summary.protectedEndpointCount, 'endpoint')}.`
                    : 'No active endpoint access rules found.'}
                />
              </>
            )}
          </Stack>

          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <TaxonomyChips values={api.categories} limit={3} emptyLabel="Uncategorized" />
          </Stack>

          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <TaxonomyChips values={api.tags} limit={5} emptyLabel="No tags" />
          </Stack>
        </Stack>
      </CardContent>

      <Divider flexItem orientation={viewMode === 'list' ? 'vertical' : 'horizontal'} />

      <CardActions
        sx={{
          p: 1.5,
          alignItems: viewMode === 'list' ? { xs: 'stretch', md: 'flex-end' } : 'center',
          justifyContent: 'flex-end',
          flexDirection: viewMode === 'list' ? { xs: 'row', md: 'column' } : 'row',
          flexWrap: 'wrap',
          minWidth: viewMode === 'list' ? { md: 170 } : undefined,
        }}
      >
        <Button size="small" startIcon={<DetailsIcon />} onClick={() => onDetails(api)}>
          Details
        </Button>
        <Button
          size="small"
          startIcon={<FormatListBulletedIcon />}
          disabled={!summary?.latestVersionId}
          onClick={() => onOpenEndpoints(api, summary)}
        >
          Endpoints
        </Button>
        <Button size="small" startIcon={<AddBoxIcon />} onClick={() => onCreateVersion(api)}>
          Version
        </Button>
        <Tooltip title={canModify ? 'Update API' : 'You can only update APIs you own.'}>
          <span>
            <Button
              size="small"
              startIcon={<SystemUpdateIcon />}
              disabled={!canModify || isUpdating}
              onClick={() => onUpdate(api)}
            >
              Update
            </Button>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  );
}
