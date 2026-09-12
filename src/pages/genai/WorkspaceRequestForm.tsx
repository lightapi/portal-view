import { clientMessageId } from './codingRequest';
import { Alert, Box, MenuItem, TextField, FormControlLabel, Checkbox } from '@mui/material';

export type WorkspaceChoice = { workspaceId: string; membershipRevision: string; runnerId?: string; intents: string[] };
export type WorkspaceInput = { workspaceId: string; intent: string; taskKind: string; taskId: string; checkpointDigest?: string; sessionRef?: string; sessionCheckpoint?: string; sessionMode?: string; closeAfterTurn?: boolean; nativeModel?: string };
export const emptyWorkspaceInput: WorkspaceInput = { workspaceId: '', intent: 'inspect', taskKind: 'new', taskId: '', checkpointDigest: '', sessionRef: '', sessionCheckpoint: '', sessionMode: 'new', closeAfterTurn: false, nativeModel: '' };
export function workspacePayload(choices: WorkspaceChoice[], input: WorkspaceInput, id: string, text: string) {
    const choice = choices.find(c => c.workspaceId === input.workspaceId);
    if (!choice || !choice.intents.includes(input.intent)) throw new Error('Select an available workspace and task intent.');
    if (input.taskKind === 'existing' && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(input.taskId)) throw new Error('Enter a valid existing task ID.');
    if (input.intent === 'review' && (input.taskKind !== 'existing' || !/^sha256:[0-9a-f]{64}$/.test(input.checkpointDigest || ''))) throw new Error('Review requires an existing task and its exact checkpoint digest.');
    const sessionMode = input.sessionMode || 'new';
    if (sessionMode !== 'new' && (input.taskKind !== 'existing' || !input.sessionRef || !input.sessionCheckpoint)) throw new Error('Resume or close requires an existing task, conversation ID, and conversation checkpoint.');
    return { schemaVersion: 1, requestId: id, workspaceId: choice.workspaceId, expectedMembershipRevision: choice.membershipRevision,
        task: input.taskKind === 'existing' ? { kind: 'existing', taskId: input.taskId } : { kind: 'new', description: Array.from(text.trim()).slice(0,64).join('') },
        intent: input.intent, expectedCheckpointDigest: input.checkpointDigest || null, instruction: text,
        ...(input.nativeModel ? {nativeModel: input.nativeModel} : {}),
        ...(choice.runnerId ? {thread: {runnerId: choice.runnerId, sessionRef: sessionMode === 'new' ? clientMessageId() : input.sessionRef,
            stageId: input.intent, mode: sessionMode, ...(sessionMode !== 'new' ? {expectedCheckpoint: input.sessionCheckpoint} : {}), closeAfterTurn: !!input.closeAfterTurn}} : {}) };
}
export default function WorkspaceRequestForm({ choices, value, onChange }: { choices: WorkspaceChoice[]; value: WorkspaceInput; onChange: (value: WorkspaceInput) => void }) {
    const choice = choices.find(c => c.workspaceId === value.workspaceId);
    return <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField select label="Workspace" value={value.workspaceId} onChange={e => {
            const selected = choices.find(c => c.workspaceId === e.target.value);
            onChange({ ...emptyWorkspaceInput, workspaceId: e.target.value, intent: selected?.intents[0] || '' });
        }} sx={{ minWidth: 200 }}>{choices.map(c => <MenuItem key={c.workspaceId} value={c.workspaceId}>{c.workspaceId}</MenuItem>)}</TextField>
        <TextField select label="Task intent" value={value.intent} onChange={e => onChange({ ...value, intent: e.target.value, sessionMode: 'new', sessionRef: '', sessionCheckpoint: '' })} sx={{ minWidth: 180 }}>
            {(choice?.intents || []).map(intent => <MenuItem key={intent} value={intent}>{intent === 'inspect' ? 'Understand code' : intent === 'review' ? 'Review changes' : 'Implement changes'}</MenuItem>)}
        </TextField>
        <TextField select label="Task" value={value.taskKind} onChange={e => onChange({ ...value, taskKind: e.target.value, ...(e.target.value === 'new' ? {taskId: '', checkpointDigest: '', sessionMode: 'new', sessionRef: '', sessionCheckpoint: ''} : {}) })} sx={{ minWidth: 180 }}>
            <MenuItem value="new">New task</MenuItem><MenuItem value="existing">Existing task</MenuItem>
        </TextField>
        {value.taskKind === 'existing' && <TextField label="Existing task ID" value={value.taskId} onChange={e => onChange({ ...value, taskId: e.target.value })} fullWidth />}
        {value.taskKind === 'existing' && <TextField label="Workspace checkpoint digest" value={value.checkpointDigest || ''} onChange={e => onChange({...value, checkpointDigest: e.target.value})} fullWidth />}
        {choice?.runnerId && <>
            <TextField select label="Conversation" value={value.sessionMode || 'new'} onChange={e => onChange({...value, sessionMode:e.target.value})}>
                <MenuItem value="new">Start new</MenuItem><MenuItem value="resume">Resume</MenuItem><MenuItem value="close">Close</MenuItem>
            </TextField>
            {(value.sessionMode === 'resume' || value.sessionMode === 'close') && <>
                <TextField label="Conversation ID" value={value.sessionRef || ''} onChange={e=>onChange({...value,sessionRef:e.target.value})} />
                <TextField label="Conversation checkpoint" value={value.sessionCheckpoint || ''} onChange={e=>onChange({...value,sessionCheckpoint:e.target.value})} />
            </>}
            <FormControlLabel control={<Checkbox checked={!!value.closeAfterTurn} onChange={e=>onChange({...value,closeAfterTurn:e.target.checked})} />} label="Close after this turn" />
            <TextField label="Native model (optional)" value={value.nativeModel || ''} onChange={e=>onChange({...value,nativeModel:e.target.value})} />
        </>}
        <Alert severity="info" sx={{ width: '100%' }}>The task includes every repository in this workspace. You can read and edit files; running tests and publishing to GitHub are not available from Chat yet.</Alert>
    </Box>;
}
