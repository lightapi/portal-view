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
} from '@mui/material';
import SendIcon from '@mui/icons-material/Send';
import ConnectWithoutContactIcon from '@mui/icons-material/ConnectWithoutContact';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import PersonIcon from '@mui/icons-material/Person';
import SmartToyIcon from '@mui/icons-material/SmartToy';
import Cookies from 'universal-cookie';
import { useUserState } from '../../contexts/UserContext';

interface Message {
    role: 'User' | 'Assistant' | 'System';
    text: string;
    timestamp: Date;
}

export default function Chat() {
    const { email, isAuthenticated } = useUserState();
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [connected, setConnected] = useState(false);
    const [connecting, setConnecting] = useState(false);
    const [userId, setUserId] = useState(email || 'anonymous');
    const [model, setModel] = useState('qwen3:14b');
    const ws = useRef<WebSocket | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const cookies = new Cookies();

    // Ensure WebSocket connection is cleaned up when the component unmounts
    useEffect(() => {
        return () => {
            if (ws.current) {
                ws.current.close();
            }
        };
    }, []);

    useEffect(() => {
        if (email) {
            setUserId(email);
        }
    }, [email]);

    useEffect(() => {
        return () => {
            // Clean up WebSocket connection on unmount
            if (ws.current) {
                ws.current.onopen = null;
                ws.current.onmessage = null;
                ws.current.onclose = null;
                ws.current.onerror = null;
                ws.current.close();
                ws.current = null;
            }
        };
    }, []);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleConnect = () => {
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

        setConnecting(true);

        // The accessToken is in cookies and automatically sent with the WebSocket upgrade request.
        const csrfToken = cookies.get('csrf');

        // Construct URL using new URL() so IPv6 hosts are correctly bracketed.
        const url = new URL('/chat', window.location.href);
        url.protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        url.searchParams.set('userId', userId);
        url.searchParams.set('model', model);

        // Use Sec-WebSocket-Protocol header for CSRF to avoid URL logging
        const protocols = csrfToken ? [`csrf.${csrfToken}`] : [];
        const socket = new WebSocket(url.toString(), protocols);
        ws.current = socket;

        socket.onopen = () => {
            setConnecting(false);
            setConnected(true);
            addMessage('System', 'Connected to chat server.');
        };

        socket.onmessage = (event: MessageEvent) => {
            const data = event.data;
            try {
                // Check if it's a JSON message (like session info)
                const json = JSON.parse(data);
                if (json.type === 'session') {
                    // Store session id if needed, or just log to system chat
                    sessionStorage.setItem('sessionId', json.sessionId);
                    addMessage('System', 'Session initialized: ' + json.sessionId);
                    return;
                }
            } catch (e) {
                // Not JSON, treat as text chunk
            }

            // Correctly handle assistant message streaming:
            // If the last message was from the assistant, append the chunk.
            // Otherwise, create a new assistant message.
            setMessages((prev) => {
                if (prev.length > 0 && prev[prev.length - 1].role === 'Assistant') {
                    const updatedMessages = [...prev];
                    const lastMsg = updatedMessages[updatedMessages.length - 1];
                    updatedMessages[updatedMessages.length - 1] = {
                        ...lastMsg,
                        text: lastMsg.text + data,
                    };
                    return updatedMessages;
                }
                return [...prev, { role: 'Assistant', text: data, timestamp: new Date() }];
            });
        };

        socket.onclose = () => {
            setConnecting(false);
            setConnected(false);
            addMessage('System', 'Disconnected from chat server.');
        };

        socket.onerror = (error: Event) => {
            setConnecting(false);
            addMessage('System', 'Error: Connection failed.');
            console.error("WebSocket error:", error);
        };
    };

    const handleDisconnect = () => {
        if (ws.current) {
            ws.current.close();
        }
    };

    const handleSend = () => {
        if (input.trim() && ws.current && connected) {
            addMessage('User', input);
            ws.current.send(input);
            setInput('');
        }
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
        <Box sx={{ p: 3, maxWidth: 1000, margin: '0 auto', height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
            <Paper elevation={3} sx={{ p: 2, mb: 2, display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
                <Typography variant="h5" sx={{ flexGrow: 1, fontWeight: 'bold', color: 'primary.main' }}>
                    GenAI Chat
                </Typography>
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip 
                        icon={<PersonIcon />} 
                        label={isAuthenticated ? `Logged in as: ${email}` : 'Anonymous User'} 
                        color={isAuthenticated ? "primary" : "default"}
                        variant="outlined"
                    />
                    <TextField
                        size="small"
                        label="User ID"
                        value={userId}
                        onChange={(e) => setUserId(e.target.value)}
                        disabled={connected || connecting}
                        sx={{ width: 200 }}
                    />
                    <TextField
                        size="small"
                        label="Model"
                        value={model}
                        onChange={(e) => setModel(e.target.value)}
                        disabled={connected || connecting}
                        sx={{ width: 150 }}
                    />
                    {!connected ? (
                        <Button
                            variant="contained"
                            color="primary"
                            startIcon={connecting ? <CircularProgress size={16} color="inherit" /> : <ConnectWithoutContactIcon />}
                            onClick={handleConnect}
                            disabled={connecting}
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

            <Paper elevation={3} sx={{ flexGrow: 1, mb: 2, overflow: 'hidden', display: 'flex', flexDirection: 'column', bgcolor: '#f5f7f9' }}>
                <Box sx={{ flexGrow: 1, overflowY: 'auto', p: 2 }}>
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
                        disabled={!connected}
                        InputProps={{
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton 
                                        color="primary" 
                                        onClick={handleSend} 
                                        disabled={!connected || !input.trim()}
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
