import {
  Box,
  Button,
  Chip,
  Divider,
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
  type SelectChangeEvent,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import type {
  ApiCatalogParams,
  CatalogSortField,
  CatalogSortOrder,
  CatalogStatus,
  CatalogViewMode,
  TagGroup,
  TagMatchMode,
  TaxonomyOption,
} from '../hooks/useApiCatalog';
import { formatTaxonomyLabel } from '../hooks/useApiCatalog';

type ApiCatalogFiltersProps = {
  params: ApiCatalogParams;
  categories: TaxonomyOption[];
  tagGroups: TagGroup[];
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onCategoryToggle: (value: string) => void;
  onTagToggle: (value: string) => void;
  onTagMatchChange: (value: TagMatchMode) => void;
  onStatusChange: (value: CatalogStatus) => void;
  onSortChange: (value: CatalogSortField) => void;
  onOrderChange: (value: CatalogSortOrder) => void;
  onViewChange: (value: CatalogViewMode) => void;
  onClear: () => void;
};

const uncategorizedOption: TaxonomyOption = {
  id: 'uncategorized',
  label: 'uncategorized',
  value: 'uncategorized',
};

function isSelected(values: string[], value: string) {
  return values.includes(value);
}

export default function ApiCatalogFilters({
  params,
  categories,
  tagGroups,
  isLoading,
  onSearchChange,
  onCategoryToggle,
  onTagToggle,
  onTagMatchChange,
  onStatusChange,
  onSortChange,
  onOrderChange,
  onViewChange,
  onClear,
}: ApiCatalogFiltersProps) {
  const categoryOptions = [...categories, uncategorizedOption];
  const hasFilters = !!params.q || params.categories.length > 0 || params.tags.length > 0 || params.status !== 'active';

  return (
    <Paper variant="outlined" sx={{ borderRadius: 1, p: 2 }}>
      <Stack spacing={2}>
        <Stack direction={{ xs: 'column', md: 'row' }} spacing={1.5} alignItems={{ xs: 'stretch', md: 'center' }}>
          <TextField
            size="small"
            fullWidth
            label="Search APIs"
            value={params.q}
            disabled={isLoading}
            onChange={(event) => onSearchChange(event.target.value)}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" />
                </InputAdornment>
              ),
            }}
          />

          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 140 } }}>
            <InputLabel>Status</InputLabel>
            <Select
              label="Status"
              value={params.status}
              disabled={isLoading}
              onChange={(event: SelectChangeEvent<CatalogStatus>) => onStatusChange(event.target.value as CatalogStatus)}
            >
              <MenuItem value="active">Active</MenuItem>
              <MenuItem value="inactive">Inactive</MenuItem>
            </Select>
          </FormControl>

          <FormControl size="small" sx={{ minWidth: { xs: '100%', md: 150 } }}>
            <InputLabel>Sort</InputLabel>
            <Select
              label="Sort"
              value={params.sort}
              disabled={isLoading}
              startAdornment={<SortIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />}
              onChange={(event: SelectChangeEvent<CatalogSortField>) => onSortChange(event.target.value as CatalogSortField)}
            >
              <MenuItem value="apiName">API Name</MenuItem>
              <MenuItem value="apiId">API ID</MenuItem>
              <MenuItem value="apiStatus">Status</MenuItem>
              <MenuItem value="updateTs">Updated</MenuItem>
            </Select>
          </FormControl>

          <ToggleButtonGroup
            size="small"
            exclusive
            value={params.order}
            disabled={isLoading}
            onChange={(_, value: CatalogSortOrder | null) => value && onOrderChange(value)}
            aria-label="Sort direction"
          >
            <ToggleButton value="asc">Asc</ToggleButton>
            <ToggleButton value="desc">Desc</ToggleButton>
          </ToggleButtonGroup>

          <ToggleButtonGroup
            size="small"
            exclusive
            value={params.view}
            disabled={isLoading}
            onChange={(_, value: CatalogViewMode | null) => value && onViewChange(value)}
            aria-label="View mode"
          >
            <ToggleButton value="grid" aria-label="Grid view">
              <ViewModuleIcon fontSize="small" />
            </ToggleButton>
            <ToggleButton value="list" aria-label="List view">
              <ViewListIcon fontSize="small" />
            </ToggleButton>
          </ToggleButtonGroup>

          <Button
            variant="outlined"
            startIcon={<ClearIcon />}
            disabled={!hasFilters || isLoading}
            onClick={onClear}
            sx={{ whiteSpace: 'nowrap' }}
          >
            Clear
          </Button>
        </Stack>

        <Divider />

        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Categories
          </Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap">
            {categoryOptions.map((category) => {
              const selected = isSelected(params.categories, category.value);
              return (
                <Chip
                  key={category.id}
                  clickable
                  color={selected ? 'primary' : 'default'}
                  variant={selected ? 'filled' : 'outlined'}
                  label={formatTaxonomyLabel(category.label)}
                  onClick={() => onCategoryToggle(category.value)}
                />
              );
            })}
          </Stack>
        </Box>

        <Box>
          <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 1 }}>
            <Typography variant="subtitle2">Tags</Typography>
            <ToggleButtonGroup
              size="small"
              exclusive
              value={params.tagMatch}
              disabled={isLoading || params.tags.length < 2}
              onChange={(_, value: TagMatchMode | null) => value && onTagMatchChange(value)}
              aria-label="Tag match mode"
            >
              <ToggleButton value="all">All</ToggleButton>
              <ToggleButton value="any">Any</ToggleButton>
            </ToggleButtonGroup>
          </Stack>

          <Stack spacing={1.5}>
            {tagGroups.length === 0 ? (
              <Typography variant="body2" color="text.secondary">
                No tags available.
              </Typography>
            ) : (
              tagGroups.map((group) => (
                <Box key={group.code}>
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
                    {group.label}
                  </Typography>
                  <Stack direction="row" gap={0.75} flexWrap="wrap">
                    {group.tags.map((tag) => {
                      const selected = isSelected(params.tags, tag.value);
                      return (
                        <Chip
                          key={tag.id}
                          clickable
                          size="small"
                          color={selected ? 'primary' : 'default'}
                          variant={selected ? 'filled' : 'outlined'}
                          label={formatTaxonomyLabel(tag.label)}
                          onClick={() => onTagToggle(tag.value)}
                        />
                      );
                    })}
                  </Stack>
                </Box>
              ))
            )}
          </Stack>
        </Box>
      </Stack>
    </Paper>
  );
}
