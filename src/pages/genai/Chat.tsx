import React, { useState, useEffect, useRef } from 'react';
import {
    Box,
    TextField,
    Button,
    Paper,
    Typography,
    List,
    ListItem,
    Divider,
    IconButton,
    InputAdornment,
    Avatar,
    Chip,
    CircularProgress,
    MenuItem,
    Alert,
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ConnectWithoutContactIcon from '@mui/icons-material/ConnectWithoutContact';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import Cookies from 'universal-cookie';
import { useUserState } from '../../contexts/UserContext';
import CodingRequestForm from './CodingRequestForm';
import { clientMessageId, codingPayload, emptyCodingInput } from './codingRequest';
import { useChatAgents } from './useChatAgents';
import { renewChatAuthentication } from './chatAuthentication';
import { recordedChatTurns, rememberChatTurn } from './chatTurns';

interface Message {
    role: 'User' | 'Assistant' | 'System';
    text: string;
    timestamp: Date;
}

/** Returns the sessionStorage key scoped to a specific user and deployed instance. */
const getSessionKey = (uid: string, sid: string, host: string, env: string, instanceId: string) =>
    `agentSessionId:${host}:${env}:${uid}:${sid}:${instanceId}`;

export default function Chat() {
    const { email, isAuthenticated, host } = useUserState();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const userId = email || 'anonymous';
    const { agents, selected, selectAgent, loading, loadError, selectionMessage, reload } = useChatAgents(host, email, isAuthenticated);
    const serviceId = selected?.serviceId || '';
    const envTag = selected?.envTag || '';
    const [turnTypes, setTurnTypes] = useState<string[]>([]);
    const [connectionError, setConnectionError] = useState('');
    const connectionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [mode, setMode] = useState('chat');
    const [coding, setCoding] = useState(emptyCodingInput);
    const [sendError, setSendError] = useState('');
    const [sessionReady, setSessionReady] = useState(false);
    const [acceptedRequest, setAcceptedRequest] = useState<{ sessionId: string; request_id: string } | null>(null);
    const ws = useRef<WebSocket | null>(null);
    const authenticationExpiresAt = useRef<number | null>(null);
    const renewal = useRef<AbortController | null>(null);
    const contextGeneration = useRef(0);
    const draftId = useRef<string | null>(null);
    const lastSubmission = useRef<{ id: string; text: string } | null>(null);
    const userDisconnected = useRef(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const cookies = new Cookies();

    // A socket and its callbacks belong to one authenticated deployment selection.
    useEffect(() => {
        contextGeneration.current += 1;
        authenticationExpiresAt.current = null; draftId.current = null; lastSubmission.current = null;
        setConnected(false); setConnecting(false); setSessionReady(false);
        setMessages([]); setAcceptedRequest(null); setTurnTypes([]); setMode('chat');
        setConnectionError(''); setSendError(''); setCoding(emptyCodingInput); setInput('');
        return () => {
            contextGeneration.current += 1; renewal.current?.abort(); renewal.current = null;
            if (connectionTimer.current) clearTimeout(connectionTimer.current);
            const socket = ws.current;
            if (socket) {
                socket.onopen = null; socket.onmessage = null;
                socket.onclose = null; socket.onerror = null;
                socket.close(); ws.current = null;
            }
        };
    }, [email, host, isAuthenticated, selected?.instanceId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const reauthenticate = async () => {
        if (renewal.current) return;
        const generation = contextGeneration.current;
        const controller = new AbortController(); renewal.current = controller;
        const deadline = setTimeout(() => controller.abort(), 15000);
        if (connectionTimer.current) clearTimeout(connectionTimer.current);
        connectionTimer.current = null;
        const socket = ws.current;
        if (socket) { socket.onclose = null; socket.onmessage = null; socket.onerror = null; socket.onopen = null; socket.close(); ws.current = null; }
        setConnected(false); setSessionReady(false); setConnecting(true);
        try {
            await renewChatAuthentication(controller.signal);
            if (generation !== contextGeneration.current) return;
            if (controller.signal.aborted) throw new Error("Authentication renewal timed out");
            authenticationExpiresAt.current = null;
            handleConnect();
        } catch {
            if (generation === contextGeneration.current && !userDisconnected.current) {
                setConnecting(false);
                setConnectionError('Authentication renewal failed. Sign in again, then reconnect to this session.');
            }
        } finally { clearTimeout(deadline); if (renewal.current === controller) renewal.current = null; }
    };

    const handleConnect = () => {
        if (!selected || loading || !isAuthenticated || !host || !serviceId || !envTag) return;
        setConnectionError('');
        const csrfToken = cookies.get('csrf');
        if (!csrfToken) {
            setConnectionError('Your login session is missing its CSRF token. Sign in again before connecting.');
            return;
        }
        // Prevent duplicate connections: bail out if already connecting or open
        const readyState = ws.current?.readyState;
        if (readyState === WebSocket.CONNECTING || readyState === WebSocket.OPEN) {
            return;
        }

        // Close and clean up any leftover socket reference (e.g. in CLOSING or CLOSED state)
        if (ws.current) {
            ws.current.onopen = null;
            ws.current.onmessage = null;
            ws.current.onclose = null;
            ws.current.onerror = null;
            ws.current.close();
            ws.current = null;
        }

        userDisconnected.current = false;
        setConnecting(true);
        setSessionReady(false);

        // Capture the session key at connection time so the onmessage closure
        // always writes to the correct storage slot regardless of later state changes.
        const connectedKey = getSessionKey(userId, serviceId, host || '', envTag, selected.instanceId);

        // The accessToken is in cookies and automatically sent with the WebSocket upgrade request.
        const sessionId = sessionStorage.getItem(connectedKey);

        // Construct URL using new URL() so IPv6 hosts are correctly bracketed.
        const url = new URL('/chat', window.location.href);
        url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        url.searchParams.set('userId', userId);
        url.searchParams.set('serviceId', serviceId);
        url.searchParams.set('envTag', envTag);
        // Agent registrations use HTTP; an explicit serviceId bypasses the path target defaults.
        url.searchParams.set('protocol', 'http');
        if (sessionId) {
            url.searchParams.set('sessionId', sessionId);
        }

        // Use Sec-WebSocket-Protocol header for CSRF to avoid URL logging
        const protocols = csrfToken ? [`csrf.${csrfToken}`] : [];
        let socket: WebSocket;
        try {
            socket = new WebSocket(url.toString(), protocols);
        } catch {
            setConnecting(false);
            setConnectionError('Unable to start the chat connection. Check your login session and try again.');
            return;
        }
        ws.current = socket;
        let initialized = false;
        const clearDeadline = () => {
            if (connectionTimer.current) clearTimeout(connectionTimer.current);
            connectionTimer.current = null;
        };
        connectionTimer.current = setTimeout(() => {
            setConnectionError('The agent did not initialize a session within 30 seconds. Check its availability or try a new session.');
            socket.close();
            setConnecting(false); setConnected(false); setSessionReady(false);
        }, 30000);

        socket.onopen = () => {
            setConnecting(false);
            setConnected(true);
            addMessage('System', 'Connected to chat server.');
        };

        socket.onmessage = (event: MessageEvent) => {
            if (ws.current !== socket || socket.readyState !== WebSocket.OPEN) return;
            if (typeof event.data !== 'string') {
                console.warn('Received non-text WebSocket frame, ignoring:', event.data);
                return;
            }
            const data = event.data;
            try {
                const json = JSON.parse(data);
                if (json.type === 'session') {
                    const receivedSessionId =
                        typeof json.session_id === 'string' ? json.session_id.trim() : '';

                    if (!receivedSessionId) {
                        console.warn('Received invalid session initialization message:', json);
                        addMessage('System', 'Received invalid session initialization message.');
                        return;
                    }

                    initialized = true;
                    clearDeadline();
                    const types = Array.isArray(json.turnTypes)
                        ? Array.from(new Set<string>(json.turnTypes.filter((type: unknown) => type === 'chat' || type === 'coding')))
                        : ['chat']; // Older agents support the ordinary chat contract.
                    setTurnTypes(types);
                    setMode(types.includes(json.defaultTurnType) ? json.defaultTurnType : types[0] || '');
                    if (!types.length) {
                        setSessionReady(false);
                        setConnectionError('This agent does not advertise a supported turn type. Select another agent or start a new session.');
                        socket.close();
                        setConnected(false); setConnecting(false);
                        return;
                    }
                    setSessionReady(true);
                    sessionStorage.setItem(connectedKey, receivedSessionId);
                    addMessage('System', 'Session initialized: ' + receivedSessionId);
                } else if (json.type === 'authentication_context') {
                    authenticationExpiresAt.current = typeof json.expiresAt === 'number' ? json.expiresAt : 0;
                } else if (json.type === 'authentication_required') {
                    if (json.admitted === false && json.clientMessageId === lastSubmission.current?.id) {
                        const submission = lastSubmission.current!;
                        setInput(current => current || submission.text);
                        draftId.current = submission.id;
                    }
                    addMessage('System', 'Authentication expired. Reconnecting; accepted or uncertain turns will not be sent again.');
                    void reauthenticate();
                } else if (json.type === 'turnAccepted') {
                    if (typeof json.clientMessageId === 'string' && typeof json.turnId === 'string') {
                        rememberChatTurn(connectedKey, { clientMessageId: json.clientMessageId, turnId: json.turnId });
                    }
                } else if (json.type === 'turn_status') {
                    if (Array.isArray(json.turns)) {
                        for (const recorded of recordedChatTurns(connectedKey)) {
                            const turn = json.turns.find((turn: { turnId?: string; clientMessageId?: string }) => turn.turnId === recorded.turnId || turn.clientMessageId === recorded.clientMessageId);
                            addMessage('System', turn ? `Previous turn status: ${turn.state}.` : 'Previous turn status is unresolved; it has not been resubmitted.');
                        }
                    }
                } else if (json.type === 'executionAccepted') {
                    if (json.profile === 'coding' && typeof json.request_id === 'string') {
                        setAcceptedRequest({ sessionId: sessionStorage.getItem(connectedKey) || '', request_id: json.request_id });
                        addMessage('System', 'Coding request accepted for scheduling: ' + json.request_id + '. Completion and patch must be verified from the durable execution result.');
                    }
                } else if (json.type === 'text') {
                    if (typeof json.text === 'string') {
                        addMessage('Assistant', json.text);
                    } else {
                        console.warn('Received invalid text message payload:', json);
                        addMessage('System', 'Received invalid text message from agent.');
                    }
                } else if (json.type === 'error') {
                    if (typeof json.message === 'string') {
                        if (!initialized) setConnectionError(json.message);
                        addMessage('System', 'Error from agent: ' + json.message);
                    } else {
                        console.warn('Received invalid error message payload:', json);
                        addMessage('System', 'Received invalid error message from agent.');
                    }
                }
            } catch (e) {
                console.error('Failed to parse message from agent:', e);
                // Fallback for raw text if needed, though backend uses JSON
                addMessage('Assistant', data);
            }
        };

        socket.onclose = (event: CloseEvent) => {
            if (ws.current !== socket) return;
            clearDeadline();
            if (event.code === 4401 && !userDisconnected.current) { void reauthenticate(); return; }
            if (!initialized && !userDisconnected.current) setConnectionError(previous => previous || `The connection closed before the agent initialized a session (code ${event.code}). Check the agent and gateway logs, or try a new session.`);
            setConnecting(false);
            setConnected(false);
            setSessionReady(false);
            addMessage('System', 'Disconnected from chat server.');
        };

        socket.onerror = (error: Event) => {
            clearDeadline();
            if (userDisconnected.current) return;
            setConnecting(false); setConnected(false); setSessionReady(false);
            setConnectionError(`Could not connect to ${selected.instanceName || serviceId} (${envTag}). Check your login and agent availability. If it persists, inspect the /chat WebSocket upgrade and gateway logs.`);
            socket.close();
            console.error('WebSocket error:', error);
        };
    };

    const handleDisconnect = () => {
        userDisconnected.current = true;
        contextGeneration.current += 1; renewal.current?.abort(); renewal.current = null;
        if (connectionTimer.current) clearTimeout(connectionTimer.current);
        connectionTimer.current = null;
        setConnecting(false); setConnected(false); setSessionReady(false);
        if (ws.current) {
            ws.current.close();
        }
    };

    const handleSend = () => {
        if (!input.trim() || !ws.current || ws.current.readyState !== WebSocket.OPEN || !connected || !sessionReady || !turnTypes.includes(mode)) return;
        setSendError('');
        if (authenticationExpiresAt.current !== null && Date.now() >= authenticationExpiresAt.current * 1000) {
            draftId.current ||= clientMessageId();
            void reauthenticate();
            return;
        }
        try {
            const id = draftId.current || clientMessageId();
            const payload = mode === 'coding'
                ? { text: input, clientMessageId: id, profile: 'coding', coding: codingPayload(coding) }
                : { text: input, clientMessageId: id };
            if (selected) rememberChatTurn(getSessionKey(userId, serviceId, host || '', envTag, selected.instanceId), { clientMessageId: id });
            ws.current.send(JSON.stringify(payload));
            lastSubmission.current = { id, text: input }; draftId.current = null;
            addMessage('User', input);
            setInput('');
        } catch (error) { setSendError((error as Error).message); }
    };

    const addMessage = (role: Message['role'], text: string) => {
        setMessages((prev) => [...prev, { role, text, timestamp: new Date() }]);
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    return (
        <Box sx={{ p: 3, maxWidth: 1000, margin: '0 auto', height: 'calc(100vh - 120px)', overflowY: 'auto', display: 'flex', flexDirection: 'column', '& > *': { flexShrink: 0 } }}>
            <Paper elevation={3} sx={{ p: 2, mb: 2, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h5" sx={{ flexGrow: 1, fontWeight: 'bold', color: 'primary.main' }}>
                    GenAI Chat
                </Typography>
                
                <Chip icon={<PersonIcon />} label={isAuthenticated ? `Logged in as: ${email}` : 'Sign in to chat'}
                    color={isAuthenticated ? 'primary' : 'default'} variant="outlined"
                    sx={{ maxWidth: '100%', height: 'auto', '& .MuiChip-label': { whiteSpace: 'normal', overflowWrap: 'anywhere', py: 0.5 } }} />
                <Box sx={{ display: 'flex', alignItems: 'flex-start', flexWrap: 'wrap', gap: 2, width: '100%', minWidth: 0 }}>
                    <TextField select size="small" label="Agent" value={selected?.instanceId || ''}
                        onChange={event => selectAgent(event.target.value)}
                        disabled={loading || connected || connecting || !agents.length}
                        sx={{ flex: '1 1 280px', minWidth: 0, '& .MuiSelect-select': { whiteSpace: 'normal', overflowWrap: 'anywhere' }, '& .MuiFormHelperText-root': { overflowWrap: 'anywhere' } }}
                        helperText={loading ? 'Loading deployed agents…' : selected ? `${serviceId} · ${envTag}` : 'Select a deployed agent'}>
                        {agents.map(agent => <MenuItem key={agent.instanceId} value={agent.instanceId} disabled={!agent.serviceId || !agent.envTag}
                            sx={{ whiteSpace: 'normal', overflowWrap: 'anywhere' }}>
                            {agent.instanceName || agent.serviceId || agent.instanceId} · {agent.envTag || 'environment missing'}
                        </MenuItem>)}
                    </TextField>
                    {sessionReady && turnTypes.length > 1 && <TextField size="small" select label="Turn type" value={mode}
                        onChange={event => setMode(event.target.value)} sx={{ flex: '0 1 240px', minWidth: 0, '& .MuiSelect-select': { whiteSpace: 'normal' } }}>
                        {turnTypes.map(type => <MenuItem key={type} value={type}>{type === 'coding' ? 'Coding implementation' : 'Chat'}</MenuItem>)}
                    </TextField>}
                    {sessionReady && turnTypes.length === 1 && <Chip label={mode === 'coding' ? 'Coding implementation' : 'Chat'} />}
                    {!connected ? (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : <ConnectWithoutContactIcon />}
                            onClick={handleConnect}
                            disabled={connecting || loading || !isAuthenticated || !selected || !serviceId || !envTag}
                            sx={{ flexShrink: 0 }}
                        >
                            {connecting ? 'Connecting…' : 'Connect'}
                        </Button>
                    ) : (
                        <Button
                            variant="contained"
                            color="error"
                            startIcon={<LinkOffIcon />}
                            onClick={handleDisconnect}
                        >
                            Disconnect
                        </Button>
                    )}
                </Box>
            </Paper>

            {selectionMessage && <Alert severity="info">{selectionMessage}</Alert>}
            {loadError && <Alert severity="error" action={<Button onClick={reload}>Retry</Button>}>{loadError}</Alert>}
            {!loading && !loadError && isAuthenticated && !agents.length && <Alert severity="info">No active agent instances (product agt) are available for this Host.</Alert>}
            {connectionError && <Alert severity="error" sx={{ mb: 2 }} action={!connected && !connecting && selected ? <Button onClick={() => {
                sessionStorage.removeItem(getSessionKey(userId, serviceId, host || '', envTag, selected.instanceId));
                handleConnect();
            }}>New session</Button> : undefined}>{connectionError}</Alert>}
            {sessionReady && mode === 'coding' && <CodingRequestForm value={coding} onChange={setCoding} onPrompt={setInput} />}
            {sendError && <Alert severity="error">{sendError}</Alert>}
            {acceptedRequest && <Alert severity="info" action={<Button component="a" download="accepted.json" href={'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify({ ...acceptedRequest, profile: 'coding' }, null, 2))}>Download acceptance</Button>}>Accepted request: {acceptedRequest.request_id}. This is not a completed coding turn.</Alert>}
            <Paper elevation={3} sx={{ flex: '1 0 320px', minHeight: 320, mb: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: '#f5f7f9' }}>
                <Box sx={{ flexGrow: 1, minHeight: 0, overflowY: 'auto', p: 2 }}>
                    <List disablePadding>
                        {messages.length === 0 && (
                            <Box sx={{ display: 'flex', height: '100%', alignItems: 'center', justifyContent: 'center', opacity: 0.5 }}>
                                <Typography variant="h6">Connect and start a conversation</Typography>
                            </Box>
                        )}
                        {messages.map((msg, index) => (
                            <React.Fragment key={index}>
                                <ListItem alignItems="flex-start" sx={{ 
                                    flexDirection: msg.role === 'User' ? 'row-reverse' : 'row',
                                    gap: 1,
                                    mb: 1
                                }}>
                                    <Avatar sx={{ 
                                        bgcolor: msg.role === 'User' ? 'primary.main' : msg.role === 'Assistant' ? 'secondary.main' : 'grey.500',
                                        width: 32, height: 32 
                                    }}>
                                        {msg.role === 'User' ? <PersonIcon fontSize="small" /> : msg.role === 'Assistant' ? <SmartToyIcon fontSize="small" /> : 'S'}
                                    </Avatar>
                                    <Paper sx={{ 
                                        p: 1.5, 
                                        maxWidth: '70%', 
                                        borderRadius: 2,
                                        bgcolor: msg.role === 'User' ? 'primary.light' : 'white',
                                        color: msg.role === 'User' ? 'white' : 'text.primary',
                                        position: 'relative'
                                    }}>
                                        <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                            {msg.text}
                                        </Typography>
                                        <Typography variant="caption" sx={{ display: 'block', textAlign: 'right', mt: 0.5, opacity: 0.7 }}>
                                            {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </Typography>
                                    </Paper>
                                </ListItem>
                            </React.Fragment>
                        ))}
                        <div ref={messagesEndRef} />
                    </List>
                </Box>
                <Divider />
                <Box sx={{ p: 2, display: 'flex', gap: 1, bgcolor: 'white' }}>
                    <TextField
                        fullWidth
                        multiline
                        maxRows={4}
                        placeholder="Type your message here..."
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyPress}
                        disabled={!connected || !sessionReady || !turnTypes.includes(mode)}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton 
                                        color="primary" 
                                        onClick={handleSend} 
                                        disabled={!connected || !sessionReady || !turnTypes.includes(mode) || !input.trim()}
                                        aria-label="Send message"
                                    >
                                        <SendIcon />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        }}
                    />
                </Box>
            </Paper>
        </Box>
    );
}
