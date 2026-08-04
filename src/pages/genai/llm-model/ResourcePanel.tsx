import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { commandLlm, listLlm, queryLlm } from './api';
import { llmErrorMessage } from './error';
import fetchClient from '../../../utils/fetchClient';
import type { LlmRecord, ResourceDefinition } from './types';
import { display, sanitizeForDisplay, validateMutation } from './validation';

type Props = { hostId: string; resource: ResourceDefinition; canMutate?: boolean };
const GLOBAL_TAXONOMY_HOST = '00000000-0000-0000-0000-000000000000';

const taxonomyQueryUrl = (service: 'category' | 'tag', action: string, hostId: string, entityType: string) =>
  '/portal/query?cmd=' + encodeURIComponent(JSON.stringify({
    host: 'lightapi.net', service, action, version: '0.1.0', data: {hostId, entityType},
  }));

async function taxonomyLabels(service: 'category' | 'tag', hostId: string, entityType: string) {
  const action = service === 'category' ? 'getCategoryLabelByType' : 'getTagLabelByType';
  const value = await fetchClient(taxonomyQueryUrl(service, action, hostId, entityType));
  if (!Array.isArray(value)) return new Map<string, string>();
  return new Map(value.flatMap(item => {
    const option = item as Record<string, unknown>;
    return typeof option.id === 'string' && typeof option.label === 'string'
      ? [[option.id, option.label] as const]
      : [];
  }));
}

function resolvedLabels(value: unknown, labels: Map<string, string>) {
  if (!Array.isArray(value)) return [];
  return value.map(id => labels.get(String(id)) ?? String(id));
}

function columnValue(row: LlmRecord, column: string) {
  const value = row[column];
  if ((column === 'categories' || column === 'tags') && Array.isArray(value)) {
    return value.length ? value.map(display).join(', ') : '—';
  }
  return display(value);
}

