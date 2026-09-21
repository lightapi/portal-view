import { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import CircularProgress from '@mui/material/CircularProgress';
import FormControlLabel from '@mui/material/FormControlLabel';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import type { IPublicClientApplication } from '@azure/msal-browser';
import { useMsal } from '@azure/msal-react';
import { isSsoEnabled } from '../../../config';
import Widget from '../../components/Widget/Widget';
import fetchClient from '../../utils/fetchClient';
import { signIn } from '../../utils/signIn';
import {
  approvalOutcome,
  failedDecision,
  describeError,
  formatDuration,
  formatUserCode,
  isUnauthorized,
  normalizeUserCode,
  providerFromLink,
} from './deviceApproval';

/** What the server says a pending code is asking for. */
export type PendingRequest = {
  clientName: string;
  scope: string | null;
  requestedFrom: string | null;
  requestedSecondsAgo: number;
  expiresIn: number;
  sessionSeconds: number;
  rememberSeconds: number;
};

const RETURN_KEY = 'portal_device_request';
const RETURN_MAX_AGE_MS = 15 * 60 * 1000;

type SavedRequest = { code: string; provider: string };

/** The request we were asked to approve before the person had to sign in, if it is recent. */
function savedRequest(): SavedRequest | null {
  try {
    const saved = JSON.parse(localStorage.getItem(RETURN_KEY) ?? 'null') as
      | { code?: string; provider?: string; at?: number }
      | null;
    const code = normalizeUserCode(saved?.code);
    const provider = providerFromLink(saved?.provider);
    return code && provider && saved?.at && Date.now() - saved.at < RETURN_MAX_AGE_MS ? { code, provider } : null;
  } catch {
    return null;
  }
}

function saveRequest(request: SavedRequest) {
  try {
    localStorage.setItem(RETURN_KEY, JSON.stringify({ ...request, at: Date.now() }));
  } catch {
    // Storage may be unavailable; the person can open the link again.
  }
}

function clearSavedRequest() {
  try {
    localStorage.removeItem(RETURN_KEY);
  } catch {
    // Nothing to clean up.
  }
}

/**
 * Approve or deny a `/login` request (OAuth device grant, RFC 8628).
 *
 * The person signs in to Portal as usual (password, social or SSO); this page then shows what the
 * request is for and sends the decision to light-oauth with their session. light-oauth is reached
 * through the Gateway, which turns the session cookie into the bearer token it checks.
 */
function DeviceApprovalPage({ msalInstance }: { msalInstance?: IPublicClientApplication }) {
  const [searchParams] = useSearchParams();
  // Which OAuth provider this request is for comes from the link the CLI printed, not from this
  // portal's configuration: a CLI downloaded from another instance names that instance's provider.
  // A link a person typed by hand (the address without `?provider=`) falls back to a saved request.
  const [providerId] = useState<string | null>(
    () => providerFromLink(searchParams.get('provider')) ?? savedRequest()?.provider ?? null,
  );
  const [input, setInput] = useState(() => searchParams.get('user_code') ?? '');
  const [code, setCode] = useState<string | null>(null);
  const [request, setRequest] = useState<PendingRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [needsSignIn, setNeedsSignIn] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [remember, setRemember] = useState(false);
  const [outcome, setOutcome] = useState<ReturnType<typeof approvalOutcome> | null>(null);

  const lookUp = useCallback(
    async (typed: string, provider: string) => {
      const normalized = normalizeUserCode(typed);
      if (!normalized) {
        setProblem('That is not a valid code. It is eight letters, like BCDF-GHJK.');
        return;
      }
      setBusy(true);
      setProblem(null);
      setNeedsSignIn(false);
      setConfirmed(false);
      setRemember(false);
      try {
        const found = (await fetchClient(
          `/oauth2/${encodeURIComponent(provider)}/device/lookup?user_code=${normalized}`,
          { method: 'GET' },
        )) as PendingRequest;
        setCode(normalized);
        setRequest(found);
        clearSavedRequest();
      } catch (error) {
        if (isUnauthorized(error)) {
          saveRequest({ code: normalized, provider });
          setNeedsSignIn(true);
        } else if (/\bHTTP 404\b/.test(describeError(error))) {
          setProblem('That code is not valid or has expired. Start again with `/login`.');
        } else {
          setProblem(describeError(error));
        }
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  // A link with the code in it, or the request we saved before sign-in, is looked up straight away.
  useEffect(() => {
    if (!providerId) return;
    const start = normalizeUserCode(searchParams.get('user_code')) ?? savedRequest()?.code ?? null;
    if (start) {
      setInput(start);
      void lookUp(start, providerId);
    }
    // Only on first load.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const decide = async (action: 'approve' | 'deny') => {
    if (!code || !providerId) return;
    setBusy(true);
    setProblem(null);
    try {
      const reply = (await fetchClient(`/oauth2/${encodeURIComponent(providerId)}/device/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ user_code: code, action, remember: String(remember) }).toString(),
      })) as { status: string; lifetimeSeconds?: number };
      setOutcome(approvalOutcome(reply.status, reply.lifetimeSeconds));
      setRequest(null);
    } catch (error) {
      if (isUnauthorized(error)) {
        saveRequest({ code, provider: providerId });
        setNeedsSignIn(true);
      } else {
        const status = failedDecision(error);
        if (status) {
          setOutcome(approvalOutcome(status));
          setRequest(null);
        } else {
          setProblem(describeError(error));
        }
      }
    } finally {
      setBusy(false);
    }
  };

  if (!providerId) {
    return (
      <Widget title="Sign in a device" disableWidgetMenu>
        <Alert severity="warning">
          This page needs the link that <code>/login</code> in the Light CLI printed: it says which sign-in service the
          request is for. Open that link, or run <code>/login</code> in the Light CLI again.
        </Alert>
      </Widget>
    );
  }

  return (
    <Widget title="Sign in a device" disableWidgetMenu>
      <Stack spacing={2} sx={{ maxWidth: 560 }}>
        {outcome && <Alert severity={outcome.severity}>{outcome.text}</Alert>}
        {problem && <Alert severity="error">{problem}</Alert>}
        {needsSignIn && (
          <Alert
            severity="warning"
            action={
              <Button color="inherit" size="small" onClick={() => void signIn(msalInstance)}>
                Sign in
              </Button>
            }
          >
            Sign in to Portal to approve this request, then open the link from your terminal again.
          </Alert>
        )}

        {!request && !outcome && (
          <Box
            component="form"
            onSubmit={(event) => {
              event.preventDefault();
              void lookUp(input, providerId);
            }}
          >
            <Typography sx={{ mb: 1 }}>Enter the code that `/login` showed in your terminal.</Typography>
            <Stack direction="row" spacing={1}>
              <TextField
                label="Code"
                placeholder="XXXX-XXXX"
                value={input}
                onChange={(event) => setInput(event.target.value)}
                autoComplete="off"
                autoFocus
                size="small"
              />
              <Button type="submit" variant="contained" disabled={busy || !input.trim()}>
                Continue
              </Button>
              {busy && <CircularProgress size={24} />}
            </Stack>
          </Box>
        )}

        {request && code && (
          <>
            <Typography>A device is asking to sign in to your account.</Typography>
            <Typography variant="h5" component="p" sx={{ fontFamily: 'monospace', letterSpacing: 2 }}>
              {formatUserCode(code)}
            </Typography>
            <Box component="ul" sx={{ m: 0, pl: 3 }}>
              <li>
                Application: <strong>{request.clientName}</strong>
              </li>
              <li>
                Requested from: <strong>{request.requestedFrom ?? 'an unknown address'}</strong>,{' '}
                {formatDuration(request.requestedSecondsAgo)} ago
              </li>
              <li>
                Access: <strong>{request.scope ?? 'standard access'}</strong>, with all of your roles
              </li>
              <li>
                This request expires in <strong>{formatDuration(request.expiresIn)}</strong>
              </li>
            </Box>
            <Alert severity="warning">
              Only approve this if you are connecting from the Light CLI right now: you ran `/login` and the
              code above is the one it shows. If you did not start this, or someone sent you this code or link, deny it:
              approving gives that device access to your account, with all of your roles.
            </Alert>
            <FormControlLabel
              control={<Checkbox checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} />}
              label="I started this sign-in and the code matches"
            />
            <FormControlLabel
              control={<Checkbox checked={remember} onChange={(event) => setRemember(event.target.checked)} />}
              label={`Keep this device signed in for ${formatDuration(request.rememberSeconds)} instead of ${formatDuration(request.sessionSeconds)}`}
            />
            <Stack direction="row" spacing={1}>
              <Button variant="contained" disabled={busy || !confirmed} onClick={() => void decide('approve')}>
                Approve
              </Button>
              <Button variant="outlined" color="error" disabled={busy} onClick={() => void decide('deny')}>
                Deny
              </Button>
              {busy && <CircularProgress size={24} />}
            </Stack>
          </>
        )}
      </Stack>
    </Widget>
  );
}

// The MSAL instance exists only when SSO is enabled (the provider is mounted only then), so its hook is
// used only then, as the header menu does.
function DeviceApprovalWithMsal() {
  const { instance } = useMsal();
  return <DeviceApprovalPage msalInstance={instance} />;
}

export default function DeviceApproval() {
  return isSsoEnabled ? <DeviceApprovalWithMsal /> : <DeviceApprovalPage />;
}
