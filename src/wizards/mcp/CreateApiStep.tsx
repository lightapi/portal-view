import { useState, useEffect } from 'react';
import { Box, Stack, TextField } from '@mui/material';
import AccountTreeOutlinedIcon from '@mui/icons-material/AccountTreeOutlined';
import CodeOutlinedIcon from '@mui/icons-material/CodeOutlined';
import PeopleOutlineIcon from '@mui/icons-material/PeopleOutline';
import DynaSelect from './DynaSelect';
import { fetchOptions } from './fetchOptions';
import { SectionCard, Row } from './SectionCard';
import type { CreateApiForm, Option } from './types';

interface Props {
  form: CreateApiForm;
  errors: Partial<Record<keyof CreateApiForm, string>>;
  patch: (p: Partial<CreateApiForm>) => void;
  host: string;
  mode?: 'server';
}

export default function CreateApiStep({ form, errors, patch, host, mode }: Props) {
  const isServer = mode === 'server';
  const [userOptions, setUserOptions] = useState<Option[]>([]);
  const [regionOptions, setRegionOptions] = useState<Option[]>([]);
  const [businessGroupOptions, setBusinessGroupOptions] = useState<Option[]>([]);
  const [lobOptions, setLobOptions] = useState<Option[]>([]);
  const [platformOptions, setPlatformOptions] = useState<Option[]>([]);
  const [capabilityOptions, setCapabilityOptions] = useState<Option[]>([]);
  const [statusOptions, setStatusOptions] = useState<Option[]>([]);
  const [tagOptions, setTagOptions] = useState<Option[]>([]);

  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingRegion, setLoadingRegion] = useState(false);
  const [loadingBGroup, setLoadingBGroup] = useState(false);
  const [loadingLob, setLoadingLob] = useState(false);
  const [loadingPlatform, setLoadingPlatform] = useState(false);
  const [loadingCapability, setLoadingCapability] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(false);
  const [loadingTags, setLoadingTags] = useState(false);

  // Users
  useEffect(() => {
    if (!host) return;
    setLoadingUsers(true);
    const cmd = { host: 'lightapi.net', service: 'user', action: 'getUserLabel', version: '0.1.0', data: { hostId: host } };
    fetchOptions('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)))
      .then(setUserOptions)
      .finally(() => setLoadingUsers(false));
  }, [host]);

  // Region, status, tags
  useEffect(() => {
    if (!host) return;
    setLoadingRegion(true);
    fetchOptions(`/r/data?name=region&host=${host}`).then(setRegionOptions).finally(() => setLoadingRegion(false));
    setLoadingStatus(true);
    fetchOptions(`/r/data?name=api_status&host=${host}`).then(setStatusOptions).finally(() => setLoadingStatus(false));
    setLoadingTags(true);
    fetchOptions(`/r/data?name=api_tag&host=${host}`).then(setTagOptions).finally(() => setLoadingTags(false));
  }, [host]);

  // businessGroup ← region
  useEffect(() => {
    if (!host || !form.region) { setBusinessGroupOptions([]); return; }
    setLoadingBGroup(true);
    fetchOptions(`/r/data?name=business_group&host=${host}&rela=region_bgrp&from=${form.region}`)
      .then(setBusinessGroupOptions).finally(() => setLoadingBGroup(false));
  }, [host, form.region]);

  // lob ← businessGroup
  useEffect(() => {
    if (!host || !form.businessGroup) { setLobOptions([]); return; }
    setLoadingLob(true);
    fetchOptions(`/r/data?name=lob&host=${host}&rela=bgrp_lob&from=${form.businessGroup}`)
      .then(setLobOptions).finally(() => setLoadingLob(false));
  }, [host, form.businessGroup]);

  // platform ← lob
  useEffect(() => {
    if (!host || !form.lob) { setPlatformOptions([]); return; }
    setLoadingPlatform(true);
    fetchOptions(`/r/data?name=platform_journer&host=${host}&rela=lob_platform&from=${form.lob}`)
      .then(setPlatformOptions).finally(() => setLoadingPlatform(false));
  }, [host, form.lob]);

  // capability ← platform
  useEffect(() => {
    if (!host || !form.platform) { setCapabilityOptions([]); return; }
    setLoadingCapability(true);
    fetchOptions(`/r/data?name=capability&host=${host}&rela=platform_capability&from=${form.platform}`)
      .then(setCapabilityOptions).finally(() => setLoadingCapability(false));
  }, [host, form.platform]);

  return (
    <Stack spacing={3}>
      {/* ── Identity ── */}
      <SectionCard title={isServer ? 'Server Identity' : 'API Identity'} icon={<CodeOutlinedIcon />}>
        <Stack spacing={2}>
          <Row>
            <TextField
              label={isServer ? 'Server ID' : 'API ID'}
              required
              fullWidth
              value={form.apiId}
              onChange={(e) => patch({ apiId: e.target.value })}
              error={!!errors.apiId}
              helperText={errors.apiId || (isServer ? 'Unique identifier for this MCP server' : 'Unique identifier for this API')}
            />
            <TextField
              label={isServer ? 'Server Name' : 'API Name'}
              required
              fullWidth
              value={form.apiName}
              onChange={(e) => patch({ apiName: e.target.value })}
              error={!!errors.apiName}
              helperText={errors.apiName}
            />
          </Row>
          <Row>
            <DynaSelect
              label="Status"
              required
              value={form.apiStatus}
              options={statusOptions}
              loading={loadingStatus}
              error={!!errors.apiStatus}
              helperText={errors.apiStatus}
              onChange={(v) => patch({ apiStatus: v as string })}
            />
            <DynaSelect
              label="Tags"
              value={form.apiTags}
              options={tagOptions}
              loading={loadingTags}
              multiple
              onChange={(v) => patch({ apiTags: v as string[] })}
            />
          </Row>
          <TextField
            label="Git Repository"
            fullWidth
            value={form.gitRepo}
            onChange={(e) => patch({ gitRepo: e.target.value })}
            placeholder="https://github.com/your-org/your-repo"
          />
          <TextField
            label="Description"
            fullWidth
            multiline
            minRows={3}
            value={form.apiDesc}
            onChange={(e) => patch({ apiDesc: e.target.value })}
          />
        </Stack>
      </SectionCard>

      {/* ── Ownership ── */}
      <SectionCard title="Ownership" icon={<PeopleOutlineIcon />}>
        <Row>
          <DynaSelect
            label="Operation Owner"
            value={form.operationOwner}
            options={userOptions}
            loading={loadingUsers}
            onChange={(v) => patch({ operationOwner: v as string })}
          />
          <DynaSelect
            label="Delivery Owner"
            value={form.deliveryOwner}
            options={userOptions}
            loading={loadingUsers}
            onChange={(v) => patch({ deliveryOwner: v as string })}
          />
        </Row>
      </SectionCard>

      {/* ── Classification ── */}
      <SectionCard title="Classification" icon={<AccountTreeOutlinedIcon />}>
        <Stack spacing={2}>
          <Row>
            <DynaSelect
              label="Region"
              value={form.region}
              options={regionOptions}
              loading={loadingRegion}
              onChange={(v) =>
                patch({ region: v as string, businessGroup: '', lob: '', platform: '', capability: '' })
              }
            />
            <DynaSelect
              label="Business Group"
              value={form.businessGroup}
              options={businessGroupOptions}
              loading={loadingBGroup}
              disabled={!form.region}
              helperText={!form.region ? 'Select a Region first' : undefined}
              onChange={(v) => patch({ businessGroup: v as string, lob: '', platform: '', capability: '' })}
            />
          </Row>
          <Row>
            <DynaSelect
              label="Line of Business"
              value={form.lob}
              options={lobOptions}
              loading={loadingLob}
              disabled={!form.businessGroup}
              helperText={!form.businessGroup ? 'Select a Business Group first' : undefined}
              onChange={(v) => patch({ lob: v as string, platform: '', capability: '' })}
            />
            <DynaSelect
              label="Platform"
              value={form.platform}
              options={platformOptions}
              loading={loadingPlatform}
              disabled={!form.lob}
              helperText={!form.lob ? 'Select a Line of Business first' : undefined}
              onChange={(v) => patch({ platform: v as string, capability: '' })}
            />
          </Row>
          <Box sx={{ maxWidth: { sm: 'calc(50% - 8px)' } }}>
            <DynaSelect
              label="Capability"
              value={form.capability}
              options={capabilityOptions}
              loading={loadingCapability}
              disabled={!form.platform}
              helperText={!form.platform ? 'Select a Platform first' : undefined}
              onChange={(v) => patch({ capability: v as string })}
            />
          </Box>
        </Stack>
      </SectionCard>
    </Stack>
  );
}
