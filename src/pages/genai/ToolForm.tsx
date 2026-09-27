import {useEffect, useState} from 'react';
import {useParams} from 'react-router-dom';
import {Alert, Box, MenuItem, Stack, TextField, Typography} from '@mui/material';
import Form from '../../components/Form/Form';
import {useUserState} from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';

type Model = {hostId?: string; executionPlacement?: string; workflowVersionRef?: string;
  readOnly?: boolean; workflowBinding?: Record<string, any>};

export const admissionDefaults = {
  maximumConcurrentRuns: 20, maximumConcurrentRunsPerUser: 2,
  startsPerMinute: 120, startsPerMinutePerUser: 10,
};

export function WorkflowToolFields({model, change}: {model: Model; change: (key: string, value: any) => void}) {
  const {userId, positions} = useUserState();
  const [owner, setOwner] = useState<{ownerUserId?: string; ownerPositionId?: string} | null>(null);
  const [ownerError, setOwnerError] = useState('');
  const [roleInput, setRoleInput] = useState('');
  const wfDefId = model.workflowVersionRef?.split('|')[0];
  const binding = model.workflowBinding ?? {};
  useEffect(() => { setRoleInput((binding.callerPolicy?.anyRole ?? []).join(', ')); }, [binding.callerPolicy?.anyRole]);
  useEffect(() => {
    if (model.executionPlacement === 'workflow' && !model.readOnly &&
      binding.idempotencyPolicy?.resultReplayMs == null) {
      change('workflowBinding.idempotencyPolicy.resultReplayMs', 600000);
    }
  }, [binding.idempotencyPolicy?.resultReplayMs, change, model.executionPlacement, model.readOnly]);
  useEffect(() => {
    if (model.executionPlacement !== 'workflow' || !wfDefId || !model.hostId) { setOwner(null); return; }
    let active = true;
    setOwnerError('');
    void fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify({
      host: 'lightapi.net', service: 'workflow', action: 'getWfDefinitionById', version: '0.1.0',
      data: {hostId: model.hostId, wfDefId},
    }))).then(value => { if (active) setOwner(value); })
      .catch(error => { if (active) setOwnerError(String(error?.message ?? error)); });
    return () => { active = false; };
  }, [model.executionPlacement, model.hostId, wfDefId]);
  if (model.executionPlacement !== 'workflow') return null;
  const positionIds = new Set((positions ?? '').split(/[\s,]+/).filter(Boolean));
  const isOwner = owner && (owner.ownerUserId === userId ||
    Boolean(owner.ownerPositionId && positionIds.has(owner.ownerPositionId)));
  const admission = {...admissionDefaults, ...(binding.admissionLimits ?? {})};
  const replayMs = binding.idempotencyPolicy?.resultReplayMs ?? (model.readOnly ? 0 : 600000);
  return <Box sx={{mt: 2, p: 2, border: 1, borderColor: 'divider', borderRadius: 1}}>
    <Stack spacing={2}>
      <Typography variant="h6">Workflow binding policy</Typography>
      {ownerError && <Alert severity="error">Could not load Workflow owner: {ownerError}</Alert>}
      {wfDefId && owner && <Typography>Definition owner: {owner.ownerUserId || 'No user owner'}
        {owner.ownerPositionId ? ` · position ${owner.ownerPositionId}` : ''}</Typography>}
      {wfDefId && owner && !isOwner && <Alert severity="info">Publication requires approval from the Workflow definition owner.</Alert>}
      <Alert severity="info">Workflow-backed Tools run synchronously. Use Start Workflow for long-running runs.</Alert>
      <TextField select label="Cancellation policy" value={binding.cancellationPolicy ?? 'before-effects-only'}
        onChange={event => change('workflowBinding.cancellationPolicy', event.target.value)}>
        <MenuItem value="before-effects-only">Before effects only</MenuItem>
        <MenuItem value="cooperative">Cooperative</MenuItem>
        <MenuItem value="disabled">Disabled</MenuItem>
      </TextField>
      {(Object.keys(admissionDefaults) as Array<keyof typeof admissionDefaults>).map(key =>
        <TextField key={key} type="number" label={key} value={admission[key]} inputProps={{min: 1, step: 1}}
          onChange={event => change(`workflowBinding.admissionLimits.${key}`, Number(event.target.value))} />)}
      <TextField label="Allowed caller roles" value={roleInput}
        helperText="Optional. Enter role names separated by commas."
        onChange={event => setRoleInput(event.target.value)}
        onBlur={() => {
          const roles = roleInput.split(',').map(value => value.trim()).filter(Boolean);
          change('workflowBinding.callerPolicy', roles.length ? {...binding.callerPolicy, anyRole: roles} : {});
        }} />
      <TextField type="number" label="Result replay window (ms)" value={replayMs}
        inputProps={{min: model.readOnly ? 0 : 600000, step: 1}}
        helperText={model.readOnly ? 'Stored result replay window.' : 'Write Tools require at least 600000 ms.'}
        onChange={event => change('workflowBinding.idempotencyPolicy.resultReplayMs', Number(event.target.value))} />
    </Stack>
  </Box>;
}

export default function ToolForm() {
  const {formId} = useParams();
  if (formId !== 'createTool' && formId !== 'updateTool') return <Form />;
  return <Form renderSupplement={(model, change) => <WorkflowToolFields model={model} change={change} />} />;
}
