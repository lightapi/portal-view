import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControl,
  FormControlLabel,
  FormLabel,
  MenuItem,
  Radio,
  RadioGroup,
  Select,
  Stack,
  Typography,
} from '@mui/material';
import fetchClient from '../../utils/fetchClient';
import { apiPost } from '../../api/apiPost';

type PublicationVersion = {
  instanceApiId: string;
  apiVersionId: string;
  apiVersion: string;
  selected: boolean;
  active: boolean;
  pathPrefixes?: Array<{ pathPrefix: string; active: boolean }>;
  appBindings?: Array<{ instanceAppId: string; active: boolean; ownerActive?: boolean }>;
  properties?: Array<{ active: boolean }>;
};

type GatewayCandidate = {
  instanceId: string;
  instanceName: string;
  serviceId: string;
  environment?: string;
  envTag?: string;
  productVersion: string;
  acceptedRevision: number;
  projectedRevision: number;
  projectionReady: boolean;
  projectionFailure: boolean;
  currentSnapshotId?: string;
  currentSnapshotTs?: string;
  versions: PublicationVersion[];
};

type PublicationIssue = { code: string; message: string; endpoint?: string };
type DependencyDecision = PublicationIssue & {
  instanceApiId: string;
  instanceAppId: string;
  decision: 'RETIRE' | 'KEEP_OLD_VERSION' | 'BLOCK';
};
type PublicationPreview = {
  previewDigest: string;
  expectedTargetAcceptedRevision: number;
  associationAction: 'CREATE' | 'REACTIVATE' | 'UPDATE';
  instanceApiId?: string;
  warnings: PublicationIssue[];
  blockingErrors: PublicationIssue[];
  properties: Array<{ propertyId: string; propertyValue: string; action: string }>;
  retirements: PublicationVersion[];
  dependencyDecisions: DependencyDecision[];
  sourceCounts: { endpoints?: number; rules?: number; ruleBodies?: number };
};

type PublicationResult = {
  commandCorrelationId?: string;
  eventTransactionId?: string;
  eventsAccepted?: boolean;
  acceptedEventCount?: number;
  noChanges?: boolean;
  instanceApiId?: string;
};

type Props = {
  open: boolean;
  hostId: string;
  apiVersionId: string;
  apiVersion: string;
  onClose: () => void;
};

const queryUrl = (action: string, data: Record<string, unknown>) => {
  const cmd = { host: 'lightapi.net', service: 'config', action, version: '0.1.0', data };
  return '/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd));
};

