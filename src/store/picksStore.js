import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Regular-season picks for the current user in the current league.
// Records (W/L) are computed locally for instant feedback; the
// recalculate_standings RPC is fired (debounced) to keep predicted_standings
// in sync for the standings/seeding phase.

let standingsTimer = null;

export const usePicksStore = create((set, get) => ({
  leagueId: null,
  userId: null,
  schedule: [], // [{ id, week, home_team_id, away_team_id, game_date, game_completed, actual_winner_id, actual_home_score, actual_away_score }]
  picks: {}, // gameId -> picked_winner_id
  loading: true,
  saving: false,
  lastSavedAt: 0,

  load: async (leagueId, userId, seasonYear) => {
    set({ loading: true, leagueId, userId });

    const { data: schedule } = await supabase
      .from('schedule')
      .select(
        'id, week, home_team_id, away_team_id, game_date, espn_game_id, game_completed, actual_winner_id, actual_home_score, actual_away_score'
      )
      .eq('league_season_year', seasonYear)
      .order('week')
      .order('game_date');

    const { data: picks } = await supabase
      .from('user_picks_regular')
      .select('game_id, picked_winner_id')
      .eq('league_id', leagueId)
      .eq('user_id', userId);

    const pickMap = Object.fromEntries((picks ?? []).map((p) => [p.game_id, p.picked_winner_id]));

    set({ schedule: schedule ?? [], picks: pickMap, loading: false });
  },

  setPick: async (gameId, teamId) => {
    const { leagueId, userId } = get();
    // Optimistic local update.
    set((s) => ({ picks: { ...s.picks, [gameId]: teamId }, saving: true }));

    const { error } = await supabase.from('user_picks_regular').upsert(
      {
        league_id: leagueId,
        user_id: userId,
        game_id: gameId,
        picked_winner_id: teamId,
      },
      { onConflict: 'league_id,user_id,game_id' }
    );

    set({ saving: false, lastSavedAt: error ? get().lastSavedAt : Date.now() });

    // Debounced standings recalc (heavy RPC — no need to run on every click).
    if (!error) {
      clearTimeout(standingsTimer);
      standingsTimer = setTimeout(() => {
        supabase.rpc('recalculate_standings', { p_league_id: leagueId, p_user_id: userId });
      }, 1500);
    }
  },

  // W/L record for a team across all its games that have been picked.
  getRecord: (teamId) => {
    const { schedule, picks } = get();
    let w = 0;
    let l = 0;
    for (const g of schedule) {
      if (g.home_team_id !== teamId && g.away_team_id !== teamId) continue;
      const pick = picks[g.id];
      if (!pick) continue;
      if (pick === teamId) w++;
      else l++;
    }
    return { w, l };
  },

  pickedCount: () => Object.keys(get().picks).length,
}));
