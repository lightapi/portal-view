import {
  Box, Button, Chip, Divider, FormControl, InputAdornment, InputLabel, MenuItem,
  Paper, Select, Stack, TextField, ToggleButton, ToggleButtonGroup, Typography,
  type SelectChangeEvent,
} from '@mui/material';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import SortIcon from '@mui/icons-material/Sort';
import ViewListIcon from '@mui/icons-material/ViewList';
import ViewModuleIcon from '@mui/icons-material/ViewModule';
import { formatTaxonomyLabel } from '../hooks/useApiCatalog';
import type {
  LlmModelCatalogParams, LlmModelCatalogSortField, LlmModelCatalogSortOrder,
  LlmModelCatalogStatus, LlmModelCatalogViewMode, LlmModelTagMatchMode,
  LlmTagGroup, LlmTaxonomyOption,
} from '../hooks/useLlmModelCatalog';

type Props = {
  params: LlmModelCatalogParams;
  categories: LlmTaxonomyOption[];
  tagGroups: LlmTagGroup[];
  isLoading: boolean;
  onSearchChange: (value: string) => void;
  onCategoryToggle: (value: string) => void;
  onTagToggle: (value: string) => void;
  onTagMatchChange: (value: LlmModelTagMatchMode) => void;
  onStatusChange: (value: LlmModelCatalogStatus) => void;
  onSortChange: (value: LlmModelCatalogSortField) => void;
  onOrderChange: (value: LlmModelCatalogSortOrder) => void;
  onViewChange: (value: LlmModelCatalogViewMode) => void;
  onClear: () => void;
};

export default function LlmModelCatalogFilters(props: Props) {
  const {params, categories, tagGroups, isLoading} = props;
  const hasFilters = !!params.q || params.categories.length > 0 || params.tags.length > 0 || params.status !== 'active';
  return <Paper variant="outlined" sx={{borderRadius:1,p:2}}><Stack spacing={2}>
    <Stack direction={{xs:'column',md:'row'}} spacing={1.5} alignItems={{xs:'stretch',md:'center'}}>
      <TextField size="small" fullWidth label="Search LLM models" value={params.q} disabled={isLoading}
        onChange={event => props.onSearchChange(event.target.value)}
        InputProps={{startAdornment:<InputAdornment position="start"><SearchIcon fontSize="small"/></InputAdornment>}}/>
      <FormControl size="small" sx={{minWidth:{xs:'100%',md:140}}}><InputLabel>Status</InputLabel>
        <Select label="Status" value={params.status} disabled={isLoading}
          onChange={(event:SelectChangeEvent<LlmModelCatalogStatus>) => props.onStatusChange(event.target.value as LlmModelCatalogStatus)}>
          <MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem>
        </Select>
      </FormControl>
      <FormControl size="small" sx={{minWidth:{xs:'100%',md:170}}}><InputLabel>Sort</InputLabel>
        <Select label="Sort" value={params.sort} disabled={isLoading} startAdornment={<SortIcon fontSize="small" sx={{mr:1,color:'text.secondary'}}/>}
          onChange={(event:SelectChangeEvent<LlmModelCatalogSortField>) => props.onSortChange(event.target.value as LlmModelCatalogSortField)}>
          <MenuItem value="physicalModelId">Model</MenuItem><MenuItem value="providerType">Provider</MenuItem>
          <MenuItem value="modelFamily">Family</MenuItem><MenuItem value="lifecycleStatus">Lifecycle</MenuItem>
          <MenuItem value="updateTs">Updated</MenuItem>
        </Select>
      </FormControl>
      <ToggleButtonGroup size="small" exclusive value={params.order} disabled={isLoading}
        onChange={(_,value:LlmModelCatalogSortOrder|null) => value && props.onOrderChange(value)} aria-label="Sort direction">
        <ToggleButton value="asc">Asc</ToggleButton><ToggleButton value="desc">Desc</ToggleButton>
      </ToggleButtonGroup>
      <ToggleButtonGroup size="small" exclusive value={params.view} disabled={isLoading}
        onChange={(_,value:LlmModelCatalogViewMode|null) => value && props.onViewChange(value)} aria-label="View mode">
        <ToggleButton value="grid" aria-label="Grid view"><ViewModuleIcon fontSize="small"/></ToggleButton>
        <ToggleButton value="list" aria-label="List view"><ViewListIcon fontSize="small"/></ToggleButton>
      </ToggleButtonGroup>
      <Button variant="outlined" startIcon={<ClearIcon/>} disabled={!hasFilters || isLoading} onClick={props.onClear} sx={{whiteSpace:'nowrap'}}>Clear</Button>
    </Stack>
    <Divider/>
    <Box><Typography variant="subtitle2" sx={{mb:1}}>Categories</Typography>
      <Stack direction="row" gap={0.75} flexWrap="wrap">
        {categories.length === 0 ? <Typography variant="body2" color="text.secondary">No categories available.</Typography> : categories.map(category => {
          const selected = params.categories.includes(category.value);
          return <Chip key={category.id} clickable color={selected?'primary':'default'} variant={selected?'filled':'outlined'}
            label={formatTaxonomyLabel(category.label)} onClick={() => props.onCategoryToggle(category.value)}/>;
        })}
      </Stack>
    </Box>
    <Box><Stack direction="row" spacing={1.5} alignItems="center" sx={{mb:1}}>
      <Typography variant="subtitle2">Tags</Typography>
      <ToggleButtonGroup size="small" exclusive value={params.tagMatch} disabled={isLoading || params.tags.length < 2}
        onChange={(_,value:LlmModelTagMatchMode|null) => value && props.onTagMatchChange(value)} aria-label="Tag match mode">
        <ToggleButton value="all">All</ToggleButton><ToggleButton value="any">Any</ToggleButton>
      </ToggleButtonGroup>
    </Stack><Stack spacing={1.5}>
      {tagGroups.length === 0 ? <Typography variant="body2" color="text.secondary">No tags available.</Typography> : tagGroups.map(group =>
        <Box key={group.code}><Typography variant="caption" color="text.secondary" sx={{display:'block',mb:0.75}}>{group.label}</Typography>
          <Stack direction="row" gap={0.75} flexWrap="wrap">{group.tags.map(tag => {
            const selected = params.tags.includes(tag.value);
            return <Chip key={tag.id} clickable size="small" color={selected?'primary':'default'} variant={selected?'filled':'outlined'}
              label={formatTaxonomyLabel(tag.label)} onClick={() => props.onTagToggle(tag.value)}/>;
          })}</Stack>
        </Box>)}
    </Stack></Box>
  </Stack></Paper>;
}
