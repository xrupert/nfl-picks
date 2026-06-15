// ============================================================
// ESPN API INTEGRATION LAYER
// File: src/lib/espn.js
// ============================================================
// Uses ESPN's publicly accessible (unofficial) API endpoints.
// No API key required. Can break if ESPN changes endpoints —
// treat as best-effort, build graceful fallbacks.
// ============================================================

const ESPN_BASE = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl';
// eslint-disable-next-line no-unused-vars
const ESPN_CORE = 'https://sports.core.api.espn.com/v2/sports/football/leagues/nfl';

// Default season the whole app targets. June 2026 → upcoming season is 2026.
export const DEFAULT_SEASON = 2026;

// ── RATE LIMITING ────────────────────────────────────────────
// ESPN has no published rate limit. Stay under 60 req/min to avoid blocks.
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── FETCH WRAPPER ────────────────────────────────────────────
// 3-retry exponential backoff (known edge case #6). Throws only after
// all retries are exhausted; callers in cron paths catch and degrade.
async function espnFetch(url, attempt = 0) {
  const MAX_RETRIES = 3;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; NFL-Prediction-App/1.0)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) throw new Error(`ESPN API error: ${res.status} ${url}`);
    return await res.json();
  } catch (err) {
    if (attempt >= MAX_RETRIES) throw err;
    const backoff = 500 * 2 ** attempt; // 500ms, 1s, 2s
    await sleep(backoff);
    return espnFetch(url, attempt + 1);
  }
}

// ============================================================
// SCHEDULE
// ============================================================

/**
 * Fetch the full regular season schedule for a given year.
 * Returns an array of game objects normalized for our DB.
 *
 * @param {number} year - e.g. 2026
 * @returns {Promise<NormalizedGame[]>}
 */
export async function fetchFullSchedule(year = DEFAULT_SEASON) {
  const games = [];

  for (let week = 1; week <= 18; week++) {
    const url = `${ESPN_BASE}/scoreboard?seasontype=2&week=${week}&dates=${year}`;
    let data;
    try {
      data = await espnFetch(url);
    } catch (err) {
      console.error(`Week ${week} fetch failed:`, err.message);
      data = { events: [] };
    }

    const weekGames = data.events?.map(normalizeGame).filter(Boolean) ?? [];
    games.push(...weekGames);

    await sleep(300); // polite delay between weeks
  }

  return games;
}

/**
 * Fetch a single week's scoreboard.
 * @param {number} week - 1-18
 * @param {number} year
 */
export async function fetchWeekSchedule(week, year = DEFAULT_SEASON) {
  const url = `${ESPN_BASE}/scoreboard?seasontype=2&week=${week}&dates=${year}`;
  const data = await espnFetch(url);
  return data.events?.map(normalizeGame).filter(Boolean) ?? [];
}

/**
 * Fetch playoff schedule.
 * seasontype=3 = postseason
 * week 1 = Wild Card, 2 = Divisional, 3 = Conf Champ, 4 = Pro Bowl (skip), 5 = Super Bowl
 */
export async function fetchPlayoffSchedule(year = DEFAULT_SEASON) {
  const playoffWeeks = [
    { week: 1, round: 'Wild Card' },
    { week: 2, round: 'Divisional' },
    { week: 3, round: 'Conference Championship' },
    { week: 5, round: 'Super Bowl' },
  ];

  const games = [];

  for (const { week, round } of playoffWeeks) {
    const url = `${ESPN_BASE}/scoreboard?seasontype=3&week=${week}&dates=${year}`;
    let data;
    try {
      data = await espnFetch(url);
    } catch (err) {
      console.error(`Playoff week ${week} fetch failed:`, err.message);
      data = { events: [] };
    }
    const weekGames =
      data.events?.map((e) => normalizeGame(e, round)).filter(Boolean) ?? [];
    games.push(...weekGames);
    await sleep(300);
  }

  return games;
}

// ============================================================
// LIVE SCORES / RESULTS SYNC
// Call this via cron job (Vercel cron or Supabase Edge Function)
// every 15 min during game windows (Sun 1pm-11pm, Mon/Thu nights)
// ============================================================

/**
 * Fetch live + completed scores for the current week.
 * Returns only games where the result is final.
 *
 * @param {number} week
 * @param {number} year
 * @returns {Promise<CompletedGame[]>}
 */
