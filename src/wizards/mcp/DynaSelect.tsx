import {
  Autocomplete,
  Chip,
  CircularProgress,
  FormControl,
  FormHelperText,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';
import type { Option } from './types';

interface DynaSelectProps {
  label: string;
  required?: boolean;
  value: string | string[];
  options: Option[];
  loading?: boolean;
  disabled?: boolean;
  error?: boolean;
  helperText?: string;
  onChange: (v: string | string[]) => void;
  multiple?: boolean;
}

export default function DynaSelect({
  label,
  required,
  value,
  options,
  loading,
  disabled,
  error,
  helperText,
  onChange,
  multiple,
}: DynaSelectProps) {
  const singleValue = options.some((o) => o.value === (value as string)) ? (value as string) : '';

  if (multiple) {
    return (
      <Autocomplete
        multiple
        options={options}
        getOptionLabel={(o) => o.label}
        value={options.filter((o) => (value as string[]).includes(o.value))}
        onChange={(_, v) => onChange((v as Option[]).map((o) => o.value))}
        disabled={disabled || loading}
        loading={loading}
        renderTags={(val, getTagProps) =>
          val.map((o, i) => {
            const tagProps = getTagProps({ index: i });
            const { key, ...chipProps } = tagProps;
            return <Chip key={key} label={o.label} size="small" {...chipProps} />;
          })
        }
        renderInput={(params) => (
          <TextField
            {...params}
            label={label}
            required={required}
            error={error}
            helperText={helperText}
            InputProps={{
              ...params.InputProps,
              endAdornment: (
                <>
                  {loading && <CircularProgress size={16} />}
                  {params.InputProps.endAdornment}
                </>
              ),
            }}
          />
        )}
      />
    );
  }

  return (
    <FormControl fullWidth required={required} error={error} disabled={disabled || loading}>
      <InputLabel>{label}</InputLabel>
      <Select
        label={label}
        value={singleValue}
        onChange={(e) => onChange(e.target.value)}
        endAdornment={loading ? <CircularProgress size={16} sx={{ mr: 3 }} /> : undefined}
      >
        <MenuItem value=""><em>— none —</em></MenuItem>
        {options.map((o) => (
          <MenuItem key={o.value} value={o.value}>{o.label}</MenuItem>
        ))}
      </Select>
      {helperText && <FormHelperText>{helperText}</FormHelperText>}
    </FormControl>
  );
}
