import { useState, useEffect, useMemo } from 'react';
import {
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import LayersOutlinedIcon from '@mui/icons-material/LayersOutlined';
import DynaSelect from './DynaSelect';
import { fetchOptions } from './fetchOptions';
import { SectionCard, Row } from './SectionCard';
import TransportConfigPanel from './TransportConfigPanel';
import SpecSection from './SpecSection';
import type { CreateApiVersionForm, Option } from './types';

interface Props {
  committedApiId: string;
  form: CreateApiVersionForm;
  errors: Partial<Record<keyof CreateApiVersionForm, string>>;
  patch: (p: Partial<CreateApiVersionForm>) => void;
  host: string;
  mode?: 'server';
}

export default function CreateApiVersionStep({ committedApiId, form, errors, patch, host, mode }: Props) {
  const isServer = mode === 'server';
  const useStructuredTransport = isServer || form.apiType === 'mcp';
  const [apiTypeOptions, setApiTypeOptions] = useState<Option[]>([]);
  const [loadingApiType, setLoadingApiType] = useState(false);

  const parsedTransport = useMemo(() => {
    try { return JSON.parse(form.transportConfig) as Record<string, string>; } catch { return {}; }
  }, [form.transportConfig]);

  const patchTransport = (changes: Record<string, string>) => {
    try {
      const current = JSON.parse(form.transportConfig) as Record<string, string>;
      patch({ transportConfig: JSON.stringify({ ...current, ...changes }) });
    } catch {
      patch({ transportConfig: JSON.stringify(changes) });
    }
  };

  useEffect(() => {
    if (!host) return;
    setLoadingApiType(true);
    fetchOptions(`/r/data?name=api_type&host=${host}`)
      .then(setApiTypeOptions)
      .finally(() => setLoadingApiType(false));
  }, [host]);

  return (
    <Stack spacing={3}>
      <SectionCard title="Version Details" icon={<LayersOutlinedIcon />}>
        <Stack spacing={2}>
          <TextField
            label={isServer ? 'Server ID' : 'API ID'}
            value={committedApiId}
            fullWidth
            slotProps={{ input: { readOnly: true } }}
            helperText="Committed in the previous step — cannot be changed"
            sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
          />
          <Row>
            <TextField
              label={isServer ? 'Version' : 'API Version'}
              required fullWidth
              value={form.apiVersion}
              onChange={(e) => patch({ apiVersion: e.target.value })}
              error={!!errors.apiVersion}
              helperText={errors.apiVersion || 'e.g. 1.0.0'}
              placeholder="1.0.0"
            />
            {isServer ? (
              <TextField
                label="API Type" value="mcp" fullWidth
                slotProps={{ input: { readOnly: true } }}
                helperText="Fixed for standalone MCP servers"
                sx={{ '& .MuiInputBase-input': { color: 'text.secondary' } }}
              />
            ) : (
              <DynaSelect
                label="API Type" required
                value={form.apiType} options={apiTypeOptions} loading={loadingApiType}
                error={!!errors.apiType} helperText={errors.apiType}
                onChange={(v) => patch({ apiType: v as string })}
              />
            )}
          </Row>
          <TextField
            label="Service ID" required fullWidth
            value={form.serviceId}
            onChange={(e) => patch({ serviceId: e.target.value })}
            error={!!errors.serviceId}
            helperText={errors.serviceId || 'The backing service identifier'}
          />
          <TextField
            label="Description" fullWidth multiline minRows={2}
            value={form.apiVersionDesc}
            onChange={(e) => patch({ apiVersionDesc: e.target.value })}
          />
        </Stack>
      </SectionCard>

      <SectionCard title="Deployment" icon={<LayersOutlinedIcon />}>
        <Stack spacing={2}>
          <Row>
            <FormControl fullWidth>
              <InputLabel>Protocol</InputLabel>
              <Select label="Protocol" value={form.protocol} onChange={(e) => patch({ protocol: e.target.value })}>
                <MenuItem value="https">HTTPS</MenuItem>
                <MenuItem value="http">HTTP</MenuItem>
              </Select>
            </FormControl>
            <TextField
              label="Environment Tag" fullWidth
              value={form.envTag} onChange={(e) => patch({ envTag: e.target.value })}
              placeholder="dev / tst / prd"
            />
          </Row>
          <TextField
            label="Target Host" fullWidth
            value={form.targetHost} onChange={(e) => patch({ targetHost: e.target.value })}
            placeholder="https://api.example.com"
          />
          <TextField
            label="Spec Link" fullWidth
            value={form.specLink} onChange={(e) => patch({ specLink: e.target.value })}
            placeholder="https://example.com/openapi.yaml"
          />
        </Stack>
      </SectionCard>

      {form.apiType === 'mcp' && (
        <TransportConfigPanel
          form={form} errors={errors}
          useStructuredTransport={useStructuredTransport}
          parsedTransport={parsedTransport} patchTransport={patchTransport}
          patch={patch}
        />
      )}

      {!isServer && <SpecSection form={form} patch={patch} />}
    </Stack>
  );
}
