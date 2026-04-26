import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { MRT_Cell, MRT_RowData } from 'material-react-table';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export type AuthSessionStatus = 'ACTIVE' | 'EXPIRED' | 'REVOKED' | string;

export type RevokeDialogTarget = {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  defaultReason?: string;
};

type RevokeDialogProps = {
  target: RevokeDialogTarget | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
};

export const TruncatedCell = <T extends MRT_RowData>({ cell, maxWidth = 200 }: { cell: MRT_Cell<T, unknown>; maxWidth?: number }) => {
  const value = String(cell.getValue<string>() ?? '');
  return <TruncatedText value={value} maxWidth={maxWidth} />;
};

export function TruncatedText({ value, maxWidth = 200 }: { value?: string | null; maxWidth?: number }) {
  const text = value ?? '';
  return (
    <Tooltip title={text} placement="top-start">
      <Box component="span" sx={{ display: 'block', maxWidth, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
        {text}
      </Box>
    </Tooltip>
  );
}

export function CopyableTruncatedText({ value, maxWidth = 200, label = 'Copy value' }: { value?: string | null; maxWidth?: number; label?: string }) {
  const text = value ?? '';
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, maxWidth }}>
      <TruncatedText value={text} maxWidth={Math.max(maxWidth - 34, 80)} />
      {text && (
        <Tooltip title={label}>
          <IconButton size="small" onClick={() => navigator.clipboard?.writeText(text)}>
            <ContentCopyIcon fontSize="inherit" />
          </IconButton>
        </Tooltip>
      )}
    </Box>
  );
}

export function DateTimeCell<T extends MRT_RowData>({ cell }: { cell: MRT_Cell<T, unknown> }) {
  return <>{formatDateTime(cell.getValue<string>())}</>;
}

export function formatDateTime(value?: string | null) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}

export function computedSessionStatus(status?: string | null, expiresTs?: string | null): AuthSessionStatus {
  if ((status ?? '').toUpperCase() === 'ACTIVE' && expiresTs) {
    const expires = new Date(expiresTs);
    if (!Number.isNaN(expires.getTime()) && expires.getTime() < Date.now()) {
      return 'EXPIRED';
    }
  }
  return (status || 'UNKNOWN').toUpperCase();
}

export function StatusChip({ status, expiresTs }: { status?: string | null; expiresTs?: string | null }) {
  const displayStatus = computedSessionStatus(status, expiresTs);
  const color = displayStatus === 'ACTIVE' ? 'success' : displayStatus === 'REVOKED' ? 'error' : displayStatus === 'EXPIRED' ? 'default' : 'warning';
  return <Chip label={displayStatus} size="small" color={color} variant="outlined" />;
}

export function EventTypeChip({ eventType }: { eventType?: string | null }) {
  const event = eventType || 'UNKNOWN';
  const color = event === 'SESSION_REVOKED' || event.endsWith('_REJECTED') || event.endsWith('_FAILED')
    ? 'error'
    : event.includes('ROTATED')
      ? 'warning'
      : event.includes('ISSUED') || event.includes('SUCCEEDED') || event.includes('CONSUMED')
        ? 'success'
        : 'default';
  return <Chip label={event} size="small" color={color} variant="outlined" />;
}

export function ResultChip({ result }: { result?: string | null }) {
  const displayResult = result || 'SUCCESS';
  return <Chip label={displayResult} size="small" color={displayResult === 'SUCCESS' ? 'success' : 'error'} variant="outlined" />;
}

export function FriendlyUserAgentCell<T extends MRT_RowData>({ cell }: { cell: MRT_Cell<T, unknown> }) {
  const value = cell.getValue<string>() ?? '';
  return <TruncatedText value={friendlyUserAgent(value)} maxWidth={220} />;
}

export function friendlyUserAgent(userAgent?: string | null) {
  if (!userAgent) return '';
  const browser = extractBrowser(userAgent);
  const os = extractOs(userAgent);
  return browser && os ? `${browser} on ${os}` : browser || os || userAgent;
}

