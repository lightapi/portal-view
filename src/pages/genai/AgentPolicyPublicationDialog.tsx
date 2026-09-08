import { useEffect, useState } from 'react';
import { Alert, Box, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, Stack, Typography } from '@mui/material';
import fetchClient from '../../utils/fetchClient';
import { apiPost } from '../../api/apiPost';
import { loadErrorMessage } from '../../utils/loadErrorMessage';

type Candidate = {
  hostId: string; instanceId: string; serviceId?: string; status: string; error?: string;
  candidateDigest?: string; publicationId?: string; policySnapshotId?: string;
  contentDigest?: string; policyDigest?: string;
  agentPolicy?: { execution?: { codingProfile?: unknown } };
  propertyWrites?: Array<{ propertyName: string; proposedValue?: unknown }>;
};

type Props = { hostId: string; instanceId: string; serviceId?: string; onClose: () => void };

export default function AgentPolicyPublicationDialog({ hostId, instanceId, serviceId, onClose }: Props) {
  const leaseProfile = 'PERSISTENT';
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState('');
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let active = true;
    setCandidate(null); setReviewed(false); setError(''); setResult(''); setBusy(true);
    const cmd = { host: 'lightapi.net', service: 'genai', action: 'getAgentPolicyPublicationCandidates', version: '0.1.0', data: { hostId, leaseProfile } };
    fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)))
      .then(body => {
        if (!active) return;
        const selected = (body.agentPolicyCandidates as Candidate[] | undefined)?.find(c => c.instanceId === instanceId && c.hostId === hostId);
        if (!selected) throw new Error('No active writable Agent publication source exists for this instance. Verify its Agent API association and model alias.');
        if (serviceId && selected.serviceId && selected.serviceId !== serviceId) throw new Error('Candidate service identity does not match this instance.');
        setCandidate(selected);
      }).catch(reason => { if (active) setError(loadErrorMessage(reason)); })
      .finally(() => { if (active) setBusy(false); });
    return () => { active = false; };
  }, [hostId, instanceId, serviceId, leaseProfile, refresh]);

  const publish = async () => {
    if (busy || !reviewed || candidate?.status !== 'READY_TO_PUBLISH' || !candidate.candidateDigest) return;
    setBusy(true); setError('');
    try {
      const response = await apiPost({ url: '/portal/command', headers: {}, body: {
        host: 'lightapi.net', service: 'genai', action: 'publishAgentPolicy', version: '0.1.0',
        data: { hostId, instanceId, leaseProfile, candidateDigest: candidate.candidateDigest },
      }});
      if (response.error) throw response.error;
      if (response.aborted) throw new Error('Publication was interrupted. Preview again to check its status.');
      if (response.data?.status !== 'ACTIVE') throw new Error('Publication did not return ACTIVE. Preview again before retrying.');
      setResult(`Active publication ${response.data.publicationId}; snapshot ${response.data.policySnapshotId}. Restart or reload the Agent to accept this configuration.`);
      setCandidate(null); setReviewed(false);
    } catch (reason) {
      setError(loadErrorMessage(reason));
      // A rejected/uncertain command must never reuse an old preview digest.
      setCandidate(null); setReviewed(false);
    } finally { setBusy(false); }
  };
  return <Dialog open maxWidth="md" fullWidth onClose={busy ? undefined : onClose}>
    <DialogTitle>Publish Agent policy</DialogTitle>
    <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
      <Typography>{serviceId || instanceId}</Typography>
      <Alert severity="info">Published policy remains valid until replaced or revoked. No periodic renewal is required.</Alert>
      {busy && <Typography role="status">Working…</Typography>}
      {error && <Alert severity="error">{error}</Alert>}
      {result && <Alert severity="success">{result}</Alert>}
      {candidate && <>
        <Alert severity={candidate.status === 'ERROR' ? 'error' : 'info'}>{candidate.status}{candidate.error ? `: ${candidate.error}` : ''}</Alert>
        <Typography>Review the complete policy and property writes before activation. Coding is {candidate.agentPolicy?.execution?.codingProfile ? 'configured' : 'disabled'}.</Typography>
        <Box component="pre" sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', maxHeight: 350, overflow: 'auto' }}>{JSON.stringify(candidate, null, 2)}</Box>
        {candidate.status === 'READY_TO_PUBLISH' && <FormControlLabel control={<Checkbox checked={reviewed} disabled={busy} onChange={e => setReviewed(e.target.checked)} />} label="I reviewed this policy and its property writes" />}
      </>}
    </Stack></DialogContent>
    <DialogActions>
      <Button onClick={onClose} disabled={busy}>Close</Button>
      <Button onClick={() => setRefresh(v => v + 1)} disabled={busy}>Refresh preview</Button>
      <Button variant="contained" onClick={publish} disabled={busy || !reviewed || candidate?.status !== 'READY_TO_PUBLISH' || !candidate.candidateDigest}>Publish and activate</Button>
    </DialogActions>
  </Dialog>;
}
