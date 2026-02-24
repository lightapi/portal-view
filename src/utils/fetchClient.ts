import Cookies from 'universal-cookie';

const BASE_URL = import.meta.env.VITE_API_BASE_URL || "";

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

    const config = {
        ...options,
        headers: {
            ...defaultHeaders,
            ...options.headers,
        },
        credentials: 'include',
    };

    const response = await fetch(url, config);

    if (!response.ok) {
        let error;
        try {
            error = await response.json();
        } catch (e) {
            error = response.statusText;
        }
        throw error;
    }

    if (response.status === 204) {
        return {};
    }

    return response.json();
}

export default fetchClient;
