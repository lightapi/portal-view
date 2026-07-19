import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
  DialogTitle, IconButton, Paper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import { commandLlm, listLlm, queryLlm } from './api';
import type { LlmRecord, ResourceDefinition } from './types';
import { display, validateMutation } from './validation';

type Props = { hostId: string; resource: ResourceDefinition };

export default function ResourcePanel({hostId, resource}: Props) {
  const [rows, setRows] = useState<LlmRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState<LlmRecord | null>(null);
  const [create, setCreate] = useState(false);
  const [json, setJson] = useState('');
  const [preview, setPreview] = useState<unknown>(null);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try { setRows(await listLlm(resource.listAction, hostId)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
    finally { setLoading(false); }
  }, [hostId, resource.listAction]);
  useEffect(() => { void load(); }, [load]);

  const open = (row?: LlmRecord) => {
    const value = row ?? {hostId, active: true};
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
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const remove = async (row: LlmRecord) => {
    if (!window.confirm(`Delete ${resource.label} record ${display(row[resource.idField])}?`)) return;
    try {
      await commandLlm(resource.deleteAction, {hostId, [resource.idField]: row[resource.idField], aggregateVersion: row.aggregateVersion});
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const deploymentAction = async (row: LlmRecord, action: string) => {
    try {
      await commandLlm(action, {hostId, providerDeploymentId: row.providerDeploymentId, aggregateVersion: row.aggregateVersion});
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };
  const previewRoutes = async (row: LlmRecord) => {
    try { setPreview(await queryLlm('previewLlmAliasRoutes', {hostId, publicAliasId: row.publicAliasId,
      environment: row.environment, dataClassification: row.dataClassification})); }
    catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); }
  };

  return <Box>
    <Box sx={{display:'flex',justifyContent:'space-between',alignItems:'center',mb:2}}>
      <Typography variant="h6">{resource.label}</Typography>
      <Button startIcon={<AddIcon/>} variant="contained" onClick={() => open()}>Create draft</Button>
    </Box>
    {error && <Alert severity="error" sx={{mb:2}} onClose={() => setError('')}>{error}</Alert>}
    {loading ? <CircularProgress/> : <TableContainer component={Paper} variant="outlined">
      <Table size="small"><TableHead><TableRow>
        <TableCell>Actions</TableCell><TableCell>{resource.idField}</TableCell>
        {resource.columns.map(column => <TableCell key={column}>{column}</TableCell>)}
        <TableCell>Version</TableCell>
      </TableRow></TableHead><TableBody>
        {rows.map((row, index) => <TableRow key={String(row[resource.idField] ?? index)}>
          <TableCell sx={{whiteSpace:'nowrap'}}>
            <Tooltip title="Edit"><IconButton size="small" onClick={() => open(row)}><EditIcon/></IconButton></Tooltip>
            <Tooltip title="Delete"><IconButton size="small" color="error" onClick={() => void remove(row)}><DeleteIcon/></IconButton></Tooltip>
            {resource.key === 'deployments' && <>
              <Tooltip title="Validate"><IconButton size="small" onClick={() => void deploymentAction(row,'validateLlmProviderDeployment')}><PlayArrowIcon/></IconButton></Tooltip>
              <Button size="small" onClick={() => void deploymentAction(row,'runLlmProviderConformance')}>Conformance</Button>
            </>}
            {resource.key === 'aliases' && <Button size="small" onClick={() => void previewRoutes(row)}>Preview routes</Button>}
          </TableCell>
          <TableCell>{display(row[resource.idField])}</TableCell>
          {resource.columns.map(column => <TableCell key={column} sx={{maxWidth:260,overflow:'hidden',textOverflow:'ellipsis'}}>{display(row[column])}</TableCell>)}
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
