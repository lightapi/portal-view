import type { ReplayFailure, ReplayItem } from './types';
export const terminalReplayStatuses: Set<string>;
export function selectedAndAdded(items?: ReplayItem[]): { selected: ReplayItem[]; added: ReplayItem[] };
export function canApprove(status: string, stale: boolean, requester?: string | null, currentUser?: string | null): boolean;
export function canExecute(status: string, stale: boolean, validationMode: string, approvedBy: string | null | undefined,
  planHash: string, confirmedHash: string): boolean;
export function replayProgress(items?: ReplayItem[]): { complete: number; total: number; percent: number };
export function isNotificationMatch(failure?: ReplayFailure, transactionIds?: string[]): boolean;
export function canReviewRepair(status: string, requester?: string | null, currentUser?: string | null): boolean;
export function canPlanRepair(status: string): boolean;