export default function ApiGatewayPublicationDialog({
  open, hostId, apiVersionId, apiVersion, onClose,
}: Props) {
  const navigate = useNavigate();
  const [candidates, setCandidates] = useState<GatewayCandidate[]>([]);
  const [instanceId, setInstanceId] = useState('');
  const [mode, setMode] = useState<'KEEP_EXISTING_VERSIONS' | 'REPLACE_SELECTED'>('KEEP_EXISTING_VERSIONS');
  const [retireIds, setRetireIds] = useState<string[]>([]);
  const [preview, setPreview] = useState<PublicationPreview | null>(null);
  const [acknowledged, setAcknowledged] = useState<string[]>([]);
  const [result, setResult] = useState<PublicationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => candidate.instanceId === instanceId),
    [candidates, instanceId],
  );

  const loadCandidates = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await fetchClient(queryUrl('getApiGatewayPublicationCandidate', {
        hostId, apiVersionId,
      }));
      const values = (response?.candidates ?? []) as GatewayCandidate[];
      setCandidates(values);
      if (values.length === 1) setInstanceId(values[0].instanceId);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load eligible Gateways.');
    } finally {
      setLoading(false);
    }
  }, [apiVersionId, hostId]);

  useEffect(() => {
    if (!open) return;
    setCandidates([]);
    setInstanceId('');
    setMode('KEEP_EXISTING_VERSIONS');
    setRetireIds([]);
    setPreview(null);
    setAcknowledged([]);
    setResult(null);
    setError('');
    void loadCandidates();
  }, [loadCandidates, open]);

  const resetPreview = () => {
    setPreview(null);
    setAcknowledged([]);
    setResult(null);
    setError('');
  };

  const previewPublication = async () => {
    if (!instanceId) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const response = await fetchClient(queryUrl('previewApiVersionGatewayPublication', {
        hostId,
        apiVersionId,
        instanceId,
        publicationMode: mode,
        retireInstanceApiIds: retireIds,
        sections: ['ACCESS_CONTROL'],
      }));
      setPreview(response as PublicationPreview);
      setAcknowledged([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to preview publication.');
    } finally {
      setLoading(false);
    }
  };

  const publish = async () => {
    if (!preview) return;
    setLoading(true);
    setError('');
    try {
      const response = await apiPost({
        url: '/portal/command',
        headers: {},
        body: {
          host: 'lightapi.net', service: 'config', action: 'publishApiVersionToGateway', version: '0.1.0',
          data: {
            hostId,
            apiVersionId,
            instanceId,
            publicationMode: mode,
            retireInstanceApiIds: retireIds,
            sections: ['ACCESS_CONTROL'],
            acknowledgedWarningCodes: acknowledged,
            expectedTargetAcceptedRevision: preview.expectedTargetAcceptedRevision,
            expectedPreviewDigest: preview.previewDigest,
          },
        },
      });
      if (response.error) throw new Error(String(response.error));
      if (response.aborted) throw new Error('Publication command was cancelled.');
      if (!response.data || typeof response.data !== 'object') {
        throw new Error('Publication command returned an invalid response.');
      }
      setResult(response.data as PublicationResult);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Publication command failed.');
    } finally {
      setLoading(false);
    }
  };

  const warningCodes = useMemo(
    () => Array.from(new Set((preview?.warnings ?? []).map((warning) => warning.code))),
    [preview?.warnings],
  );
  const warningsAcknowledged = warningCodes.every((code) => acknowledged.includes(code));

  return (
    <Dialog open={open} onClose={loading ? undefined : onClose} fullWidth maxWidth="md">
      <DialogTitle>Publish API {apiVersion} to Gateway</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {error && <Alert severity="error">{error}</Alert>}
          {result && (
            <Alert severity="success">
              {result.noChanges
                ? 'The Gateway desired configuration already matches this API version; no events were needed.'
                : `Gateway publication events accepted (${result.acceptedEventCount ?? 0}).`}
              {' '}Projection is asynchronous; create a configuration snapshot after it catches up.
              {result.eventTransactionId && (
                <Typography variant="caption" display="block">
                  Transaction: {result.eventTransactionId}
                </Typography>
              )}
            </Alert>
          )}

          <FormControl fullWidth disabled={loading || Boolean(result)}>
            <FormLabel>Gateway instance</FormLabel>
            <Select
              value={instanceId}
              displayEmpty
              onChange={(event) => {
                setInstanceId(event.target.value);
                setRetireIds([]);
                resetPreview();
              }}
            >
              <MenuItem value="" disabled>Select a Gateway</MenuItem>
              {candidates.map((candidate) => (
                <MenuItem key={candidate.instanceId} value={candidate.instanceId}>
                  {candidate.instanceName} — {candidate.serviceId} ({candidate.productVersion})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {selectedCandidate && (
            <Alert severity={selectedCandidate.projectionFailure ? 'error' : selectedCandidate.projectionReady ? 'info' : 'warning'}>
              Projection revision {selectedCandidate.projectedRevision} of {selectedCandidate.acceptedRevision}.
              {selectedCandidate.projectionFailure && ' A projection failure is available in the DLQ.'}
              {!selectedCandidate.projectionReady && !selectedCandidate.projectionFailure && ' Projection is pending.'}
              {selectedCandidate.currentSnapshotId && (
                <Typography variant="caption" display="block">
                  Current snapshot: {selectedCandidate.currentSnapshotId}
                  {selectedCandidate.currentSnapshotTs ? ` (${selectedCandidate.currentSnapshotTs})` : ''}
                </Typography>
              )}
            </Alert>
          )}

          {selectedCandidate && (
            <FormControl disabled={loading || Boolean(result)}>
              <FormLabel>Existing versions</FormLabel>
              <RadioGroup
                value={mode}
                onChange={(event) => {
                  setMode(event.target.value as typeof mode);
                  setRetireIds([]);
                  resetPreview();
                }}
              >
                <FormControlLabel value="KEEP_EXISTING_VERSIONS" control={<Radio />} label="Keep existing versions" />
                <FormControlLabel value="REPLACE_SELECTED" control={<Radio />} label="Replace selected versions" />
              </RadioGroup>
              {selectedCandidate.versions.map((version) => (
                <FormControlLabel
                  key={version.instanceApiId}
                  control={(
                    <Checkbox
                      checked={retireIds.includes(version.instanceApiId)}
                      disabled={mode !== 'REPLACE_SELECTED' || version.selected || !version.active}
                      onChange={(event) => {
                        setRetireIds((current) => event.target.checked
                          ? [...current, version.instanceApiId]
                          : current.filter((id) => id !== version.instanceApiId));
                        resetPreview();
                      }}
                    />
                  )}
                  label={(
                    <Box>
                      <Typography variant="body2">
                        {version.apiVersion} — {version.active ? 'active' : 'inactive'}
                        {version.selected ? ' (selected version)' : ''}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Prefixes: {(version.pathPrefixes ?? []).filter((item) => item.active)
                          .map((item) => item.pathPrefix).join(', ') || 'none'};
                        {' '}application bindings: {(version.appBindings ?? []).filter((item) => item.active).length};
                        {' '}active properties: {(version.properties ?? []).filter((item) => item.active).length}
                      </Typography>
                    </Box>
                  )}
                />
              ))}
            </FormControl>
          )}

          {preview && (
            <Box>
              <Typography variant="subtitle1">Preview</Typography>
              <Typography variant="body2">
                Association: {preview.associationAction}; endpoints: {preview.sourceCounts.endpoints ?? 0};
                rules: {preview.sourceCounts.rules ?? 0}; rule bodies: {preview.sourceCounts.ruleBodies ?? 0}.
              </Typography>
              {preview.properties.map((property) => (
                <Box key={property.propertyId} sx={{ mt: 1 }}>
                  <Typography variant="body2">{property.propertyId}: {property.action}</Typography>
                  <Box component="pre" sx={{ m: 0, p: 1, maxHeight: 160, overflow: 'auto', bgcolor: 'action.hover', fontSize: 12 }}>
                    {property.propertyValue}
                  </Box>
                </Box>
              ))}
              {preview.blockingErrors.map((issue) => (
                <Alert severity="error" key={`${issue.code}:${issue.endpoint ?? ''}`} sx={{ mt: 1 }}>
                  {issue.code}: {issue.message}{issue.endpoint ? ` (${issue.endpoint})` : ''}
                </Alert>
              ))}
              {(preview.dependencyDecisions ?? []).length > 0 && (
                <Box sx={{ mt: 1 }}>
                  <Typography variant="subtitle2">Application binding decisions</Typography>
                  {(preview.dependencyDecisions ?? []).map((decision) => (
                    <Typography
                      variant="body2"
                      key={`${decision.instanceApiId}:${decision.instanceAppId}`}
                    >
                      {decision.instanceAppId}: {decision.decision} — {decision.message}
                    </Typography>
                  ))}
                </Box>
              )}
              {preview.warnings.map((warning) => (
                <Alert severity="warning" key={`${warning.code}:${warning.endpoint ?? ''}`} sx={{ mt: 1 }}>
                  {warning.code}: {warning.message}{warning.endpoint ? ` (${warning.endpoint})` : ''}
                </Alert>
              ))}
              {warningCodes.length > 0 && (
                <FormControlLabel
                  control={(
                    <Checkbox
                      checked={warningsAcknowledged}
                      onChange={(event) => setAcknowledged(event.target.checked ? warningCodes : [])}
                    />
                  )}
                  label="I acknowledge all publication warnings"
                />
              )}
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>Close</Button>
        {result && (
          <Button
            variant="contained"
            onClick={() => {
              onClose();
              navigate('/app/instance/InstanceAdmin');
            }}
          >
            Open Instance Admin
          </Button>
        )}
        {!result && (
          <Button
            onClick={previewPublication}
            disabled={loading || !instanceId || !selectedCandidate?.projectionReady}
          >
            Preview
          </Button>
        )}
        {!result && preview && (
          <Button
            variant="contained"
            onClick={publish}
            disabled={loading || preview.blockingErrors.length > 0 || !warningsAcknowledged}
          >
            {loading ? <CircularProgress size={20} /> : 'Publish events'}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
