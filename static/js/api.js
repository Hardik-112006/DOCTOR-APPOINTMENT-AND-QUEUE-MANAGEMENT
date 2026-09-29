/**
 * DoctorQueue Central API Client
 * Manages JWT tokens, automatic header injection, token refresh, and standardized request/response parsing.
 */

const API = (() => {
    const BASE_URL = '/api/v1';
    const TOKEN_KEY = 'doctorqueue_access_token';
    const REFRESH_KEY = 'doctorqueue_refresh_token';
    const USER_KEY = 'doctorqueue_current_user';
    const LANG_KEY = 'doctorqueue_lang';

    // Toast notification container
    const showToast = (message, type = 'info') => {
        let toastContainer = document.getElementById('dq-toast-container');
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'dq-toast-container';
            toastContainer.className = 'fixed bottom-5 right-5 z-50 flex flex-col gap-2 max-w-md';
            document.body.appendChild(toastContainer);
        }

        const toast = document.createElement('div');
        const bgColors = {
            success: 'bg-emerald-600 text-white',
            error: 'bg-rose-600 text-white',
            warning: 'bg-amber-600 text-white',
            info: 'bg-slate-800 text-white'
        };
        const icons = {
            success: '✓',
            error: '✕',
            warning: '⚠',
            info: 'ℹ'
        };

        toast.className = `flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl font-medium text-sm transition-all duration-300 transform translate-y-2 opacity-0 ${bgColors[type] || bgColors.info}`;
        toast.innerHTML = `
            <span class="w-6 h-6 flex items-center justify-center rounded-full bg-white/20 font-bold text-xs">${icons[type] || 'ℹ'}</span>
            <span class="flex-1">${message}</span>
            <button class="text-white/70 hover:text-white text-base leading-none font-bold" onclick="this.parentElement.remove()">&times;</button>
        `;

        toastContainer.appendChild(toast);
        setTimeout(() => {
            toast.classList.remove('translate-y-2', 'opacity-0');
        }, 10);

        setTimeout(() => {
            toast.classList.add('opacity-0', 'translate-y-2');
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    };

    const getToken = () => localStorage.getItem(TOKEN_KEY);
    const getRefreshToken = () => localStorage.getItem(REFRESH_KEY);
    const getUser = () => {
        try {
            return JSON.parse(localStorage.getItem(USER_KEY) || 'null');
        } catch {
            return null;
        }
    };
    const getLanguage = () => {
        const raw = (localStorage.getItem(LANG_KEY) || 'en').trim().toLowerCase();
        if (raw.startsWith('hi')) return 'hi';
        return 'en';
    };

    const setAuth = (data) => {
        if (data.access) localStorage.setItem(TOKEN_KEY, data.access);
        if (data.refresh) localStorage.setItem(REFRESH_KEY, data.refresh);
        if (data.user) {
            localStorage.setItem(USER_KEY, JSON.stringify(data.user));
            // Priority:
            // 1. Explicit current localStorage language selection
            // 2. User profile language only when no local language preference exists
            // 3. Default English
            const currentPref = localStorage.getItem(LANG_KEY);
            if (!currentPref && data.user.language) {
                setLanguage(data.user.language);
            }
        }
    };

    const setLanguage = (lang) => {
        const normalized = (lang && String(lang).trim().toLowerCase().startsWith('hi')) ? 'hi' : 'en';
        localStorage.setItem(LANG_KEY, normalized);
        document.documentElement.lang = normalized;
    };

    const clearAuth = () => {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(REFRESH_KEY);
        localStorage.removeItem(USER_KEY);
    };

    const refreshToken = async () => {
        const refresh = getRefreshToken();
        if (!refresh) return null;
        try {
            const res = await fetch(`${BASE_URL}/auth/refresh/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh })
            });
            if (res.ok) {
                const data = await res.json();
                if (data.access) {
                    localStorage.setItem(TOKEN_KEY, data.access);
                    return data.access;
                }
            }
        } catch (e) {
            console.error("Token refresh failed", e);
        }
        clearAuth();
        return null;
    };

    const request = async (endpoint, options = {}) => {
        let url;
        if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
            url = endpoint;
        } else if (endpoint.startsWith(BASE_URL)) {
            url = endpoint;
        } else {
            const cleanPath = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
            url = `${BASE_URL}${cleanPath}`;
        }

        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
        };

        let token = getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }

        const config = {
            ...options,
            headers
        };

        try {
            let response = await fetch(url, config);

            // Handle 401 Unauthorized by trying refresh token once
            if (response.status === 401 && getRefreshToken() && !options._retry) {
                options._retry = true;
                const newToken = await refreshToken();
                if (newToken) {
                    headers['Authorization'] = `Bearer ${newToken}`;
                    response = await fetch(url, { ...options, headers });
                } else {
                    if (window.location.pathname !== '/login/' && window.location.pathname !== '/') {
                        window.location.href = '/login/?session_expired=1';
                    }
                }
            }

            const data = await response.json().catch(() => ({}));

            if (!response.ok) {
                const errorMsg = data?.error?.message || data?.detail || 'Request failed';
                return { ok: false, status: response.status, error: data?.error || { message: errorMsg }, data: null };
            }

            const resData = data.data !== undefined ? data.data : data;
            return {
                ok: true,
                status: response.status,
                data: resData,
                total: data.total !== undefined ? data.total : (Array.isArray(resData) ? resData.length : null),
                limit: data.limit,
                offset: data.offset,
                raw: data,
                error: null
            };
        } catch (err) {
            console.error(`API Request Error [${endpoint}]:`, err);
            return {
                ok: false,
                status: 0,
                error: { code: 'NETWORK_ERROR', message: 'Unable to connect to server. Please check connection.' },
                data: null
            };
        }
    };

    const get = (endpoint, params = {}) => {
        const cleanEndpoint = endpoint.startsWith(BASE_URL) ? endpoint.substring(BASE_URL.length) : endpoint;
        const path = cleanEndpoint.startsWith('/') ? cleanEndpoint : `/${cleanEndpoint}`;
        const url = new URL(`${window.location.origin}${BASE_URL}${path}`);
        Object.entries(params).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') url.searchParams.append(k, v);
        });
        return request(url.pathname + url.search, { method: 'GET' });
    };

    const post = (endpoint, body = {}) => {
        return request(endpoint, {
            method: 'POST',
            body: JSON.stringify(body)
        });
    };

    const put = (endpoint, body = {}) => {
        return request(endpoint, {
            method: 'PUT',
            body: JSON.stringify(body)
        });
    };

    const patch = (endpoint, body = {}) => {
        return request(endpoint, {
            method: 'PATCH',
            body: JSON.stringify(body)
        });
    };

    const del = (endpoint) => {
        return request(endpoint, { method: 'DELETE' });
    };

    const login = async (identifier, password) => {
        const res = await post('/auth/login/', { username_or_email: identifier, password });
        if (res.ok && res.data) {
            setAuth(res.data);
            showToast('Login successful!', 'success');
        } else {
            showToast(res.error?.message || 'Invalid credentials', 'error');
        }
        return res;
    };

    const logout = () => {
        clearAuth();
        showToast('Logged out successfully', 'info');
        window.location.href = '/login/';
    };

    const requireAuth = (allowedRoles = []) => {
        const user = getUser();
        const token = getToken();
        if (!token || !user) {
            window.location.href = '/login/';
            return false;
        }
        if (allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
            showToast('Unauthorized access for your role', 'warning');
            redirectUserDashboard(user.role);
            return false;
        }
        return true;
    };

    const redirectUserDashboard = (role) => {
        switch (role) {
            case 'PATIENT':
                window.location.href = '/track/';
                break;
            case 'RECEPTIONIST':
                window.location.href = '/reception/';
                break;
            case 'DOCTOR':
                window.location.href = '/doctor/';
                break;
            case 'ADMIN':
                window.location.href = '/dashboard/';
                break;
            default:
                window.location.href = '/login/';
        }
    };

    return {
        get,
        post,
        put,
        patch,
        delete: del,
        login,
        logout,
        setAuth,
        getToken,
        getUser,
        getLanguage,
        setLanguage,
        clearAuth,
        showToast,
        requireAuth,
        redirectUserDashboard
    };
})();
