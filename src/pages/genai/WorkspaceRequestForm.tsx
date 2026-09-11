import { Alert, Box, MenuItem, TextField } from '@mui/material';

export type WorkspaceChoice = { workspaceId: string; membershipRevision: string; intents: string[] };
export type WorkspaceInput = { workspaceId: string; intent: string; taskKind: string; taskId: string };
export const emptyWorkspaceInput: WorkspaceInput = { workspaceId: '', intent: 'inspect', taskKind: 'new', taskId: '' };
export function workspacePayload(choices: WorkspaceChoice[], input: WorkspaceInput, id: string, text: string) {
    const choice = choices.find(c => c.workspaceId === input.workspaceId);
    if (!choice || !choice.intents.includes(input.intent)) throw new Error('Select an available workspace and task intent.');
    if (input.taskKind === 'existing' && !/^[A-Za-z0-9][A-Za-z0-9_-]{0,99}$/.test(input.taskId)) throw new Error('Enter a valid existing task ID.');
    return { schemaVersion: 1, requestId: id, workspaceId: choice.workspaceId, expectedMembershipRevision: choice.membershipRevision,
        task: input.taskKind === 'existing' ? { kind: 'existing', taskId: input.taskId } : { kind: 'new', description: Array.from(text.trim()).slice(0,64).join('') },
        intent: input.intent, expectedCheckpointDigest: null, instruction: text };
}
export default function WorkspaceRequestForm({ choices, value, onChange }: { choices: WorkspaceChoice[]; value: WorkspaceInput; onChange: (value: WorkspaceInput) => void }) {
    const choice = choices.find(c => c.workspaceId === value.workspaceId);
    return <Box sx={{ mb: 2, display: 'flex', gap: 2, flexWrap: 'wrap' }}>
        <TextField select label="Workspace" value={value.workspaceId} onChange={e => {
            const selected = choices.find(c => c.workspaceId === e.target.value);
            onChange({ ...emptyWorkspaceInput, workspaceId: e.target.value, intent: selected?.intents[0] || '' });
        }} sx={{ minWidth: 200 }}>{choices.map(c => <MenuItem key={c.workspaceId} value={c.workspaceId}>{c.workspaceId}</MenuItem>)}</TextField>
        <TextField select label="Task intent" value={value.intent} onChange={e => onChange({ ...value, intent: e.target.value })} sx={{ minWidth: 180 }}>
            {(choice?.intents || []).map(intent => <MenuItem key={intent} value={intent}>{intent === 'inspect' ? 'Understand code' : 'Implement changes'}</MenuItem>)}
        </TextField>
        <TextField select label="Task" value={value.taskKind} onChange={e => onChange({ ...value, taskKind: e.target.value })} sx={{ minWidth: 180 }}>
            <MenuItem value="new">New task</MenuItem><MenuItem value="existing">Existing task</MenuItem>
        </TextField>
        {value.taskKind === 'existing' && <TextField label="Existing task ID" value={value.taskId} onChange={e => onChange({ ...value, taskId: e.target.value })} fullWidth />}
        <Alert severity="info" sx={{ width: '100%' }}>The task includes every repository in this workspace. You can read and edit files; running tests and publishing to GitHub are not available from Chat yet.</Alert>
    </Box>;
}
