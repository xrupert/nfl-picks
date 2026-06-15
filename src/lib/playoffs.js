// ============================================================
// PLAYOFF BRACKET COMPUTATION
// ============================================================
// The bracket is the user's PREDICTED bracket, derived from their predicted
// seeding. Wild Card matchups are fixed (2v7, 3v6, 4v5 + the #1 bye). Later
// rounds form from the user's own pick results, reseeding each round per the
// NFL format (the #1 seed always plays the lowest remaining seed).
// ============================================================

const ROUNDS = ['Wild Card', 'Divisional', 'Conference Championship', 'Super Bowl'];

// A pick only counts if it names one of the two teams actually in the game.
const validPick = (picks, id, t1, t2) => {
  const p = picks[id];
  return p && (p === t1 || p === t2) ? p : null;
};

/**
 * @param rows   playoff_bracket rows for this user/league
 * @param picks  { playoff_game_id: picked_winner_id }
 * @param seed1  { AFC: teamId, NFC: teamId } — the #1 (bye) seeds
 */
export function computeBracket(rows, picks, seed1) {
  const get = (round, conf) =>
    rows
      .filter((r) => r.round === round && (conf ? r.conference === conf : true))
      .sort((a, b) => a.game_number - b.game_number);

  const result = { AFC: {}, NFC: {}, sb: null };
  const confWinner = {};

  for (const conf of ['AFC', 'NFC']) {
    // Wild Card — teams are fixed from seeding.
    const wc = get('Wild Card', conf).map((r) => {
      const pickedId = validPick(picks, r.id, r.team1_id, r.team2_id);
      const winnerSeed = pickedId === r.team1_id ? r.team1_seed : pickedId === r.team2_id ? r.team2_seed : null;
      return {
        id: r.id,
        round: 'Wild Card',
        conference: conf,
        gameNumber: r.game_number,
        team1Id: r.team1_id,
        team2Id: r.team2_id,
        team1Seed: r.team1_seed,
        team2Seed: r.team2_seed,
        pickedId,
        winnerSeed,
      };
    });
    const wcDone = wc.length === 3 && wc.every((g) => g.pickedId);

    // Divisional — reseed: #1 bye vs lowest remaining seed; other two play.
    const divRows = get('Divisional', conf);
    let div = divRows.map((r) => ({
      id: r.id,
      round: 'Divisional',
      conference: conf,
      gameNumber: r.game_number,
      team1Id: null,
      team2Id: null,
      pickedId: null,
    }));
    if (wcDone && divRows.length === 2) {
      const winners = wc.map((g) => ({ teamId: g.pickedId, seed: g.winnerSeed }));
      const lowest = winners.reduce((m, w) => (w.seed > m.seed ? w : m), winners[0]);
      const others = winners.filter((w) => w !== lowest).sort((a, b) => a.seed - b.seed);
      div[0].team1Id = seed1[conf];
      div[0].team2Id = lowest.teamId;
      div[1].team1Id = others[0]?.teamId ?? null;
      div[1].team2Id = others[1]?.teamId ?? null;
      div = div.map((g) => ({ ...g, pickedId: validPick(picks, g.id, g.team1Id, g.team2Id) }));
    }
    const divDone = div.length === 2 && div.every((g) => g.pickedId);

    // Conference Championship — the two divisional winners.
    const confRow = get('Conference Championship', conf)[0];
    let confGame = confRow
      ? { id: confRow.id, round: 'Conference Championship', conference: conf, gameNumber: 1, team1Id: null, team2Id: null, pickedId: null }
      : null;
    if (confGame && divDone) {
      confGame.team1Id = div[0].pickedId;
      confGame.team2Id = div[1].pickedId;
      confGame.pickedId = validPick(picks, confGame.id, confGame.team1Id, confGame.team2Id);
    }
    confWinner[conf] = confGame?.pickedId ?? null;
    result[conf] = { wc, div, conf: confGame };
  }

  // Super Bowl — the two conference champions.
  const sbRow = rows.find((r) => r.round === 'Super Bowl');
  let sb = sbRow
    ? { id: sbRow.id, round: 'Super Bowl', conference: null, team1Id: null, team2Id: null, pickedId: null }
    : null;
  if (sb && confWinner.AFC && confWinner.NFC) {
    sb.team1Id = confWinner.AFC;
    sb.team2Id = confWinner.NFC;
    sb.pickedId = validPick(picks, sb.id, sb.team1Id, sb.team2Id);
  }
  result.sb = sb;
  return result;
}

// Every game in render order, for collecting allowed teams / pruning.
export function allGames(b) {
  const list = [];
  for (const conf of ['AFC', 'NFC']) {
    list.push(...b[conf].wc, ...b[conf].div);
    if (b[conf].conf) list.push(b[conf].conf);
  }
  if (b.sb) list.push(b.sb);
  return list;
}

export { ROUNDS };
