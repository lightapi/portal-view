import { describe, expect, it } from 'vitest';
import { emptyWorkspaceInput, workspacePayload } from './WorkspaceRequestForm';
const choices = [{workspaceId:'shared',membershipRevision:'sha256:'+'a'.repeat(64),runnerId:'runner',intents:['inspect','implement','review']}];
describe('workspace conversation contract', () => {
  it('creates an explicit conversation and allows native model selection', () => {
    const request = workspacePayload(choices,{...emptyWorkspaceInput,workspaceId:'shared',nativeModel:'sonnet'},'job','read');
    expect(request.thread?.mode).toBe('new');
    expect(request.thread?.runnerId).toBe('runner');
    expect(request.nativeModel).toBe('sonnet');
  });
  it('requires the exact workspace checkpoint for review', () => {
    const input={...emptyWorkspaceInput,workspaceId:'shared',intent:'review',taskKind:'existing',taskId:'task'};
    expect(()=>workspacePayload(choices,input,'job','review')).toThrow('exact checkpoint');
    expect(workspacePayload(choices,{...input,checkpointDigest:'sha256:'+'b'.repeat(64)},'job','review').expectedCheckpointDigest).toBe('sha256:'+'b'.repeat(64));
  });
  it('keeps native conversation checkpoints distinct from workspace digests', () => {
    const request=workspacePayload(choices,{...emptyWorkspaceInput,workspaceId:'shared',taskKind:'existing',taskId:'task',sessionMode:'resume',sessionRef:'session',sessionCheckpoint:'checkpoint',checkpointDigest:'sha256:'+'c'.repeat(64)},'job','continue');
    expect(request.thread?.expectedCheckpoint).toBe('checkpoint');
    expect(request.expectedCheckpointDigest).toBe('sha256:'+'c'.repeat(64));
  });
});
