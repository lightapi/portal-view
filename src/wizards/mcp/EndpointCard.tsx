import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress,
  IconButton, Stack, Tooltip, Typography,
} from '@mui/material';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import GavelOutlinedIcon from '@mui/icons-material/GavelOutlined';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import CollapsibleCard from '../../components/CollapsibleCard';
import { AddRulePanel } from './AddRulePanel';
import { EndpointRule, LabelOption } from './accessControl.types';
import EndpointPermSection from './EndpointPermSection';

interface CardProps {
  host: string; apiId: string; apiVersion: string; apiVersionId: string;
  endpointId: string; endpointLabel: string; endpoint: string; endpointDescription?: string;
  onHasAccess?: (v: boolean) => void;
}

export function EndpointCard({ host, apiId, apiVersion, apiVersionId, endpointId, endpointLabel, endpoint, endpointDescription, onHasAccess }: CardProps) {
  const [rules, setRules] = useState<EndpointRule[]>([]);
  const [loadingRules, setLoadingRules] = useState(false);
  const rulesLoadedRef = useRef(false);
  const ruleTypeCacheRef = useRef<LabelOption[] | null>(null);
  const [showAddRule, setShowAddRule] = useState(false);
  const [totalPrincipals, setTotalPrincipals] = useState(0);

  const loadRules = useCallback(async () => {
    setLoadingRules(true);
    try {
      const cmd = {
        host: 'lightapi.net', service: 'service', action: 'getApiEndpointRule', version: '0.1.0',
        data: { hostId: host, endpointId, active: true },
      };
      const data = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
      setRules(Array.isArray(data) ? data : []);
      rulesLoadedRef.current = true;
    } finally { setLoadingRules(false); }
  }, [host, endpointId]);

  // Load rules on mount (card starts open by default).
  useEffect(() => { loadRules(); }, [loadRules]);

  const deleteRule = async (rule: EndpointRule) => {
    const result = await apiPost({
      url: '/portal/command', headers: {}, body: {
        host: 'lightapi.net', service: 'service', action: 'deleteApiEndpointRule', version: '0.1.0',
        data: { hostId: rule.hostId, endpointId: rule.endpointId, ruleId: rule.ruleId },
      },
    });
    if (!result?.error) setRules((prev) => prev.filter((r) => r.ruleId !== rule.ruleId));
  };

  const handleRuleSuccess = useCallback(() => {
    setShowAddRule(false);
    loadRules();
    onHasAccess?.(true);
  }, [loadRules, onHasAccess]);

  const hasRules = rules.length > 0;

  const header = (
    <>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="body2" fontWeight={700} fontFamily="monospace" noWrap>
          {endpointLabel}
        </Typography>
        {endpointDescription && (
          <Typography variant="caption" color="text.secondary" noWrap display="block">
            {endpointDescription}
          </Typography>
        )}
      </Box>
      {hasRules && (
        <Chip label={`${rules.length} rule${rules.length !== 1 ? 's' : ''}`} size="small" color="warning" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
      )}
      {totalPrincipals > 0 && (
        <Chip label={`${totalPrincipals} principal${totalPrincipals !== 1 ? 's' : ''}`} size="small" color="success" variant="outlined" sx={{ height: 20, fontSize: '0.68rem' }} />
      )}
    </>
  );

  return (
    <CollapsibleCard
      header={header}
      onToggle={(isOpen) => { if (isOpen && !rulesLoadedRef.current) loadRules(); }}
      sx={{ borderColor: 'divider' }}
      headerSx={{ bgcolor: (t) => t.palette.action.hover, py: 1.25 }}
    >
      <Box sx={{ p: 2.5 }}>
        {loadingRules ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={22} /></Box>
        ) : (
          <Stack spacing={2.5}>
              {/* ── Rules section ── */}
              <Box>
                <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1 }}>
                  <Stack direction="row" alignItems="center" spacing={0.75}>
                    <GavelOutlinedIcon sx={{ fontSize: 14, color: 'warning.main' }} />
                    <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: 'warning.main' }}>
                      Rules
                    </Typography>
                  </Stack>
                  <Button size="small"
                    startIcon={showAddRule ? undefined : <AddIcon sx={{ fontSize: '0.85rem !important' }} />}
                    onClick={() => setShowAddRule((v) => !v)}
                    color={showAddRule ? 'inherit' : 'warning'}
                    sx={{ fontSize: '0.72rem', py: 0.25 }}>
                    {showAddRule ? 'Cancel' : 'Add Rule'}
                  </Button>
                </Stack>

                {rules.length === 0 && !showAddRule ? (
                  <Alert severity="info" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: '0.82rem' } }}>
                    No rules yet. Add a rule to enable access principal assignment below.
                  </Alert>
                ) : (
                  <Stack spacing={0.75}>
                    {rules.map((rule) => (
                      <Box key={rule.ruleId} sx={(t) => ({
                        display: 'flex', alignItems: 'center', px: 1.5, py: 0.75, borderRadius: 1.5,
                        bgcolor: alpha(t.palette.warning.main, 0.07), border: `1px solid ${alpha(t.palette.warning.main, 0.3)}`,
                      })}>
                        <Stack sx={{ flex: 1 }}>
                          <Typography variant="body2" fontWeight={600} sx={{ fontSize: '0.82rem', fontFamily: 'monospace' }}>{rule.ruleId}</Typography>
                          <Typography variant="caption" color="text.secondary">{rule.ruleType}</Typography>
                        </Stack>
                        <Tooltip title="Remove rule">
                          <IconButton size="small" color="error" onClick={() => deleteRule(rule)}>
                            <DeleteIcon sx={{ fontSize: 17 }} />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                  </Stack>
                )}

                {showAddRule && (
                  <AddRulePanel
                    host={host} apiId={apiId} apiVersion={apiVersion}
                    endpointId={endpointId} endpoint={endpoint} endpointLabel={endpointLabel}
                    ruleTypeCacheRef={ruleTypeCacheRef}
                    onSuccess={handleRuleSuccess}
                    onCancel={() => setShowAddRule(false)}
                  />
                )}
              </Box>

              {/* ── Principals section (rule-gated) ── */}
              {hasRules && (
                <EndpointPermSection
                  host={host} apiVersionId={apiVersionId} endpointId={endpointId} rules={rules}
                  onHasAccess={(v) => { if (v) setTotalPrincipals((n) => n + 1); onHasAccess?.(v); }}
                />
              )}
          </Stack>
        )}
      </Box>
    </CollapsibleCard>
  );
}
