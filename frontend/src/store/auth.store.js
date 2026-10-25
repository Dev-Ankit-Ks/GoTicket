
import { create } from 'zustand';
import { authApi } from '../api/auth.api';

let profileRequest = null;

export const useAuthStore = create((set, get) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,

  setUser: (user) =>
    set({
      user: user ?? null,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  fetchProfile: async () => {
    // Reuse an existing profile request instead of making duplicates.
    if (profileRequest) {
      return profileRequest;
    }

    profileRequest = (async () => {
      try {
        const res = await authApi.getProfile();

        // authApi returns the response body, not the Axios response.
        const user = res?.user ?? res?.data?.user ?? res?.data ?? null;

        if (!user) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
          return null;
        }

        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        });

        return user;
      } catch {
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
        });

        return null;
      } finally {
        profileRequest = null;
      }
    })();

    return profileRequest;
  },

  logout: () => {
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },
}));

// Handle forced logout from the Axios interceptor.
if (typeof window !== 'undefined') {
  window.addEventListener('auth:logout', () => {
    useAuthStore.getState().logout();
  });
}