export default function ResourcePanel({hostId, resource, canMutate = true}: Props) {
  const navigate = useNavigate();
  const queryHost = resource.scope === 'host' ? hostId : undefined;
  const taxonomyHost = resource.scope === 'global' ? GLOBAL_TAXONOMY_HOST : hostId;
  const [rows, setRows] = useState<LlmRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [editing, setEditing] = useState<LlmRecord | null>(null);
  const [create, setCreate] = useState(false);
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const records = await listLlm(resource.listAction, queryHost);
      if (!resource.taxonomyEntityType) {
        setRows(records);
      } else {
        const [categoryLabels, tagLabels] = await Promise.all([
          taxonomyLabels('category', taxonomyHost, resource.taxonomyEntityType).catch(() => new Map<string, string>()),
          taxonomyLabels('tag', taxonomyHost, resource.taxonomyEntityType).catch(() => new Map<string, string>()),
        ]);
        setRows(records.map(row => ({
          ...row,
          categories: resolvedLabels(row.categoryIds, categoryLabels),
          tags: resolvedLabels(row.tagIds, tagLabels),
        })));
      }
    }
    catch (reason) { setError(llmErrorMessage(reason)); }
    finally { setLoading(false); }
  }, [queryHost, resource.listAction, resource.taxonomyEntityType, taxonomyHost]);
  useEffect(() => { void load(); }, [load]);

  const open = (row?: LlmRecord) => {
    const sanitized = (row
      ? sanitizeForDisplay(row)
      : resource.scope === 'host'
        ? {hostId}
        : resource.key === 'models'
          ? {globalFlag: true}
          : {}) as LlmRecord;
    const value = Object.fromEntries(
      Object.entries(sanitized).filter(([field]) => field !== 'active'),
    ) as LlmRecord;
    const formId = row ? resource.updateForm : resource.createForm;
    if (formId) {
      const data = resource.formFields
        ? Object.fromEntries(Object.entries(value).filter(([field]) => resource.formFields!.includes(field)))
        : value;
      navigate(`/app/form/${formId}`, {state: {data}});
      return;
    }
    setEditing(value); setCreate(!row); setJson(JSON.stringify(value, null, 2));
  };
  const close = () => setEditing(null);
  const save = async () => {
    try {
      const value = JSON.parse(json) as LlmRecord;
      const errors = validateMutation(resource, value);
      if (errors.length) { setError(errors.join(' ')); return; }
      await commandLlm(create ? resource.createAction : resource.updateAction, value);
      close(); await load();
    } catch (reason) { setError(llmErrorMessage(reason)); }
  };
  const remove = async (row: LlmRecord) => {
    if (!window.confirm(`Delete ${resource.label} record ${display(row[resource.idField])}?`)) return;
    try {
      await commandLlm(resource.deleteAction, {...(resource.scope === 'host' ? {hostId} : {}), [resource.idField]: row[resource.idField], aggregateVersion: row.aggregateVersion});
      await load();
    } catch (reason) { setError(llmErrorMessage(reason)); }
  };
  const deploymentAction = async (row: LlmRecord, action: string) => {
    try {
      setError(''); setNotice('');
      await commandLlm(action, {hostId, providerDeploymentId: row.providerDeploymentId, aggregateVersion: row.aggregateVersion});
      if (action === 'runLlmProviderConformance') {
        setRows(current => current.map(item => item.providerDeploymentId === row.providerDeploymentId
          ? {...item, conformanceState:'PENDING', aggregateVersion:Number(item.aggregateVersion) + 1}
          : item));
        setNotice('Conformance was queued. A trusted runner must test the deployment and record PASS, FAIL, or QUARANTINED evidence.');
        return;
      }
      await load();
    } catch (reason) { setError(llmErrorMessage(reason)); }
  };
  const previewRoutes = async (row: LlmRecord) => {
    try { setPreview(await queryLlm('previewLlmAliasRoutes', {hostId, publicAliasId: row.publicAliasId,
      environment: row.environment, dataClassification: row.dataClassification})); }
    catch (reason) { setError(llmErrorMessage(reason)); }
  };

  if (resource.scope === 'host' && !hostId) return <Alert severity="info">Select a host to administer {resource.label}.</Alert>;
  return <Box>
    <Box sx={{display:'flex',justifyContent:'space-between',alignItems:'center',mb:2}}>
      <Box><Typography variant="h6">{resource.label}</Typography>
        {resource.scope === 'global' && <Typography variant="caption" color="text.secondary">Global catalog shared by every host</Typography>}
      </Box>
      {canMutate && <Button startIcon={<AddIcon/>} variant="contained" onClick={() => open()}>{resource.createLabel ?? 'Create draft'}</Button>}
    </Box>
    {error && <Alert severity="error" sx={{mb:2}} onClose={() => setError('')}>{error}</Alert>}
    {notice && <Alert severity="success" sx={{mb:2}} onClose={() => setNotice('')}>{notice}</Alert>}
    {loading ? <CircularProgress/> : <TableContainer component={Paper} variant="outlined">
      <Table size="small"><TableHead><TableRow>
        <TableCell>Actions</TableCell><TableCell>{resource.idField}</TableCell>
        {resource.columns.map(column => <TableCell key={column}>{resource.columnLabels?.[column] ?? column}</TableCell>)}
        <TableCell>Version</TableCell>
      </TableRow></TableHead><TableBody>
        {rows.map((row, index) => <TableRow key={String(row[resource.idField] ?? index)}>
          <TableCell sx={{whiteSpace:'nowrap'}}>
            {canMutate && <><Tooltip title="Edit"><IconButton size="small" onClick={() => open(row)}><EditIcon/></IconButton></Tooltip>
            <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => void remove(row)}><DeleteIcon/></IconButton></Tooltip></>}
            {resource.key === 'deployments' && <>
              <Tooltip title="Validate"><IconButton size="small" onClick={() => void deploymentAction(row,'validateLlmProviderDeployment')}><PlayArrowIcon/></IconButton></Tooltip>
              <Button size="small" disabled={row.conformanceState === 'PENDING'}
                onClick={() => void deploymentAction(row,'runLlmProviderConformance')}>
                {row.conformanceState === 'PENDING' ? 'Conformance pending' : 'Conformance'}
              </Button>
            </>}
            {resource.key === 'aliases' && <Button size="small" onClick={() => void previewRoutes(row)}>Preview routes</Button>}
          </TableCell>
          <TableCell>{display(row[resource.idField])}</TableCell>
          {resource.columns.map(column => <TableCell key={column} sx={{maxWidth:260,overflow:'hidden',textOverflow:'ellipsis'}}>{columnValue(row,column)}</TableCell>)}
          <TableCell>{display(row.aggregateVersion)}</TableCell>
        </TableRow>)}
        {!rows.length && <TableRow><TableCell colSpan={resource.columns.length + 3}>No active records.</TableCell></TableRow>}
      </TableBody></Table>
    </TableContainer>}
    <Dialog open={editing !== null} onClose={close} fullWidth maxWidth="md">
      <DialogTitle>{create ? 'Create' : 'Update'} {resource.label}</DialogTitle>
      <DialogContent><Alert severity="info" sx={{my:1}}>This draft editor sends the versioned Portal command contract. Credential values are never accepted; use secretReference.</Alert>
        <TextField multiline minRows={18} fullWidth value={json} onChange={event => setJson(event.target.value)} inputProps={{spellCheck:false}}/>
      </DialogContent><DialogActions><Button onClick={close}>Cancel</Button><Button variant="contained" onClick={() => void save()}>Save</Button></DialogActions>
    </Dialog>
    <Dialog open={preview !== null} onClose={() => setPreview(null)} fullWidth maxWidth="md">
      <DialogTitle>Route eligibility preview</DialogTitle><DialogContent>
        <Alert severity="info" sx={{mb:1}}>This preview exposes eligibility reasons only; credential references and provider errors are excluded.</Alert>
        <pre>{JSON.stringify(preview,null,2)}</pre>
      </DialogContent><DialogActions><Button onClick={() => setPreview(null)}>Close</Button></DialogActions>
    </Dialog>
  </Box>;
}
