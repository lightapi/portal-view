export type RecordedChatTurn = { clientMessageId: string; turnId?: string };

export function recordedChatTurns(key: string): RecordedChatTurn[] {
    const value: unknown = JSON.parse(sessionStorage.getItem(key + ':turns') || '[]');
    if (!Array.isArray(value) || value.some(turn => !turn || typeof turn.clientMessageId !== 'string')) {
        throw new Error('Stored turn identifiers are invalid. Review this session before submitting another turn.');
    }
    return value;
}

export function rememberChatTurn(key: string, turn: RecordedChatTurn): void {
    const turns = recordedChatTurns(key);
    const previous = turns.find(record => record.clientMessageId === turn.clientMessageId);
    if (previous) Object.assign(previous, turn);
    else turns.push(turn);
    // No credentials, prompts, or automatic retransmission payloads are persisted.
    sessionStorage.setItem(key + ':turns', JSON.stringify(turns));
}
