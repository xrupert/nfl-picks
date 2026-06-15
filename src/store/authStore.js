import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Global auth/session state. initAuth() is called once at app boot.
export const useAuthStore = create((set, get) => ({
  session: null,
  profile: null, // { id, username, avatar_url }
  loading: true,

  initAuth: async () => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    set({ session });
    if (session) await get().loadProfile(session.user.id);
    set({ loading: false });

    supabase.auth.onAuthStateChange(async (_event, session) => {
      set({ session });
      if (session) await get().loadProfile(session.user.id);
      else set({ profile: null });
    });
  },

  loadProfile: async (userId) => {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    set({ profile: data ?? null });
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },
}));
