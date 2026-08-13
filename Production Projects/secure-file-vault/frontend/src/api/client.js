import axios from 'axios';

/**
 * Axios API Client
 * 
 * Base URL configuration:
 * - Development: Uses Vite proxy (/api -> localhost:8080) -- no env var needed
 * - Production: Set VITE_API_BASE_URL to the backend Cloud Run URL
 *   Example: VITE_API_BASE_URL=https://secure-vault-backend-xyz.run.app/api
 * 
 * IMPORTANT: VITE_* variables are bundled into frontend JavaScript and are PUBLIC.
 * Never put secrets, database passwords, or API keys in VITE_* variables.
 */
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api',
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 30000, // 30-second timeout for API requests
});

// Interceptor to attach Authorization Bearer JWT Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('vault_auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Interceptor for session expiration and token refresh handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // If access token expired and we have a refresh token, try to refresh
    if (error.response?.status === 401 &&
        error.response?.data?.error === 'TOKEN_EXPIRED' &&
        !originalRequest._retry) {
      originalRequest._retry = true;

      const refreshToken = localStorage.getItem('vault_refresh_token');
      if (refreshToken) {
        try {
          const refreshResponse = await axios.post(
            `${api.defaults.baseURL}/auth/refresh`,
            { refreshToken }
          );

          const { token: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data;
          localStorage.setItem('vault_auth_token', newAccessToken);
          localStorage.setItem('vault_refresh_token', newRefreshToken);

          // Retry the original request with new token
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        } catch (refreshError) {
          // Refresh failed, clear tokens and redirect to login
          localStorage.removeItem('vault_auth_token');
          localStorage.removeItem('vault_refresh_token');
          return Promise.reject(refreshError);
        }
      }
    }

    // Clear tokens on 401/403 (invalid/revoked tokens)
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      localStorage.removeItem('vault_auth_token');
      localStorage.removeItem('vault_refresh_token');
    }

    return Promise.reject(error);
  }
);

export default api;