export async function fetchCompletedGames(week, year = DEFAULT_SEASON) {
  const url = `${ESPN_BASE}/scoreboard?seasontype=2&week=${week}&dates=${year}`;
  let data;
  try {
    data = await espnFetch(url);
  } catch (err) {
    console.error('fetchCompletedGames failed:', err.message);
    return [];
  }

  return (data.events ?? [])
    .filter((event) => {
      const status = event.status?.type?.state;
      return status === 'post'; // "post" = final
    })
    .map((event) => {
      const comp = event.competitions?.[0];
      if (!comp) return null;

      const home = comp.competitors?.find((c) => c.homeAway === 'home');
      const away = comp.competitors?.find((c) => c.homeAway === 'away');
      if (!home || !away) return null;

      const homeScore = parseInt(home.score, 10);
      const awayScore = parseInt(away.score, 10);

      // Ties: actual_winner stays null (known edge case #2).
      let winnerAbbr = null;
      if (homeScore > awayScore) winnerAbbr = home.team?.abbreviation?.toUpperCase();
      else if (awayScore > homeScore) winnerAbbr = away.team?.abbreviation?.toUpperCase();

      return {
        espnGameId: event.id,
        homeTeamAbbr: home.team?.abbreviation?.toUpperCase(),
        awayTeamAbbr: away.team?.abbreviation?.toUpperCase(),
        homeScore,
        awayScore,
        winnerAbbr,
        tie: homeScore === awayScore,
        completed: true,
      };
    })
    .filter(Boolean);
}

/**
 * Fetch completed playoff games for a given postseason week.
 */
export async function fetchCompletedPlayoffGames(playoffWeek, year = DEFAULT_SEASON) {
  const url = `${ESPN_BASE}/scoreboard?seasontype=3&week=${playoffWeek}&dates=${year}`;
  let data;
  try {
    data = await espnFetch(url);
  } catch (err) {
    console.error('fetchCompletedPlayoffGames failed:', err.message);
    return [];
  }

  return (data.events ?? [])
    .filter((e) => e.status?.type?.state === 'post')
    .map((event) => {
      const comp = event.competitions?.[0];
      if (!comp) return null;
      const home = comp.competitors?.find((c) => c.homeAway === 'home');
      const away = comp.competitors?.find((c) => c.homeAway === 'away');
      if (!home || !away) return null;
      const homeScore = parseInt(home.score, 10);
      const awayScore = parseInt(away.score, 10);
      // Playoff games cannot tie, but guard anyway.
      const winnerAbbr =
        homeScore > awayScore
          ? home.team?.abbreviation?.toUpperCase()
          : away.team?.abbreviation?.toUpperCase();
      return {
        espnGameId: event.id,
        homeTeamAbbr: home.team?.abbreviation?.toUpperCase(),
        awayTeamAbbr: away.team?.abbreviation?.toUpperCase(),
        homeScore,
        awayScore,
        winnerAbbr,
        completed: true,
      };
    })
    .filter(Boolean);
}

// ============================================================
// STANDINGS (for reference / validation)
// ============================================================

/**
 * Fetch actual current NFL standings from ESPN.
 * Useful to cross-check seeding logic.
 */
export async function fetchCurrentStandings(year = DEFAULT_SEASON) {
  const url = `${ESPN_BASE}/standings?season=${year}&seasontype=2`;
  const data = await espnFetch(url);

  const standings = [];
  for (const group of data.children ?? []) {
    for (const division of group.children ?? []) {
      for (const team of division.standings?.entries ?? []) {
        standings.push({
          teamAbbr: team.team?.abbreviation?.toUpperCase(),
          wins: parseInt(team.stats?.find((s) => s.name === 'wins')?.value ?? 0),
          losses: parseInt(team.stats?.find((s) => s.name === 'losses')?.value ?? 0),
          ties: parseInt(team.stats?.find((s) => s.name === 'ties')?.value ?? 0),
          divisionRank: parseInt(
            team.stats?.find((s) => s.name === 'divisionRank')?.value ?? 0
          ),
        });
      }
    }
  }

  return standings;
}

// ============================================================
// INTERNAL NORMALIZER
// ============================================================

