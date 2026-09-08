import Cookies from 'universal-cookie';

/** Trigger the existing gateway refresh-cookie flow; never read or store bearer tokens. */
export async function renewChatAuthentication(signal?: AbortSignal): Promise<void> {
    const cookies = new Cookies();
    const owner = cookies.get('userId');
    const host = cookies.get('host');
    if (!owner || !host) throw new Error('Sign in again before reconnecting.');
    const cmd = { host: 'lightapi.net', service: 'user', action: 'getNonceByUserId', version: '0.1.0', data: { userId: 'fake' } };
    const response = await fetch('/portal/query?cmd=' + encodeURIComponent(JSON.stringify(cmd)), {
        credentials: 'include', signal, redirect: 'error',
        headers: { 'X-CSRF-TOKEN': cookies.get('csrf') || '' },
    });
    // The established renewal probe intentionally queries a nonexistent user.
    if ((!response.ok && response.status !== 404) || cookies.get('userId') !== owner || cookies.get('host') !== host || !cookies.get('csrf')) {
        throw new Error('Authentication renewal failed or changed your account. Sign in again.');
    }
    // The reconnected Agent verifies the refreshed JWT and durable session ownership.
}
