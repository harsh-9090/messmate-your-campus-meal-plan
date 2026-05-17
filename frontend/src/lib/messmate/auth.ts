// Auth-only client store. All app data now comes from the backend via React Query.
import { create } from "zustand";
import { persist } from "zustand/middleware";
import { authApi, configureApi } from "./api";

interface AuthUser { id: string; name: string; role: "admin" | "staff" | "member"; }

interface AuthState {
  accessToken: string | null;
  user: AuthUser | null;
  _hasHydrated: boolean;
  setHasHydrated: (state: boolean) => void;
  setAuth: (accessToken: string, user: AuthUser) => void;
  clear: () => void;
  login: (memberId: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
}

export const useAuth = create<AuthState>()(
  persist(
    (set, get) => ({
      accessToken: null,
      user: null,
      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state }),
      setAuth: (accessToken, user) => set({ accessToken, user }),
      clear: () => set({ accessToken: null, user: null }),
      login: async (memberId, password) => {
        const { accessToken, user } = await authApi.login(memberId, password);
        set({ accessToken, user });
        return user;
      },
      logout: async () => {
        try { await authApi.logout(); } catch {}
        set({ accessToken: null, user: null });
      },
    }),
    {
      name: "messmate-auth-v1",
      partialize: (s) => ({ accessToken: s.accessToken, user: s.user }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

// Wire the api client to the store
configureApi({
  getToken: () => useAuth.getState().accessToken,
  setToken: (token: string) => useAuth.getState().setAuth(token, useAuth.getState().user!),
  onUnauthorized: () => useAuth.getState().clear(),
});
