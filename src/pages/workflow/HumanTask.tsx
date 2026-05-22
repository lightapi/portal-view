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
import SendIcon from '@mui/icons-material/Send';
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
    mode?: 'approval' | 'confirm' | 'choice' | 'multiChoice' | 'text' | string;
    options?: AskOption[];
    required?: boolean;
    allowComment?: boolean;
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
    host?: string;
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

export default function HumanTask() {
    const navigate = useNavigate();
    const location = useLocation();
    const { host } = useUserState() as UserState;
    const searchParams = useMemo(() => new URLSearchParams(location.search), [location.search]);
    const taskAsstId = searchParams.get('taskAsstId') || '';
    const taskContext = useMemo(() => buildWorkflowTaskContext(host, searchParams), [host, searchParams]);
    const source = (location.state as { source?: string } | null)?.source || '/app/workflow/TaskAsst';

    const [task, setTask] = useState<HumanTaskDetail | null>(null);
    const [value, setValue] = useState<string>('');
    const [multiValue, setMultiValue] = useState<string[]>([]);
    const [comment, setComment] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [completed, setCompleted] = useState(false);

    const loadTask = useCallback(async () => {
        if (!host || !taskAsstId) return;
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
            if ((data.ask?.mode === 'choice' || data.ask?.mode === 'confirm') && options.length === 1) {
                setValue(options[0].value);
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
    const mode = ask?.mode || 'text';
    const options = answerOptions(ask);
    const canSubmit = Boolean(task?.active) && task?.assignmentStatusCode === 'ASSIGNED' && task?.taskStatusCode === 'W';
    const allowComment = ask?.allowComment ?? (mode === 'approval' || mode === 'confirm');

    const submit = useCallback(async (submittedValue: string | string[]) => {
        if (!host || !task) return;
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
    }, [comment, host, loadTask, task]);

    const selectedValue = mode === 'multiChoice' ? multiValue : value;
    const submitDisabled = isSubmitting || !canSubmit || (ask?.required !== false && (mode === 'multiChoice' ? !multiValue.length : !value.trim()));

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
                            disabled={isSubmitting || !canSubmit}
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
                                                onClick={() => submit(selectedValue)}
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
