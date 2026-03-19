import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import FormControl from '@mui/material/FormControl';
import Input from '@mui/material/Input';
import MenuItem from '@mui/material/MenuItem';
import Select from '@mui/material/Select';
import TextField from '@mui/material/TextField';
import Box from '@mui/material/Box';
import React, { useState } from 'react';
import { useApiGet } from '../../hooks/useApiGet';
import { useApiPost } from '../../hooks/useApiPost';

const ITEM_HEIGHT = 48;
const ITEM_PADDING_TOP = 8;
const MenuProps = {
  PaperProps: {
    style: {
      maxHeight: ITEM_HEIGHT * 4.5 + ITEM_PADDING_TOP,
      width: 250,
    },
  },
};

const allRoles = ['user', 'lightapi.net', 'merchant', 'admin'];

function EmailInput({ step, inputRoles }: any) {
  const [email, setEmail] = useState('');
  if (step !== 1) return null;

  return (
    <Box sx={{ p: 2 }}>
      <FormControl fullWidth sx={{ maxWidth: 400 }}>
        <TextField id="email-input" label="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
          onClick={() => inputRoles(email)}
        >
          Retrieve Roles
        </Button>
      </FormControl>
    </Box>
  );
}

function RolesInput({ step, email, updateRoles }: any) {
  const [roles, setRoles] = useState<string[]>([]);

  const cmd = {
    host: 'lightapi.net',
    service: 'user',
    action: 'getRolesByEmail',
    version: '0.1.0',
    data: { email },
  };
  const url = '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
  const headers = {};
  const callback = (data: any) => {
    setRoles(data.roles.split(' '));
  };

  const { isLoading, error }: any = useApiGet({ url, headers, callback });

  if (step !== 2) return null;

  const handleChange = (event: any) => {
    setRoles(event.target.value);
  };

  if (isLoading) return <Box sx={{ p: 2 }}><CircularProgress /></Box>;
  if (error) return <Box sx={{ p: 2 }}><pre>{JSON.stringify(error, null, 2)}</pre></Box>;

  return (
    <Box sx={{ p: 2 }}>
      <FormControl fullWidth sx={{ maxWidth: 400 }}>
        <TextField
          disabled
          id="email-display"
          label="Email"
          defaultValue={email}
          sx={{ mb: 2 }}
        />
        <Select
          labelId="roles-select-label"
          id="roles-select"
          multiple
          value={roles}
          onChange={handleChange}
          input={<Input />}
          MenuProps={MenuProps}
        >
          {allRoles.map((role) => (
            <MenuItem key={role} value={role}>
              {role}
            </MenuItem>
          ))}
        </Select>
        <Button
          variant="contained"
          color="primary"
          sx={{ mt: 2 }}
          onClick={() => updateRoles(roles)}
        >
          Update Roles
        </Button>
      </FormControl>
    </Box>
  );
}

function RolesUpdate({ step, email, roles }: any) {
  const body = {
    host: 'lightapi.net',
    service: 'user',
    action: 'updateRoles',
    version: '0.1.0',
    data: { email, roles: roles.join(' ') },
  };
  const url = '/portal/command';
  const headers = {};
  const { isLoading, data, error }: any = useApiPost({ url, headers, body });

  if (step !== 3) return null;

  if (isLoading) return <Box sx={{ p: 2 }}><CircularProgress /></Box>;

  return (
    <Box sx={{ p: 2 }}>
      <pre>{data ? JSON.stringify(data, null, 2) : (error ? JSON.stringify(error, null, 2) : 'Updating...')}</pre>
    </Box>
  );
}

export default function UpdateRoles() {
  const [step, setStep] = useState(1);
  const [email, setEmail] = useState('');
  const [roles, setRoles] = useState<string[]>([]);

  const inputRoles = (email: string) => {
    setEmail(email);
    setStep(2);
  };

  const updateRoles = (roles: string[]) => {
    setRoles(roles);
    setStep(3);
  };

  return (
    <Box>
      <EmailInput step={step} inputRoles={inputRoles} />
      {email && step >= 2 && (
        <RolesInput
          step={step}
          email={email}
          updateRoles={updateRoles}
        />
      )}
      {step === 3 && (
        <RolesUpdate
          step={step}
          email={email}
          roles={roles}
        />
      )}
    </Box>
  );
}
