// ============================================================
// SEEDING DERIVATION
// ============================================================
// Turns a user's 272 game picks into division standings and a
// per-conference 1–7 playoff seeding.
//
// NFL tiebreakers are 9 levels deep; per the spec we simplify to:
//   head-to-head  >  (shared) record  >  manual resolution.
// Any tie we cannot break automatically is surfaced to the user.
// ============================================================

// Wins/losses for every team from the pick map.
export function computeRecords(teams, schedule, picks) {
  const rec = {};
  for (const t of teams) rec[t.id] = { teamId: t.id, w: 0, l: 0 };
  for (const g of schedule) {
    const pick = picks[g.id];
    if (!pick) continue;
    for (const side of [g.home_team_id, g.away_team_id]) {
      if (!rec[side]) continue;
      if (pick === side) rec[side].w++;
      else rec[side].l++;
    }
  }
  return rec;
}

// Head-to-head wins among a specific set of tied teams.
function headToHead(teamIds, schedule, picks) {
  const set = new Set(teamIds);
  const h2h = Object.fromEntries(teamIds.map((id) => [id, 0]));
  for (const g of schedule) {
    if (!set.has(g.home_team_id) || !set.has(g.away_team_id)) continue;
    const pick = picks[g.id];
    if (pick && h2h[pick] !== undefined) h2h[pick]++;
  }
  return h2h;
}

// Order a group of teams by wins, then head-to-head. Returns
// { ordered: [teamId...], hasUnresolved: bool } where unresolved means two
// teams remained exactly equal after the automatic tiebreakers.
function orderGroup(teamIds, records, schedule, picks) {
  let unresolved = false;
  const ordered = [...teamIds].sort((a, b) => {
    const wd = records[b].w - records[a].w;
    if (wd !== 0) return wd;
    // Tie on wins → head-to-head among everyone tied on this win total.
    const tiedWins = records[a].w;
    const tiedSet = teamIds.filter((id) => records[id].w === tiedWins);
    const h2h = headToHead(tiedSet, schedule, picks);
    const hd = (h2h[b] ?? 0) - (h2h[a] ?? 0);
    if (hd !== 0) return hd;
    unresolved = true; // still equal — needs manual resolution
    return 0;
  });
  return { ordered, hasUnresolved: unresolved };
}

export const DIVISIONS = [
  { conference: 'NFC', division: 'North' },
  { conference: 'NFC', division: 'South' },
  { conference: 'NFC', division: 'East' },
  { conference: 'NFC', division: 'West' },
  { conference: 'AFC', division: 'North' },
  { conference: 'AFC', division: 'South' },
  { conference: 'AFC', division: 'East' },
  { conference: 'AFC', division: 'West' },
];

/**
 * Full standings + seeding derivation.
 *
 * @param overrides - { [divKey]: [orderedTeamId...] } manual division orderings
 * @returns {
 *   records,
 *   divisions: { [divKey]: { teams: [{teamId,w,l,rank}], winnerId, unresolved } },
 *   seeds: { AFC: [{seed,teamId,w,l,isDivWinner}], NFC: [...] },
 *   unresolvedDivisions: [divKey...]
 * }
 */
export function deriveSeeding(teams, schedule, picks, overrides = {}) {
  const records = computeRecords(teams, schedule, picks);
  const teamsById = Object.fromEntries(teams.map((t) => [t.id, t]));

  const divisions = {};
  const unresolvedDivisions = [];

  for (const d of DIVISIONS) {
    const key = `${d.conference} ${d.division}`;
    const divTeamIds = teams
      .filter((t) => t.conference === d.conference && t.division === d.division)
      .map((t) => t.id);

    let ordered;
    let unresolved = false;
    if (overrides[key] && overrides[key].length === divTeamIds.length) {
      ordered = overrides[key];
    } else {
      const res = orderGroup(divTeamIds, records, schedule, picks);
      ordered = res.ordered;
      unresolved = res.hasUnresolved;
    }
    if (unresolved) unresolvedDivisions.push(key);

    divisions[key] = {
      conference: d.conference,
      division: d.division,
      winnerId: ordered[0],
      unresolved,
      teams: ordered.map((teamId, i) => ({
        teamId,
        team: teamsById[teamId],
        w: records[teamId].w,
        l: records[teamId].l,
        rank: i + 1,
      })),
    };
  }

  // Conference seeding: 4 division winners (seeds 1–4 by record),
  // then 3 wildcards (seeds 5–7) from the rest by record.
  const seeds = {};
  for (const conf of ['AFC', 'NFC']) {
    const confDivs = DIVISIONS.filter((d) => d.conference === conf).map(
      (d) => `${d.conference} ${d.division}`
    );
    const winnerIds = confDivs.map((k) => divisions[k].winnerId);
    const winnerOrder = orderGroup(winnerIds, records, schedule, picks).ordered;

    const nonWinnerIds = teams
      .filter((t) => t.conference === conf && !winnerIds.includes(t.id))
      .map((t) => t.id);
    const wildcardOrder = orderGroup(nonWinnerIds, records, schedule, picks).ordered.slice(0, 3);

    const seeded = [
      ...winnerOrder.map((teamId, i) => ({ seed: i + 1, teamId, isDivWinner: true })),
      ...wildcardOrder.map((teamId, i) => ({ seed: i + 5, teamId, isDivWinner: false })),
    ].map((s) => ({
      ...s,
      team: teamsById[s.teamId],
      w: records[s.teamId].w,
      l: records[s.teamId].l,
    }));

    seeds[conf] = seeded;
  }

  return { records, divisions, seeds, unresolvedDivisions };
}
