import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Holds the league the user is currently viewing + its members.
export const useLeagueStore = create((set, get) => ({
  league: null,
  members: [], // [{ user_id, username }]
  loading: false,
  error: null,

  loadLeague: async (leagueId) => {
    set({ loading: true, error: null });
    const { data: league, error } = await supabase
      .from('leagues')
      .select('*')
      .eq('id', leagueId)
      .maybeSingle();
    if (error || !league) {
      set({ loading: false, error: error?.message ?? 'League not found', league: null });
      return;
    }

    const { data: members } = await supabase
      .from('league_members')
      .select('user_id, profiles(username, avatar_url)')
      .eq('league_id', leagueId);

    set({
      league,
      members: (members ?? []).map((m) => ({
        user_id: m.user_id,
        username: m.profiles?.username ?? 'Player',
        avatar_url: m.profiles?.avatar_url ?? null,
      })),
      loading: false,
    });
  },

  isCommissioner: (userId) => get().league?.commissioner_id === userId,
  isLocked: () => get().league?.pick_lock_status === 'locked',

  // Optimistically mark locked after the commissioner locks.
  setLocked: () =>
    set((s) => ({
      league: s.league ? { ...s.league, pick_lock_status: 'locked', locked_at: new Date().toISOString() } : s.league,
    })),
}));
