import Cookies from 'universal-cookie';
import { apiUrl } from "./runtimePaths";

/**
 * Custom fetch wrapper with automatic base URL prefixing and CSRF handling
 * @param {string} endpoint - API endpoint path (e.g., '/portal/query')
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - Response JSON
 */
async function fetchClient(endpoint: string, options: any = {}) {
    const url = apiUrl(endpoint);
    const cookies = new Cookies();
    const csrfToken = cookies.get('csrf');

    const headers = new Headers({ "Content-Type": "application/json" });

    if (csrfToken) {
        headers.set('X-CSRF-TOKEN', csrfToken);
    }
    new Headers(options.headers).forEach((value, name) => headers.set(name, value));

    let finalBody = options.body;
    let isJsonRpc = false;

    if (options.body) {
        let bodyObj = options.body;

        // If the body is a string, try to parse it into an object first
        if (typeof options.body === 'string') {
            try {
                bodyObj = JSON.parse(options.body);
            } catch (e) {
                // Not valid JSON, leave bodyObj as the original string
            }
        }

        if (typeof bodyObj === 'object' && !(bodyObj instanceof FormData)) {
            // Detect explicit JSON-RPC
            if (bodyObj.jsonrpc === "2.0") {
                isJsonRpc = true;
            }
            // Convert legacy command/query payloads
            else if (bodyObj.host && bodyObj.service && bodyObj.action && bodyObj.version && !bodyObj.rest) {
                const method = `${bodyObj.host}/${bodyObj.service}/${bodyObj.action}/${bodyObj.version}`;
                const params = bodyObj.data || {};
                const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
                bodyObj = {
                    jsonrpc: "2.0",
                    method: method,
                    params: params,
                    id: id
                };
                isJsonRpc = true;
            }
            // Always stringify the final object payload
            finalBody = JSON.stringify(bodyObj);
        }
    }

    const requestConfig = {
        ...options,
        headers,
        body: finalBody,
        credentials: 'include',
    };

    const response = await fetch(url, requestConfig);

    if (!response.ok) {
        let error: unknown;
        let responseText = '';
        try {
            responseText = await response.text();
        } catch (_ignored) {
            // Some response mocks expose only json(); retain compatibility with them.
        }
        if (responseText) {
            try {
                error = JSON.parse(responseText);
            } catch (_ignored) {
                error = responseText;
            }
        } else {
            try {
                error = await response.json();
            } catch (_ignored) {
                error = response.statusText;
            }
        }
        // Unwrap JSON-RPC error if formatted.
        if (isJsonRpc && error && typeof error === 'object'
            && 'jsonrpc' in error && error.jsonrpc === "2.0" && 'error' in error) {
            error = error.error;
        }
        const csrfMismatch = response.status === 401 && (
            typeof error === 'string'
                ? /^ERR10039(?:[\s:]|$)/.test(error.trim())
                : !!error && typeof error === 'object' && 'code' in error && error.code === 'ERR10039'
        );
        if (typeof error === 'string') {
            const status = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
            error = error.trim() ? `${status}: ${error.trim()}` : status;
        }
        if (csrfMismatch) {
            const guidance = 'CSRF verification failed. Reload the page; if it still fails, sign out and sign in again.';
            if (typeof error === 'string') {
                error = `${error} ${guidance}`;
            } else if (error && typeof error === 'object') {
                // Keep structured error codes and fields available to existing callers.
                error = { ...error, description: `${'description' in error ? error.description : ''} ${guidance}`.trim() };
            }
        }
        throw error;
    }

    if (response.status === 204) {
        return {};
    }

    const json = await response.json();

    // Unwrap JSON-RPC result if formatted
    if (isJsonRpc && json && json.jsonrpc === "2.0") {
        if (json.error) {
            throw json.error;
        }
        return json.result;
    }

    return json;
}

export default fetchClient;
