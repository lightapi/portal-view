import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider,
  Stack, Tab, Tabs, Typography,
} from '@mui/material';
import PersonAddAltOutlinedIcon from '@mui/icons-material/PersonAddAltOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import DeleteIcon from '@mui/icons-material/DeleteOutline';
import fetchClient from '../../utils/fetchClient';
import { apiPost } from '../../api/apiPost';
import { AddPermPanel } from './AddPermPanel';
import { AnyPermission, AttributePermission, FGA, FGA_TYPES, FgaType } from './accessControl.types';
import type { EndpointRule } from './accessControl.types';

interface EndpointPermSectionProps {
  host: string;
  apiVersionId: string;
  endpointId: string;
  rules: EndpointRule[];
  onHasAccess?: (v: boolean) => void;
}

/**
 * "Access Principals" section of EndpointCard — only rendered when at least one rule exists.
 * Manages its own permission state, tab selection, and load-on-demand per FGA type.
 */
export default function EndpointPermSection({
  host, apiVersionId, endpointId, rules, onHasAccess,
}: EndpointPermSectionProps) {
  const [activeTab, setActiveTab] = useState<FgaType>('role');
  const [permissions, setPermissions] = useState<Record<FgaType, AnyPermission[]>>(
    { role: [], group: [], position: [], attribute: [] },
  );
  const loadedTabsRef = useRef<Set<FgaType>>(new Set());
  const [loadingTab, setLoadingTab] = useState<FgaType | null>(null);
  const [showAddPerm, setShowAddPerm] = useState(false);

  const loadTabPermissions = useCallback(async (type: FgaType) => {
    if (loadedTabsRef.current.has(type)) return;
    loadedTabsRef.current.add(type);
    setLoadingTab(type);
    const cfg = FGA[type];
    try {
      const filters = JSON.stringify([
        { id: 'apiVersionId', value: apiVersionId },
        { id: 'endpointId', value: endpointId },
      ]);
      const cmd = {
        host: 'lightapi.net', service: cfg.service, action: cfg.queryAction, version: '0.1.0',
        data: { hostId: host, offset: 0, limit: 200, active: true, filters, sorting: '[]', globalFilter: '' },
      };
      const data = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
      setPermissions((prev) => ({ ...prev, [type]: data?.[cfg.resultKey] ?? [] }));
    } catch {
      loadedTabsRef.current.delete(type);
    } finally { setLoadingTab(null); }
  }, [host, apiVersionId, endpointId]);

  useEffect(() => {
    if (rules.length > 0) loadTabPermissions(activeTab);
  }, [rules.length, activeTab, loadTabPermissions]);

  const handleTabChange = (_: React.SyntheticEvent, t: FgaType) => {
    setActiveTab(t);
    setShowAddPerm(false);
    if (rules.length > 0) loadTabPermissions(t);
  };

  const deletePerm = async (perm: AnyPermission) => {
    const cfg = FGA[activeTab];
    const result = await apiPost({
      url: '/portal/command', headers: {}, body: {
        host: 'lightapi.net', service: cfg.service, action: cfg.deleteAction, version: '0.1.0', data: perm,
      },
    });
    if (!result?.error) {
      setPermissions((prev) => ({
        ...prev,
        [activeTab]: prev[activeTab].filter((p) => (p as any)[cfg.idKey] !== (perm as any)[cfg.idKey]),
      }));
    }
  };

  const handlePermSuccess = useCallback(() => {
    setShowAddPerm(false);
    loadedTabsRef.current.delete(activeTab);
    setPermissions((prev) => ({ ...prev, [activeTab]: [] }));
    loadTabPermissions(activeTab);
    onHasAccess?.(true);
  }, [activeTab, loadTabPermissions, onHasAccess]);

  return (
    <Box>
      <Divider sx={{ mb: 2 }} />
      <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ mb: 1.25 }}>
        <Stack direction="row" alignItems="center" spacing={0.75}>
          <PersonOutlineIcon sx={{ fontSize: 14, color: 'success.main' }} />
          <Typography variant="caption" fontWeight={700} sx={{ textTransform: 'uppercase', letterSpacing: '0.06em', color: 'success.main' }}>
            Access Principals
          </Typography>
        </Stack>
        <Button size="small"
          startIcon={showAddPerm ? undefined : <PersonAddAltOutlinedIcon sx={{ fontSize: '0.85rem !important' }} />}
          onClick={() => setShowAddPerm((v) => !v)}
          color={showAddPerm ? 'inherit' : 'success'}
          sx={{ fontSize: '0.72rem', py: 0.25 }}>
          {showAddPerm ? 'Cancel' : `Add ${FGA[activeTab].label}`}
        </Button>
      </Stack>

      <Tabs value={activeTab} onChange={handleTabChange}
        sx={{ minHeight: 34, mb: 1.5, '& .MuiTab-root': { minHeight: 34, py: 0.5, fontSize: '0.78rem', textTransform: 'none', fontWeight: 600 } }}>
        {FGA_TYPES.map((type) => {
          const count = permissions[type].length;
          return (
            <Tab key={type} value={type} label={
              <Stack direction="row" alignItems="center" spacing={0.5}>
                <span>{FGA[type].label}</span>
                {count > 0 && <Chip label={count} size="small" color="primary" sx={{ height: 16, fontSize: '0.63rem', '& .MuiChip-label': { px: 0.6 } }} />}
              </Stack>
            } />
          );
        })}
      </Tabs>

      {loadingTab === activeTab ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 2 }}><CircularProgress size={20} /></Box>
      ) : (
        <Stack spacing={1.5}>
          {permissions[activeTab].length > 0 && (
            <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75 }}>
              {permissions[activeTab].map((perm) => {
                const id = (perm as any)[FGA[activeTab].idKey];
                const extra = activeTab === 'attribute' ? ` = ${(perm as AttributePermission).attributeValue ?? ''}` : '';
                return (
                  <Chip key={id} label={id + extra} size="small"
                    onDelete={() => deletePerm(perm)} deleteIcon={<DeleteIcon />}
                    sx={{ fontFamily: 'monospace', fontSize: '0.78rem' }} />
                );
              })}
            </Stack>
          )}
          {showAddPerm && (
            <AddPermPanel key={activeTab}
              host={host} activeTab={activeTab} apiVersionId={apiVersionId} endpointId={endpointId}
              onSuccess={handlePermSuccess}
              onCancel={() => setShowAddPerm(false)}
            />
          )}
          {!showAddPerm && permissions[activeTab].length === 0 && (
            <Alert severity="info" sx={{ py: 0.5, '& .MuiAlert-message': { fontSize: '0.82rem' } }}>
              No {FGA[activeTab].label.toLowerCase()} principals assigned yet.
            </Alert>
          )}
        </Stack>
      )}
    </Box>
  );
}
