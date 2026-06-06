import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  Divider,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DetailsIcon from '@mui/icons-material/Details';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import SchemaIcon from '@mui/icons-material/Schema';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import type { SchemaCatalogItem, SchemaCatalogViewMode } from '../hooks/useSchemaCatalog';
import { formatSchemaTaxonomyLabel, schemaExternalPath } from '../hooks/useSchemaCatalog';

type SchemaCatalogCardProps = {
  schema: SchemaCatalogItem;
  viewMode: SchemaCatalogViewMode;
  isUpdating: boolean;
  onDetails: (schema: SchemaCatalogItem) => void;
  onCopyUrl: (schema: SchemaCatalogItem) => void;
  onOpenUrl: (schema: SchemaCatalogItem) => void;
  onUpdate: (schema: SchemaCatalogItem) => void;
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
        <Chip key={value} size="small" variant="outlined" label={formatSchemaTaxonomyLabel(value)} />
      ))}
      {hiddenCount > 0 && <Chip size="small" label={`+${hiddenCount}`} />}
    </>
  );
}

function schemaStatusLabel(status?: string) {
  switch (status) {
    case 'D':
      return 'Draft';
    case 'P':
      return 'Published';
    case 'R':
      return 'Retired';
    default:
      return status || 'Unknown';
  }
}

export default function SchemaCatalogCard({
  schema,
  viewMode,
  isUpdating,
  onDetails,
  onCopyUrl,
  onOpenUrl,
  onUpdate,
}: SchemaCatalogCardProps) {
  const title = schema.schemaName || schema.schemaAlias || schema.schemaId;
  const externalPath = schemaExternalPath(schema);
  const canUseExternalUrl = !!externalPath && !!schema.externalVisible && schema.schemaStatus === 'P';

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
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', overflowWrap: 'anywhere' }}>
                {schema.schemaId}
              </Typography>
            </Box>
            <Chip size="small" color={schema.active ? 'success' : 'default'} variant="outlined" label={schema.active ? 'Active' : 'Inactive'} />
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
            {schema.schemaDesc || 'No description'}
          </Typography>

          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <Chip size="small" icon={<SchemaIcon fontSize="small" />} label={`${schema.schemaType} ${schema.specVersion}`} variant="outlined" />
            <Chip size="small" label={`Version ${schema.schemaVersion}`} variant="outlined" />
            <Chip size="small" color={schema.schemaStatus === 'P' ? 'primary' : 'default'} variant="outlined" label={schemaStatusLabel(schema.schemaStatus)} />
            <Chip size="small" color={schema.externalVisible ? 'success' : 'default'} variant="outlined" label={schema.externalVisible ? 'External' : 'Private'} />
          </Stack>

          {schema.schemaAlias && (
            <Typography variant="caption" color="text.secondary" sx={{ overflowWrap: 'anywhere' }}>
              Alias: {schema.schemaAlias}
            </Typography>
          )}

          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <TaxonomyChips values={schema.categories} limit={3} emptyLabel="Uncategorized" />
          </Stack>

          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <TaxonomyChips values={schema.tags} limit={5} emptyLabel="No tags" />
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
        <Button size="small" startIcon={<DetailsIcon />} onClick={() => onDetails(schema)}>
          Details
        </Button>
        <Button size="small" startIcon={<ContentCopyIcon />} disabled={!canUseExternalUrl} onClick={() => onCopyUrl(schema)}>
          Copy URL
        </Button>
        <Button size="small" startIcon={<OpenInNewIcon />} disabled={!canUseExternalUrl} onClick={() => onOpenUrl(schema)}>
          Open
        </Button>
        <Button size="small" startIcon={<SystemUpdateIcon />} disabled={isUpdating} onClick={() => onUpdate(schema)}>
          {isUpdating ? 'Loading' : 'Update'}
        </Button>
      </CardActions>
    </Card>
  );
}