function normalizeGame(event, overrideRound = null) {
  const comp = event.competitions?.[0];
  if (!comp) return null;

  const home = comp.competitors?.find((c) => c.homeAway === 'home');
  const away = comp.competitors?.find((c) => c.homeAway === 'away');
  if (!home || !away) return null;

  const dateStr = comp.date ?? event.date;
  const week = event.week?.number ?? null;

  return {
    espnGameId: event.id,
    week,
    gameDate: dateStr ? new Date(dateStr).toISOString() : null,
    homeTeamAbbr: home.team?.abbreviation?.toUpperCase(),
    awayTeamAbbr: away.team?.abbreviation?.toUpperCase(),
    homeTeamName: home.team?.displayName,
    awayTeamName: away.team?.displayName,
    status: event.status?.type?.state, // 'pre', 'in', 'post'
    round: overrideRound,
  };
}

// ============================================================
// SUPABASE SYNC HELPERS
// These are called by your API routes / Vercel cron jobs
// ============================================================

/**
 * Seed the schedule table with all regular season games.
 * Run once before the season. Requires Supabase admin client.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} year
 */
export async function seedScheduleToSupabase(supabase, year = DEFAULT_SEASON) {
  const games = await fetchFullSchedule(year);

  // Get team map: abbreviation -> uuid
  const { data: teams, error: teamErr } = await supabase
    .from('teams')
    .select('id, abbreviation');
  if (teamErr) throw teamErr;
  const teamMap = Object.fromEntries(teams.map((t) => [t.abbreviation, t.id]));

  const rows = games
    .filter((g) => teamMap[g.homeTeamAbbr] && teamMap[g.awayTeamAbbr])
    .map((g) => ({
      league_season_year: year,
      week: g.week,
      game_date: g.gameDate,
      home_team_id: teamMap[g.homeTeamAbbr],
      away_team_id: teamMap[g.awayTeamAbbr],
      espn_game_id: g.espnGameId,
    }));

  if (!rows.length) return 0;

  const { error } = await supabase
    .from('schedule')
    .upsert(rows, { onConflict: 'espn_game_id' });
  if (error) throw error;

  return rows.length;
}

/**
 * Sync completed game results into schedule table.
 * Call from Vercel cron: /api/cron/sync-scores
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} week
 * @param {number} year
 * @returns {Promise<{updated: number, gameIds: string[]}>}
 */
export async function syncCompletedGamesToSupabase(supabase, week, year = DEFAULT_SEASON) {
  const completed = await fetchCompletedGames(week, year);
  if (!completed.length) return { updated: 0, gameIds: [] };

  const { data: teams } = await supabase.from('teams').select('id, abbreviation');
  const teamMap = Object.fromEntries(teams.map((t) => [t.abbreviation, t.id]));

  let updated = 0;
  const gameIds = [];
  for (const game of completed) {
    // Ties → winner null. Otherwise resolve the abbreviation to a team id.
    const winnerId = game.tie ? null : teamMap[game.winnerAbbr] ?? null;

    const { error } = await supabase
      .from('schedule')
      .update({
        actual_home_score: game.homeScore,
        actual_away_score: game.awayScore,
        actual_winner_id: winnerId,
        game_completed: true,
      })
      .eq('espn_game_id', game.espnGameId);

    if (!error) {
      updated++;
      gameIds.push(game.espnGameId);
    }
  }

  return { updated, gameIds };
}

/**
 * Sync completed playoff results into playoff_bracket table.
 *
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {number} playoffWeek - 1=WC, 2=Div, 3=ConfChamp, 5=SB
 * @param {number} year
 */
export async function syncPlayoffResultsToSupabase(supabase, playoffWeek, year = DEFAULT_SEASON) {
  const completed = await fetchCompletedPlayoffGames(playoffWeek, year);
  if (!completed.length) return 0;

  const { data: teams } = await supabase.from('teams').select('id, abbreviation');
  const teamMap = Object.fromEntries(teams.map((t) => [t.abbreviation, t.id]));

  let updated = 0;
  for (const game of completed) {
    const winnerId = teamMap[game.winnerAbbr];
    if (!winnerId) continue;

    const { error } = await supabase
      .from('playoff_bracket')
      .update({
        actual_winner_id: winnerId,
        game_completed: true,
      })
      .eq('espn_game_id', game.espnGameId);

    if (!error) updated++;
  }

  return updated;
}
