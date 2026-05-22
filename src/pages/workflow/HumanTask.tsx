import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
    Alert,
    Box,
    Button,
    Checkbox,
    Chip,
    CircularProgress,
    Divider,
    FormControl,
    FormControlLabel,
    FormGroup,
    FormLabel,
    Paper,
    Radio,
    RadioGroup,
    Stack,
    TextField,
    Typography,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import LockIcon from '@mui/icons-material/Lock';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RefreshIcon from '@mui/icons-material/Refresh';
import SendIcon from '@mui/icons-material/Send';
import { SchemaForm, utils } from 'react-schema-form';
import { useUserState } from '../../contexts/UserContext';
import fetchClient from '../../utils/fetchClient';
import { buildWorkflowTaskContext, WorkflowTaskLayout } from './workflowTaskUtils';

type AskOption = {
    label?: string;
    value: string;
    description?: string;
};

type AskDefinition = {
    prompt?: string;
    mode?: 'approval' | 'confirm' | 'choice' | 'multiChoice' | 'text' | 'object' | string;
    options?: AskOption[];
    required?: boolean;
    allowComment?: boolean;
    commentRequired?: boolean;
    schema?: Record<string, unknown> | string;
    form?: Array<string | Record<string, unknown>>;
    default?: Record<string, unknown>;
};

type HumanTaskDetail = {
    hostId: string;
    taskAsstId: string;
    taskId: string;
    processId?: string;
    wfInstanceId?: string;
    wfTaskId?: string;
    assignedTs?: string;
    assigneeId?: string;
    assignmentStatusCode?: string;
    claimedBy?: string;
    claimedTs?: string;
    claimExpiresTs?: string;
    deadlineTs?: string;
    categoryCode?: string;
    reasonCode?: string;
    taskStatusCode?: string;
    taskType?: string;
    active?: boolean;
    ask?: AskDefinition;
    contextSummary?: Record<string, unknown>;
    context?: Record<string, unknown>;
    workflow?: {
        namespace?: string;
        name?: string;
        version?: string;
    };
};

interface UserState {
    host?: string | null;
    userId?: string | null;
    roles?: string | null;
}

const defaultApprovalOptions: AskOption[] = [
    { label: 'Approve', value: 'APPROVED' },
    { label: 'Reject', value: 'REJECTED' },
];

function formatDate(value?: string) {
    return value ? new Date(value).toLocaleString() : '';
}

function jsonBlock(value?: Record<string, unknown>) {
    if (!value || !Object.keys(value).length) return '';
    return JSON.stringify(value, null, 2);
}

function optionLabel(option: AskOption) {
    return option.label || option.value;
}

function answerOptions(ask?: AskDefinition) {
    if (ask?.mode === 'approval' && (!ask.options || !ask.options.length)) {
        return defaultApprovalOptions;
    }
    return ask?.options || [];
}

function normalizeObjectSchema(schema?: Record<string, unknown> | string) {
    if (!schema) return null;
    if (typeof schema === 'string') {
        try {
            const parsed = JSON.parse(schema);
            return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
        } catch {
            return null;
        }
    }
    return schema;
}

function objectFormItems(ask?: AskDefinition, schema?: Record<string, unknown> | null) {
    if (Array.isArray(ask?.form)) return ask.form;
    const properties = schema?.properties;
    if (properties && typeof properties === 'object' && !Array.isArray(properties)) {
        return Object.keys(properties as Record<string, unknown>);
    }
    return [];
}

function modelFromSchemaDefaults(schema?: Record<string, unknown> | null, explicitDefault?: Record<string, unknown>) {
    if (explicitDefault && typeof explicitDefault === 'object' && !Array.isArray(explicitDefault)) {
        return { ...explicitDefault };
    }
    const model: Record<string, unknown> = {};
    const properties = schema?.properties;
    if (!properties || typeof properties !== 'object' || Array.isArray(properties)) return model;
    Object.entries(properties as Record<string, any>).forEach(([key, property]) => {
        if (property && typeof property === 'object' && Object.prototype.hasOwnProperty.call(property, 'default')) {
            model[key] = property.default;
        }
    });
    return model;
}

