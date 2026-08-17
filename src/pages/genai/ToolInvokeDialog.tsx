import { useEffect, useMemo, useState } from 'react';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import {
    Alert, Autocomplete, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent,
    DialogTitle, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import { apiPost } from '../../api/apiPost';
import fetchClient from '../../utils/fetchClient';
import { environmentOptions, selectEnvironmentId, type EnvironmentOption } from '../../utils/environmentOptions';
import {
    argumentValue, invocationModel, type InvokableTool, type PropertySchema,
} from './toolInvocationModel';

type InvocationResponse = {
    toolId: string;
    capabilityRef?: string;
    method: string;
    requestUri: string;
    status: number;
    durationMs: number;
    contentType?: string;
    body: unknown;
};

function initialInput(schema: PropertySchema) {
    const value = schema.default ?? schema.example;
    if (value == null) return '';
    return typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value);
}

function errorText(error: unknown) {
    if (error instanceof Error) return error.message;
    if (error && typeof error === 'object') {
        const value = error as { message?: unknown; description?: unknown };
        return String(value.description || value.message || 'Tool invocation failed.');
    }
    return String(error || 'Tool invocation failed.');
}

export default function ToolInvokeDialog({
    open, tool, onClose,
}: { open: boolean; tool: InvokableTool | null; onClose: () => void }) {
    const [environments, setEnvironments] = useState<EnvironmentOption[]>([]);
    const [environment, setEnvironment] = useState('');
    const [values, setValues] = useState<Record<string, string>>({});
    const [response, setResponse] = useState<InvocationResponse | null>(null);
    const [message, setMessage] = useState('');
    const [loadingEnvironments, setLoadingEnvironments] = useState(false);
    const [busy, setBusy] = useState(false);

    const modelResult = useMemo(() => {
        if (!tool) return { model: null, error: '' };
        try {
            return { model: invocationModel(tool), error: '' };
        } catch (error) {
            return { model: null, error: errorText(error) };
        }
    }, [tool]);
    const model = modelResult.model;

    useEffect(() => {
        if (!open || !tool || !model) return;
        setValues(Object.fromEntries(Object.entries(model.inputSchema.properties).map(
            ([name, schema]) => [name, initialInput(schema)],
        )));
        setResponse(null);
        setMessage('');
        setEnvironments([]);
        setEnvironment('');
        setLoadingEnvironments(true);
        let active = true;
        void fetchClient(`/r/data?name=environment&host=${encodeURIComponent(tool.hostId)}`)
            .then(result => {
                if (!active) return;
                const options = environmentOptions(result);
                setEnvironments(options);
                setEnvironment(selectEnvironmentId(options, 'local'));
                if (!options.length) setMessage('No environments are configured for this host.');
            })
            .catch(error => { if (active) setMessage(errorText(error)); })
            .finally(() => { if (active) setLoadingEnvironments(false); });
        return () => { active = false; };
    }, [model, open, tool]);

    const invoke = async () => {
        if (!tool || !model || !environment) return;
        setBusy(true);
        setMessage('');
        setResponse(null);
        try {
            const argumentsValue: Record<string, unknown> = {};
            for (const [name, schema] of Object.entries(model.inputSchema.properties)) {
                const value = argumentValue(name, schema, values[name] ?? '');
                if (value !== undefined) argumentsValue[name] = value;
            }
            for (const required of model.inputSchema.required) {
                if (argumentsValue[required] == null || argumentsValue[required] === '') {
                    throw new Error(`${required} is required.`);
                }
            }
            const confirmed = !model.requiresConfirmation || window.confirm(
                `${model.method} ${model.endpoint} can modify data. Invoke it for testing?`,
            );
            if (!confirmed) return;
            const result = await apiPost({
                url: '/portal/command', headers: {}, body: {
                    host: 'lightapi.net', service: 'genai', action: 'invokeTool', version: '0.1.0',
                    data: {
                        hostId: tool.hostId, toolId: tool.toolId, environment,
                        arguments: argumentsValue, confirmed: model.requiresConfirmation,
                    },
                },
            });
            if (result.error) throw result.error;
            if (!('data' in result)) throw new Error('Tool invocation returned no response.');
            setResponse(result.data as InvocationResponse);
        } catch (error) {
            setMessage(errorText(error));
        } finally {
            setBusy(false);
        }
    };

    const responseText = response ? JSON.stringify(response.body, null, 2) : '';
    const title = [tool?.apiId, tool?.apiVersion, tool?.name].filter(Boolean).join(' · ');
    return <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="md">
        <DialogTitle>Invoke API Endpoint · {title}</DialogTitle>
        <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
                {modelResult.error ? <Alert severity="error">{modelResult.error}</Alert> : null}
                {model ? <Box>
                    <Typography variant="body2"><strong>{model.method}</strong> {model.endpoint}</Typography>
                    <Typography variant="caption" color="text.secondary">{tool?.capabilityRef}</Typography>
                </Box> : null}
                <Autocomplete
                    options={environments}
                    value={environments.find(option => option.id === environment) ?? null}
                    loading={loadingEnvironments}
                    getOptionLabel={option => option.label}
                    isOptionEqualToValue={(option, value) => option.id === value.id}
                    onChange={(_event, value) => setEnvironment(value?.id ?? '')}
                    renderInput={params => <TextField {...params} label="Environment" required slotProps={{
                        input: {
                            ...params.InputProps,
                            endAdornment: <>{loadingEnvironments ? <CircularProgress size={20} /> : null}{params.InputProps.endAdornment}</>,
                        },
                    }} />}
                />
                {model ? Object.entries(model.inputSchema.properties).map(([name, schema]) => {
                    const required = model.inputSchema.required.includes(name);
                    const label = schema.title || name;
                    if (schema.enum?.length) {
                        return <TextField key={name} select label={label} required={required}
                            value={values[name] ?? ''} onChange={event => setValues(current => ({ ...current, [name]: event.target.value }))}
                            helperText={schema.description}>
                            {!required ? <MenuItem value="">None</MenuItem> : null}
                            {schema.enum.map(value => <MenuItem key={String(value)} value={String(value)}>{String(value)}</MenuItem>)}
                        </TextField>;
                    }
                    if (schema.type === 'boolean') {
                        return <TextField key={name} select label={label} required={required}
                            value={values[name] ?? ''} onChange={event => setValues(current => ({ ...current, [name]: event.target.value }))}
                            helperText={schema.description}>
                            {!required ? <MenuItem value="">None</MenuItem> : null}
                            <MenuItem value="true">True</MenuItem><MenuItem value="false">False</MenuItem>
                        </TextField>;
                    }
                    return <TextField key={name} label={label} required={required}
                        type={['integer', 'number'].includes(schema.type || '') ? 'number' : 'text'}
                        multiline={['object', 'array'].includes(schema.type || '')} minRows={schema.type === 'object' || schema.type === 'array' ? 3 : undefined}
                        value={values[name] ?? ''} onChange={event => setValues(current => ({ ...current, [name]: event.target.value }))}
                        helperText={schema.description || (schema.type ? `Type: ${schema.type}` : undefined)} />;
                }) : null}
                {model && Object.keys(model.inputSchema.properties).length === 0
                    ? <Alert severity="info">This endpoint does not require arguments.</Alert> : null}
                {message ? <Alert severity="error">{message}</Alert> : null}
                {response ? <Box>
                    <Typography variant="subtitle2">Response</Typography>
                    <Typography variant="body2" sx={{ mb: 1 }}>
                        HTTP {response.status} · {response.durationMs} ms · {response.method} {response.requestUri}
                    </Typography>
                    <TextField fullWidth multiline minRows={8} maxRows={24} value={responseText} slotProps={{ input: { readOnly: true } }} />
                </Box> : null}
            </Stack>
        </DialogContent>
        <DialogActions>
            <Button onClick={onClose} disabled={busy}>Close</Button>
            <Button variant="contained" startIcon={busy ? <CircularProgress size={18} color="inherit" /> : <PlayArrowIcon />}
                onClick={invoke} disabled={busy || !model || !environment}>Invoke</Button>
        </DialogActions>
    </Dialog>;
}
