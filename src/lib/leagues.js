import { supabase } from './supabase';

// ── League data helpers ──────────────────────────────────────

// Leagues the user belongs to, enriched with member count + the user's score.
export async function fetchMyLeagues(userId) {
  const { data: memberships, error } = await supabase
    .from('league_members')
    .select('league:leagues(*)')
    .eq('user_id', userId);
  if (error) throw error;

  const leagues = (memberships ?? []).map((m) => m.league).filter(Boolean);
  if (!leagues.length) return [];

  const ids = leagues.map((l) => l.id);

  // Member counts for all of these leagues in one query.
  const { data: members } = await supabase
    .from('league_members')
    .select('league_id')
    .in('league_id', ids);
  const counts = {};
  for (const m of members ?? []) counts[m.league_id] = (counts[m.league_id] ?? 0) + 1;

  // The user's score row in each league (may not exist yet).
  const { data: scores } = await supabase
    .from('scoring')
    .select('league_id, total_points, regular_picks_correct')
    .eq('user_id', userId)
    .in('league_id', ids);
  const scoreMap = Object.fromEntries((scores ?? []).map((s) => [s.league_id, s]));

  // How many regular-season picks the user has made in each league.
  const { data: picks } = await supabase
    .from('user_picks_regular')
    .select('league_id')
    .eq('user_id', userId)
    .in('league_id', ids);
  const pickCounts = {};
  for (const p of picks ?? []) pickCounts[p.league_id] = (pickCounts[p.league_id] ?? 0) + 1;

  return leagues.map((l) => ({
    ...l,
    memberCount: counts[l.id] ?? 0,
    score: scoreMap[l.id] ?? null,
    picksMade: pickCounts[l.id] ?? 0,
  }));
}

export async function createLeague({ name, seasonYear, userId }) {
  const { data: league, error } = await supabase
    .from('leagues')
    .insert({ name, season_year: seasonYear, commissioner_id: userId })
    .select()
    .single();
  if (error) throw error;

  const { error: memberErr } = await supabase
    .from('league_members')
    .insert({ league_id: league.id, user_id: userId });
  if (memberErr) throw memberErr;

  return league;
}

// Look up a league by invite code, with member count + whether the user is in it.
export async function fetchLeagueByInvite(inviteCode, userId) {
  const { data: league, error } = await supabase
    .from('leagues')
    .select('*')
    .eq('invite_code', inviteCode)
    .maybeSingle();
  if (error) throw error;
  if (!league) return null;

  const { data: members } = await supabase
    .from('league_members')
    .select('user_id')
    .eq('league_id', league.id);

  return {
    ...league,
    memberCount: members?.length ?? 0,
    alreadyMember: (members ?? []).some((m) => m.user_id === userId),
  };
}

export async function joinLeague({ leagueId, userId }) {
  const { error } = await supabase
    .from('league_members')
    .insert({ league_id: leagueId, user_id: userId });
  if (error) throw error;
}