function modeForAsk(ask?: AskDefinition) {
    if (ask?.mode) return ask.mode;
    return ask?.schema ? 'object' : 'text';
}

function roleTokens(roles?: string | null) {
    return new Set((roles || '').split(/[\s,]+/).filter(Boolean));
}

function hasOverridePermission(roles?: string | null) {
    const tokens = roleTokens(roles);
    return tokens.has('admin') || tokens.has('workflow.task.override');
}

export default function HumanTask() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host, userId, roles } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const taskAsstId = searchParams.get('taskAsstId') || '';
    const taskContext = useMemo(() => buildWorkflowTaskContext(host || undefined, searchParams), [host, searchParams]);
    const source = (location.state as { source?: string } | null)?.source || '/app/workflow/HumanTasks';

    const [task, setTask] = useState<HumanTaskDetail | null>(null);
    const [value, setValue] = useState<string>('');
    const [multiValue, setMultiValue] = useState<string[]>([]);
    const [objectValue, setObjectValue] = useState<Record<string, unknown>>({});
    const [objectValidationResult, setObjectValidationResult] = useState<any>(null);
    const [showObjectErrors, setShowObjectErrors] = useState(false);
    const [comment, setComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isMutatingClaim, setIsMutatingClaim] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [completed, setCompleted] = useState(false);

    const loadTask = useCallback(async () => {
        if (!host) {
            setError('Host is missing. Please select a host and open the task again.');
            return;
        }
        if (!taskAsstId) {
            setError('Task assignment id is missing. Please open the task from the Worklist, Human Tasks, or Task Asst page.');
            return;
        }
        setIsLoading(true);
        setError(null);
        const cmd = {
            host: 'lightapi.net',
            service: 'workflow',
            action: 'getHumanTask',
            version: '0.1.0',
            data: { hostId: host, taskAsstId },
        };
        try {
            const data = await fetchClient('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)));
            setTask(data);
            const options = answerOptions(data.ask);
            const nextMode = modeForAsk(data.ask);
            if ((nextMode === 'choice' || nextMode === 'confirm') && options.length === 1) {
                setValue(options[0].value);
            }
            if (nextMode === 'object') {
                const schema = normalizeObjectSchema(data.ask?.schema);
                setObjectValue(modelFromSchemaDefaults(schema, data.ask?.default));
                setShowObjectErrors(false);
                setObjectValidationResult(null);
            }
        } catch (e: any) {
            setError(e?.description || e?.message || 'Unable to load task.');
        } finally {
            setIsLoading(false);
        }
    }, [host, taskAsstId]);

    useEffect(() => {
        loadTask();
    }, [loadTask]);

    const ask = task?.ask;
    const mode = modeForAsk(ask);
    const options = answerOptions(ask);
    const objectSchema = useMemo(() => normalizeObjectSchema(ask?.schema), [ask?.schema]);
    const objectForm = useMemo(() => objectFormItems(ask, objectSchema), [ask, objectSchema]);
    const canOverride = hasOverridePermission(roles);
    const isClaimed = task?.assignmentStatusCode === 'CLAIMED';
    const isClaimedByCurrentUser = Boolean(isClaimed && task?.claimedBy && userId && task.claimedBy === userId);
    const canSubmit = Boolean(task?.active) && task?.taskStatusCode === 'W' && (
        task?.assignmentStatusCode === 'ASSIGNED' ||
        isClaimedByCurrentUser ||
        (canOverride && isClaimed)
    );
    const canClaim = Boolean(task?.active) && task?.taskStatusCode === 'W' && task?.assignmentStatusCode === 'ASSIGNED';
    const canRelease = Boolean(task?.active) && task?.taskStatusCode === 'W' && isClaimed && (isClaimedByCurrentUser || canOverride);
    const allowComment = ask?.allowComment ?? (mode === 'approval' || mode === 'confirm');
    const commentMissing = allowComment && ask?.commentRequired && !comment.trim();

    const mutateClaim = useCallback(async (action: 'claimHumanTask' | 'releaseHumanTask') => {
        if (!host || !task) return;
        setIsMutatingClaim(true);
        setError(null);
        const cmd = {
            host: 'lightapi.net',
            service: 'workflow',
            action,
            version: '0.1.0',
            data: {
                hostId: host,
                taskAsstId: task.taskAsstId,
                ...(action === 'claimHumanTask' ? { claimMinutes: 30 } : {}),
            },
        };
        try {
            await fetchClient('/portal/command', { method: 'POST', body: cmd });
            await loadTask();
        } catch (e: any) {
            setError(e?.description || e?.message || 'Unable to update task claim.');
            await loadTask();
        } finally {
            setIsMutatingClaim(false);
        }
    }, [host, loadTask, task]);

    const submit = useCallback(async (submittedValue: unknown) => {
        if (!host || !task) return;
        if (commentMissing) {
            setError('Comment is required.');
            return;
        }
        setIsSubmitting(true);
        setError(null);
        const submittedAt = new Date().toISOString();
        const cmd = {
            host: 'lightapi.net',
            service: 'workflow',
            action: 'completeTask',
            version: '0.1.0',
            data: {
                hostId: host,
                taskId: task.taskId,
                taskAsstId: task.taskAsstId,
                statusCode: 'C',
                completedTs: submittedAt,
                response: {
                    value: submittedValue,
                    comment: comment.trim() || undefined,
                    submittedAt,
                },
            },
        };
        try {
            await fetchClient('/portal/command', { method: 'POST', body: cmd });
            setCompleted(true);
        } catch (e: any) {
            setError(e?.description || e?.message || 'Unable to submit task.');
            await loadTask();
        } finally {
            setIsSubmitting(false);
        }
    }, [comment, commentMissing, host, loadTask, task]);

    const validateObjectInput = useCallback(() => {
        if (mode !== 'object') return true;
        if (!objectSchema) {
            setError('Object input requires a valid ask.schema definition.');
            return false;
        }
        const result = utils.validateBySchema(objectSchema, objectValue);
        setObjectValidationResult(result);
        setShowObjectErrors(!result.valid);
        if (!result.valid) {
            setError('Please correct the highlighted fields before submitting.');
        }
        return result.valid;
    }, [mode, objectSchema, objectValue]);

    const submitCurrentValue = useCallback(() => {
        if (mode === 'object') {
            if (!validateObjectInput()) return;
            submit(objectValue);
            return;
        }
        submit(mode === 'multiChoice' ? multiValue : value);
    }, [mode, multiValue, objectValue, submit, validateObjectInput, value]);

    const valueMissing = ask?.required !== false && (
        mode === 'multiChoice'
            ? !multiValue.length
            : mode === 'object'
                ? false
                : !value.trim()
    );
    const submitDisabled = isSubmitting || isMutatingClaim || !canSubmit || valueMissing || Boolean(commentMissing);
    const approvalSubmitDisabled = isSubmitting || isMutatingClaim || !canSubmit || Boolean(commentMissing);

    const onObjectModelChange = (key: string | string[], val: unknown, type?: string) => {
        utils.selectOrSet(key, objectValue, val, type);
        setObjectValue({ ...objectValue });
        if (showObjectErrors && objectSchema) {
            setObjectValidationResult(utils.validateBySchema(objectSchema, objectValue));
        }
    };

    const renderInput = () => {
        if (!ask) {
            return <Alert severity="error">Ask metadata is missing.</Alert>;
        }
        if (mode === 'approval') {
            return (
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                    {options.map((option) => (
                        <Button
                            key={option.value}
                            variant="contained"
                            color={option.value === 'REJECTED' ? 'error' : 'primary'}
                            startIcon={option.value === 'REJECTED' ? <CancelIcon /> : <CheckCircleIcon />}
                            disabled={approvalSubmitDisabled}
                            onClick={() => submit(option.value)}
                        >
                            {optionLabel(option)}
                        </Button>
                    ))}
                </Stack>
            );
        }
        if (mode === 'choice') {
            return (
                <TextField
                    select
                    fullWidth
                    label="Decision"
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    SelectProps={{ native: true }}
                    disabled={!canSubmit}
                >
                    <option value="" />
                    {options.map((option) => (
                        <option key={option.value} value={option.value}>
                            {optionLabel(option)}
                        </option>
                    ))}
                </TextField>
            );
        }
        if (mode === 'confirm') {
            const confirmOptions = options.length ? options : [
                { label: 'Yes', value: 'YES' },
                { label: 'No', value: 'NO' },
            ];
            return (
                <FormControl disabled={!canSubmit}>
                    <FormLabel>Confirm</FormLabel>
                    <RadioGroup row value={value} onChange={(event) => setValue(event.target.value)}>
                        {confirmOptions.map((option) => (
                            <FormControlLabel
                                key={option.value}
                                value={option.value}
                                control={<Radio />}
                                label={optionLabel(option)}
                            />
                        ))}
                    </RadioGroup>
                </FormControl>
            );
        }
        if (mode === 'multiChoice') {
            return (
                <FormControl disabled={!canSubmit}>
                    <FormLabel>Selections</FormLabel>
                    <FormGroup>
                        {options.map((option) => (
                            <FormControlLabel
                                key={option.value}
                                control={
                                    <Checkbox
                                        checked={multiValue.includes(option.value)}
                                        onChange={(event) => {
                                            setMultiValue((current) => event.target.checked
                                                ? [...current, option.value]
                                                : current.filter((item) => item !== option.value));
                                        }}
                                    />
                                }
                                label={optionLabel(option)}
                            />
                        ))}
                    </FormGroup>
                </FormControl>
            );
        }
        if (mode === 'object') {
            if (!objectSchema) {
                return <Alert severity="error">Object input requires a valid ask.schema definition.</Alert>;
            }
            return (
                <Stack spacing={2}>
                    <SchemaForm
                        schema={objectSchema}
                        form={objectForm}
                        model={objectValue}
                        showErrors={showObjectErrors}
                        onModelChange={onObjectModelChange}
                    />
                    {showObjectErrors && objectValidationResult ? (
                        <Alert severity="error">
                            {objectValidationResult?.errors?.[0]?.message || objectValidationResult?.error || 'The response does not match the required schema.'}
                        </Alert>
                    ) : null}
                </Stack>
            );
        }
        return (
            <TextField
                fullWidth
                minRows={5}
                multiline
                label="Response"
                value={value}
                onChange={(event) => setValue(event.target.value)}
                disabled={!canSubmit}
            />
        );
    };

    return (
        <WorkflowTaskLayout context={taskContext}>
            <Stack spacing={2}>
                <Box>
                    <Button startIcon={<ArrowBackIcon />} onClick={() => navigate(source)}>
                        Back
                    </Button>
                </Box>

                {isLoading ? (
                    <Box display="flex" justifyContent="center" py={6}>
                        <CircularProgress />
                    </Box>
                ) : null}

                {error ? <Alert severity="error">{error}</Alert> : null}
                {completed ? (
                    <Alert
                        severity="success"
                        action={<Button color="inherit" size="small" onClick={() => navigate(source)}>Worklist</Button>}
                    >
                        Task completed.
                    </Alert>
                ) : null}

                {task ? (
                    <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 320px' }, gap: 2 }}>
                        <Stack spacing={2}>
                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Stack spacing={1}>
                                    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                                        <Typography variant="h5">
                                            {task.workflow?.name || task.wfTaskId || 'Human Task'}
                                        </Typography>
                                        <Chip size="small" label={task.assignmentStatusCode || ''} />
                                        <Chip size="small" label={`Task ${task.taskStatusCode || ''}`} variant="outlined" />
                                    </Stack>
                                    <Typography variant="body2" color="text.secondary">
                                        {task.workflow?.namespace ? `${task.workflow.namespace} / ` : ''}{task.workflow?.version || ''}
                                    </Typography>
                                    {task.deadlineTs ? (
                                        <Typography variant="body2" color="text.secondary">
                                            Due {formatDate(task.deadlineTs)}
                                        </Typography>
                                    ) : null}
                                    {isClaimed ? (
                                        <Alert severity={isClaimedByCurrentUser || canOverride ? 'info' : 'warning'}>
                                            Claimed by {task.claimedBy || 'another user'}{task.claimExpiresTs ? ` until ${formatDate(task.claimExpiresTs)}` : ''}.
                                        </Alert>
                                    ) : null}
                                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
                                        <Button
                                            variant="outlined"
                                            startIcon={<LockIcon />}
                                            disabled={!canClaim || isMutatingClaim}
                                            onClick={() => mutateClaim('claimHumanTask')}
                                        >
                                            Claim
                                        </Button>
                                        <Button
                                            variant="outlined"
                                            startIcon={<LockOpenIcon />}
                                            disabled={!canRelease || isMutatingClaim}
                                            onClick={() => mutateClaim('releaseHumanTask')}
                                        >
                                            Release
                                        </Button>
                                        <Button
                                            startIcon={<RefreshIcon />}
                                            disabled={isLoading || isMutatingClaim}
                                            onClick={loadTask}
                                        >
                                            Refresh
                                        </Button>
                                    </Stack>
                                </Stack>
                            </Paper>

                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Stack spacing={2}>
                                    <Typography variant="h6">{ask?.prompt || task.wfTaskId}</Typography>
                                    {renderInput()}
                                    {allowComment ? (
                                        <TextField
                                            fullWidth
                                            multiline
                                            minRows={3}
                                            label="Comment"
                                            value={comment}
                                            onChange={(event) => setComment(event.target.value)}
                                            disabled={!canSubmit}
                                        />
                                    ) : null}
                                    {mode !== 'approval' ? (
                                        <Box>
                                            <Button
                                                variant="contained"
                                                startIcon={<SendIcon />}
                                                disabled={submitDisabled}
                                                onClick={submitCurrentValue}
                                            >
                                                Submit
                                            </Button>
                                        </Box>
                                    ) : null}
                                </Stack>
                            </Paper>

                            <Paper variant="outlined" sx={{ p: 2 }}>
                                <Typography variant="h6" gutterBottom>Context</Typography>
                                <TextField
                                    fullWidth
                                    multiline
                                    minRows={6}
                                    value={jsonBlock(task.contextSummary)}
                                    InputProps={{ readOnly: true }}
                                />
                            </Paper>
                        </Stack>

                        <Paper variant="outlined" sx={{ p: 2, alignSelf: 'start' }}>
                            <Stack spacing={1}>
                                <Typography variant="h6">Assignment</Typography>
                                <Divider />
                                <Typography variant="body2">Assignee: {task.assigneeId || ''}</Typography>
                                <Typography variant="body2">Category: {task.categoryCode || ''}</Typography>
                                <Typography variant="body2">Reason: {task.reasonCode || ''}</Typography>
                                <Typography variant="body2">Assigned: {formatDate(task.assignedTs)}</Typography>
                                <Typography variant="body2">Claimed By: {task.claimedBy || ''}</Typography>
                                <Typography variant="body2">Claimed: {formatDate(task.claimedTs)}</Typography>
                                <Typography variant="body2">Claim Expires: {formatDate(task.claimExpiresTs)}</Typography>
                                <Typography variant="body2">Task: {task.wfTaskId || task.taskId}</Typography>
                                <Typography variant="body2">Instance: {task.wfInstanceId || ''}</Typography>
                            </Stack>
                        </Paper>
                    </Box>
                ) : null}
            </Stack>
        </WorkflowTaskLayout>
    );
}
