import React from 'react';
import FormGroup from '@mui/material/FormGroup';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import type { SelectChangeEvent } from '@mui/material/Select';

type ChaosFormSettingsProps = {
  label: string;
  value: string;
  options: string[];
  optionDisplays: string[];
  onChange: (value: string) => void;
};

export default function ChaosFormSettings(props: ChaosFormSettingsProps) {
  const label = props.label;
  const value = props.value;
  const options = props.options;
  const optionDisplays = props.optionDisplays;

  const elementOptions: React.ReactNode[] = [];

  for (let i = 0; i < options.length; i++) {
    elementOptions.push(
      <MenuItem key={i} value={options[i]}>{optionDisplays[i]}</MenuItem>
    );
  }

  const handleChange = (val: SelectChangeEvent<string>) => {
    props.onChange(val.target.value);
  };

  return (
    <FormGroup>
      <InputLabel>{label}</InputLabel>
      <Select
        variant="outlined"
        fullWidth
        margin="none"
        value={value}
        label={label}
        onChange={handleChange}
      >
        <MenuItem value="">
          <em>None</em>
        </MenuItem>
        {elementOptions}
      </Select>
    </FormGroup>
  );
}