export function metadataSummary(metadata?: unknown) {
  if (!metadata) return '';
  const value = typeof metadata === 'string' ? parseJson(metadata) : metadata;
  if (!value || typeof value !== 'object' || Array.isArray(value)) return String(metadata);
  const map = value as Record<string, unknown>;
  const keys = ['reason', 'failureReason', 'grantType', 'source', 'adminUser'];
  const parts = keys
    .filter((key) => map[key] !== undefined && map[key] !== null && String(map[key]) !== '')
    .map((key) => `${key}: ${String(map[key])}`);
  return parts.length ? parts.join(', ') : JSON.stringify(map);
}

export function MetadataCell<T extends MRT_RowData>({ cell }: { cell: MRT_Cell<T, unknown> }) {
  const [open, setOpen] = useState(false);
  const value = cell.getValue<unknown>();
  const summary = metadataSummary(value);
  const full = useMemo(() => {
    if (!value) return '';
    if (typeof value === 'string') {
      const parsed = parseJson(value);
      return parsed ? JSON.stringify(parsed, null, 2) : value;
    }
    return JSON.stringify(value, null, 2);
  }, [value]);

  if (!summary) return null;

  return (
    <>
      <Button size="small" variant="text" onClick={() => setOpen(true)} sx={{ textTransform: 'none', justifyContent: 'flex-start', px: 0 }}>
        <TruncatedText value={summary} maxWidth={220} />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Metadata</DialogTitle>
        <DialogContent>
          <Box component="pre" sx={{ m: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 13 }}>
            {full}
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

export function suspiciousAuditRow(eventType?: string | null, result?: string | null) {
  const event = eventType || '';
  return (result && result !== 'SUCCESS') || event === 'REFRESH_TOKEN_REJECTED' || event === 'LOGIN_FAILED';
}

export function SuspiciousEventMarker({ eventType, result }: { eventType?: string | null; result?: string | null }) {
  if (!suspiciousAuditRow(eventType, result)) return null;
  return (
    <Tooltip title="Suspicious event">
      <WarningAmberIcon color="warning" fontSize="small" />
    </Tooltip>
  );
}

export function RevokeDialog({ target, onCancel, onConfirm }: RevokeDialogProps) {
  const [reason, setReason] = useState(target?.defaultReason ?? 'ADMIN_REVOKED');

  useEffect(() => {
    setReason(target?.defaultReason ?? 'ADMIN_REVOKED');
  }, [target]);

  if (!target) return null;

  return (
    <Dialog open onClose={onCancel} maxWidth="sm" fullWidth>
      <DialogTitle>{target.title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" sx={{ mb: 2 }}>
          {target.message}
        </Typography>
        <TextField
          label="Reason"
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          fullWidth
          size="small"
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={onCancel}>Cancel</Button>
        <Button color="error" variant="contained" onClick={() => onConfirm(reason.trim() || 'ADMIN_REVOKED')}>
          {target.confirmLabel ?? 'Revoke'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function extractBrowser(userAgent: string) {
  const patterns: Array<[RegExp, string]> = [
    [/Edg\/([\d.]+)/, 'Edge'],
    [/Chrome\/([\d.]+)/, 'Chrome'],
    [/Firefox\/([\d.]+)/, 'Firefox'],
    [/Version\/([\d.]+).*Safari\//, 'Safari'],
  ];
  for (const [pattern, name] of patterns) {
    const match = userAgent.match(pattern);
    if (match?.[1]) return `${name} ${match[1].split('.')[0]}`;
  }
  return '';
}

function extractOs(userAgent: string) {
  if (userAgent.includes('Windows NT')) return 'Windows';
  if (userAgent.includes('Mac OS X')) return 'macOS';
  if (userAgent.includes('Android')) return 'Android';
  if (userAgent.includes('iPhone') || userAgent.includes('iPad')) return 'iOS';
  if (userAgent.includes('Linux')) return 'Linux';
  return '';
}

function parseJson(value: string) {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}
