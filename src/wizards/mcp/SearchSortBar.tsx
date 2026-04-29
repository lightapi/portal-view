import {
  Box,
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import ClearIcon from '@mui/icons-material/Clear';
import SearchIcon from '@mui/icons-material/Search';
import type { SxProps, Theme } from '@mui/material/styles';

export interface SortOption<T extends string = string> {
  value: T;
  label: string;
}

export interface SearchSortBarProps<TSort extends string = string> {
  filter: string;
  onFilterChange: (v: string) => void;
  placeholder?: string;
  sortBy?: TSort;
  onSortByChange?: (v: TSort) => void;
  sortOptions?: SortOption<TSort>[];
  sortAsc?: boolean;
  onSortAscChange?: (asc: boolean) => void;
  resultCount?: number;
  totalCount?: number;
  /** Rendered between the search field and sort controls */
  filterSlot?: React.ReactNode;
  sx?: SxProps<Theme>;
}

export function SearchSortBar<TSort extends string = string>({
  filter,
  onFilterChange,
  placeholder = 'Search…',
  sortBy,
  onSortByChange,
  sortOptions,
  sortAsc = true,
  onSortAscChange,
  resultCount,
  totalCount,
  filterSlot,
  sx,
}: SearchSortBarProps<TSort>) {
  const showSort = sortOptions && sortOptions.length > 0 && onSortByChange && sortBy !== undefined;
  const showCount = resultCount !== undefined && totalCount !== undefined && filter.trim() !== '';

  return (
    <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap', alignItems: 'center', ...sx }}>
      <TextField
        size="small"
        placeholder={placeholder}
        value={filter}
        onChange={(e) => onFilterChange(e.target.value)}
        sx={{ flex: '1 1 220px', minWidth: 160 }}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon fontSize="small" />
            </InputAdornment>
          ),
          endAdornment: filter ? (
            <InputAdornment position="end">
              <IconButton size="small" onClick={() => onFilterChange('')}>
                <ClearIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ) : null,
        }}
      />

      {filterSlot}

      {showSort && (
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
          <Typography variant="caption" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            Sort by
          </Typography>
          <Select
            size="small"
            value={sortBy}
            onChange={(e) => onSortByChange!(e.target.value as TSort)}
            sx={{ minWidth: 130, fontSize: '0.825rem' }}
          >
            {sortOptions!.map((o) => (
              <MenuItem key={o.value} value={o.value} sx={{ fontSize: '0.825rem' }}>
                {o.label}
              </MenuItem>
            ))}
          </Select>
          {onSortAscChange && (
            <Tooltip title={sortAsc ? 'Ascending' : 'Descending'}>
              <IconButton size="small" onClick={() => onSortAscChange(!sortAsc)}>
                {sortAsc ? <ArrowUpwardIcon fontSize="small" /> : <ArrowDownwardIcon fontSize="small" />}
              </IconButton>
            </Tooltip>
          )}
        </Box>
      )}

      {showCount && (
        <Typography variant="caption" color="text.secondary">
          {resultCount} of {totalCount} shown
        </Typography>
      )}
    </Box>
  );
}
