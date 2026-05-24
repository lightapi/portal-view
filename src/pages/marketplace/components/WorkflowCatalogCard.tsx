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
import DetailsIcon from '@mui/icons-material/Details';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import SystemUpdateIcon from '@mui/icons-material/SystemUpdate';
import type { WorkflowCatalogItem, WorkflowCatalogViewMode } from '../hooks/useWorkflowCatalog';
import { formatWorkflowTaxonomyLabel } from '../hooks/useWorkflowCatalog';

type WorkflowCatalogCardProps = {
  workflow: WorkflowCatalogItem;
  viewMode: WorkflowCatalogViewMode;
  canModify: boolean;
  isUpdating: boolean;
  onDetails: (workflow: WorkflowCatalogItem) => void;
  onStart: (workflow: WorkflowCatalogItem) => void;
  onEdit: (workflow: WorkflowCatalogItem) => void;
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
        <Chip key={value} size="small" variant="outlined" label={formatWorkflowTaxonomyLabel(value)} />
      ))}
      {hiddenCount > 0 && <Chip size="small" label={`+${hiddenCount}`} />}
    </>
  );
}

function definitionPreview(definition?: string) {
  const lines = (definition ?? '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return lines.slice(0, 3).join(' ') || 'No definition preview';
}

export default function WorkflowCatalogCard({
  workflow,
  viewMode,
  canModify,
  isUpdating,
  onDetails,
  onStart,
  onEdit,
}: WorkflowCatalogCardProps) {
  const title = workflow.name || workflow.wfDefId;
  const subtitle = [workflow.namespace, workflow.version].filter(Boolean).join(' / ');

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
                {subtitle || workflow.wfDefId}
              </Typography>
            </Box>
            <Stack direction="row" gap={0.75} flexWrap="wrap" justifyContent="flex-end">
              <Chip size="small" color={workflow.active ? 'success' : 'default'} variant="outlined" label={workflow.active ? 'Active' : 'Inactive'} />
              <Chip size="small" color={workflow.catalogVisible ? 'primary' : 'default'} variant="outlined" label={workflow.catalogVisible ? 'Published' : 'Private'} />
            </Stack>
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
            {definitionPreview(workflow.definition)}
          </Typography>

          {workflow.updateTs && (
            <Typography variant="caption" color="text.secondary">
              Updated {new Date(workflow.updateTs).toLocaleString()}
            </Typography>
          )}

          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <TaxonomyChips values={workflow.categories} limit={3} emptyLabel="Uncategorized" />
          </Stack>

          <Stack direction="row" gap={0.75} flexWrap="wrap">
            <TaxonomyChips values={workflow.tags} limit={5} emptyLabel="No tags" />
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
          minWidth: viewMode === 'list' ? { md: 150 } : undefined,
        }}
      >
        <Button size="small" startIcon={<DetailsIcon />} onClick={() => onDetails(workflow)}>
          Details
        </Button>
        <Button size="small" startIcon={<PlayArrowIcon />} onClick={() => onStart(workflow)}>
          Start
        </Button>
        <Tooltip title={canModify ? 'Edit workflow' : 'You can only edit workflows you own.'}>
          <span>
            <Button
              size="small"
              startIcon={<SystemUpdateIcon />}
              disabled={!canModify || isUpdating}
              onClick={() => onEdit(workflow)}
            >
              Edit
            </Button>
          </span>
        </Tooltip>
      </CardActions>
    </Card>
  );
}
