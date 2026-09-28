import {useCallback, useEffect, useState} from 'react';
import {useNavigate, useParams} from 'react-router-dom';
import {Alert, Box, Button, CircularProgress, Stack, Typography} from '@mui/material';
import RateReviewIcon from '@mui/icons-material/RateReview';
import {PortalActions, PortalActionScope} from '../../components/PortalActions/PortalActions';
import {useUserState} from '../../contexts/UserContext';
import {workflowAdminClient} from './workflowAdminClient';

export type BindingSummary = {bindingId: string; toolId: string; toolName: string; wfDefId: string;
  workflowVersion: string; revisionStatus: string; requestedBy: string; requestedTs: string};

export default function WfToolBindings() {
  const {wfDefId} = useParams();
  const {host} = useUserState();
  const navigate = useNavigate();
  const [items, setItems] = useState<BindingSummary[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const load = useCallback(async (next?: string) => {
    if (!host || !wfDefId) return;
    setLoading(true); setError('');
    try {
      const value = await workflowAdminClient.listBindings({hostId: host, role: 'owner', wfDefId,
        limit: 100, ...(next ? {cursor: next} : {})});
      setItems(previous => next ? [...previous, ...(value.items ?? [])] : (value.items ?? []));
      setCursor(value.nextCursor);
    } catch (reason: any) { setError(reason?.message ?? 'Could not load Tool bindings.'); }
    finally { setLoading(false); }
  }, [host, wfDefId]);
  useEffect(() => { void load(); }, [load]);
  return <Box sx={{p: 3}}><Stack spacing={2}>
    <Typography variant="h5">Tool Bindings</Typography>
    {error && <Alert severity="error">{error}</Alert>}
    {!loading && !error && !items.length && <Typography>No requested Tool binding revisions for this definition. Legacy Tool bindings are not shown here.</Typography>}
    <PortalActionScope>{items.map(item => <Box key={item.bindingId} sx={{border: 1, borderColor: 'divider', borderRadius: 1, p: 2}}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
        <Box><Typography>{item.toolName} · {item.workflowVersion}</Typography>
          <Typography variant="body2">{item.revisionStatus} · requested by {item.requestedBy}</Typography>
          <Typography variant="caption">{item.requestedTs}</Typography></Box>
        <PortalActions row={item} actions={[{id: 'review-revision', label: 'Review revision',
          icon: <RateReviewIcon />, onSelect: selected => navigate(`/app/workflow/tool-bindings/review/${encodeURIComponent(selected.bindingId)}`)}]} />
      </Stack>
    </Box>)}</PortalActionScope>
    {loading && <CircularProgress aria-label="Loading Tool bindings" />}
    {cursor && <Button disabled={loading} onClick={() => void load(cursor)}>Load more</Button>}
    <Button onClick={() => void load()}>Refresh list</Button>
  </Stack></Box>;
}
