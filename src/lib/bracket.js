import { supabase } from './supabase';

// Persist a user's derived standings + seeding into predicted_standings so
// scoring and the bracket can read it. Writes all 32 teams.
export async function persistSeeding({ leagueId, userId, teams, derived }) {
  const seedByTeam = {};
  for (const conf of ['AFC', 'NFC']) {
    for (const s of derived.seeds[conf]) seedByTeam[s.teamId] = s;
  }
  const rankByTeam = {};
  for (const key of Object.keys(derived.divisions)) {
    for (const t of derived.divisions[key].teams) rankByTeam[t.teamId] = t.rank;
  }

  const rows = teams.map((t) => {
    const seedInfo = seedByTeam[t.id];
    const rec = derived.records[t.id] ?? { w: 0, l: 0 };
    return {
      league_id: leagueId,
      user_id: userId,
      team_id: t.id,
      predicted_wins: rec.w,
      predicted_losses: rec.l,
      predicted_ties: 0,
      division_rank: rankByTeam[t.id] ?? null,
      conference_seed: seedInfo?.seed ?? null,
      is_division_winner: seedInfo?.isDivWinner ?? false,
      is_playoff_team: Boolean(seedInfo),
      updated_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from('predicted_standings')
    .upsert(rows, { onConflict: 'league_id,user_id,team_id' });
  if (error) throw error;
}

// Build the playoff bracket rows from the seeding.
// Only Wild Card games get teams now (from seeds); later rounds are created
// empty and populated as the user picks in Phase 5.
// Seed 1 gets a bye (NFL format since 2021). Wild Card: 2v7, 3v6, 4v5.
export function buildBracketRows({ leagueId, userId, seasonYear, derived }) {
  const rows = [];
  const seedMap = {}; // conf -> seed -> teamId
  for (const conf of ['AFC', 'NFC']) {
    seedMap[conf] = {};
    for (const s of derived.seeds[conf]) seedMap[conf][s.seed] = s.teamId;

    const wc = [
      { gn: 1, hi: 2, lo: 7 },
      { gn: 2, hi: 3, lo: 6 },
      { gn: 3, hi: 4, lo: 5 },
    ];
    for (const m of wc) {
      rows.push({
        league_id: leagueId,
        user_id: userId,
        season_year: seasonYear,
        round: 'Wild Card',
        game_number: m.gn,
        conference: conf,
        team1_seed: m.hi,
        team2_seed: m.lo,
        team1_id: seedMap[conf][m.hi] ?? null,
        team2_id: seedMap[conf][m.lo] ?? null,
      });
    }

    // Divisional: 2 games per conference, filled in during Phase 5.
    for (const gn of [1, 2]) {
      rows.push({
        league_id: leagueId,
        user_id: userId,
        season_year: seasonYear,
        round: 'Divisional',
        game_number: gn,
        conference: conf,
      });
    }

    // Conference Championship: 1 per conference.
    rows.push({
      league_id: leagueId,
      user_id: userId,
      season_year: seasonYear,
      round: 'Conference Championship',
      game_number: 1,
      conference: conf,
    });
  }

  // Super Bowl: 1 game, no conference.
  rows.push({
    league_id: leagueId,
    user_id: userId,
    season_year: seasonYear,
    round: 'Super Bowl',
    game_number: 1,
    conference: null,
  });

  return rows;
}

// Regenerate the user's bracket: wipe their existing rows and insert fresh.
export async function generateBracket({ leagueId, userId, seasonYear, derived }) {
  await supabase
    .from('playoff_bracket')
    .delete()
    .eq('league_id', leagueId)
    .eq('user_id', userId);

  const rows = buildBracketRows({ leagueId, userId, seasonYear, derived });
  const { error } = await supabase.from('playoff_bracket').insert(rows);
  if (error) throw error;
}
