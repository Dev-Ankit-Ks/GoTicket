
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api';

const client = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Use a separate Axios instance so refresh requests don't trigger
// the main response interceptor.
const refreshClient = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

let isRefreshing = false;
let failedQueue = [];

function processQueue(error) {
  failedQueue.forEach(({ resolve, reject }) => {
    if (error) {
      reject(error);
    } else {
      resolve();
    }
  });

  failedQueue = [];
}

function isAuthEndpoint(url = '') {
  return [
    '/users/auth/login',
    '/users/auth/send-otp',
    '/users/auth/verify-otp',
    '/users/auth/google-auth',
    '/users/auth/refresh',
    '/users/auth/logout',
  ].some((endpoint) => url.includes(endpoint));
}

client.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (!originalRequest) {
      return Promise.reject(error);
    }

    // Refresh only for unauthorized requests that require an
    // existing authenticated session.
    if (
      status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint(originalRequest.url)
    ) {
      if (isRefreshing) {
        originalRequest._retry = true;

        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => client(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await refreshClient.post('/users/auth/refresh', {});

        processQueue(null);

        return client(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);

        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('auth:logout'));
        }

        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    const message =
      error.response?.data?.message ||
      error.response?.data?.error ||
      error.message ||
      'Something went wrong';

    const enhancedError = new Error(message);

    enhancedError.status = status;
    enhancedError.code = error.response?.data?.code;
    enhancedError.data = error.response?.data;

    return Promise.reject(enhancedError);
  }
);

export default client;
