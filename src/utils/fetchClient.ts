import Cookies from 'universal-cookie';

const BASE_URL = (import.meta as any).env.VITE_API_BASE_URL || "";

/**
 * Custom fetch wrapper with automatic base URL prefixing and CSRF handling
 * @param {string} endpoint - API endpoint path (e.g., '/portal/query')
 * @param {Object} options - Fetch options (method, headers, body, etc.)
 * @returns {Promise} - Response JSON
 */
async function fetchClient(endpoint: string, options: any = {}) {
    const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;
    const cookies = new Cookies();
    const csrfToken = cookies.get('csrf');

    const defaultHeaders: any = {
        "Content-Type": "application/json",
    };

    if (csrfToken) {
        defaultHeaders['X-CSRF-TOKEN'] = csrfToken;
    }

    let finalBody = options.body;
    let isJsonRpc = false;

    if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
        // Detect explicit JSON-RPC
        if (options.body.jsonrpc === "2.0") {
            isJsonRpc = true;
        }
        // Convert legacy command/query payloads
        else if (options.body.host && options.body.service && options.body.action && options.body.version && !options.body.rest) {
            const method = `${options.body.host}/${options.body.service}/${options.body.action}/${options.body.version}`;
            const params = options.body.data || {};
            const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 10);
            finalBody = {
                jsonrpc: "2.0",
                method: method,
                params: params,
                id: id
            };
            isJsonRpc = true;
        }
        finalBody = JSON.stringify(finalBody);
    }

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
        body: finalBody,
        credentials: 'include',
    };

    const response = await fetch(url, config);

    if (!response.ok) {
        let error;
        try {
            error = await response.json();
            // Unwrap JSON-RPC error if formatted
            if (isJsonRpc && error && error.jsonrpc === "2.0" && error.error) {
                error = error.error;
            }
        } catch (e) {
            error = response.statusText;
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
