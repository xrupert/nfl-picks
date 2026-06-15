import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLeagueStore } from '../store/leagueStore';
import { useTeamsStore } from '../store/teamsStore';
import { supabase } from '../lib/supabase';
import { computeBracket, allGames } from '../lib/playoffs';
import BracketGame from '../components/BracketGame';
import TeamHelmet from '../components/TeamHelmet';

export default function PlayoffBracket() {
  const { leagueId } = useParams();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const league = useLeagueStore((s) => s.league);
  const teamsById = useTeamsStore((s) => s.byId);

  const [rows, setRows] = useState([]);
  const [picks, setPicks] = useState({});
  const [standings, setStandings] = useState([]);
  const [loading, setLoading] = useState(true);

  const locked = league?.pick_lock_status === 'locked';

  const loadAll = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [{ data: br }, { data: pk }, { data: st }] = await Promise.all([
      supabase.from('playoff_bracket').select('*').eq('league_id', leagueId).eq('user_id', userId),
      supabase.from('user_picks_playoff').select('playoff_game_id, picked_winner_id').eq('league_id', leagueId).eq('user_id', userId),
      supabase.from('predicted_standings').select('team_id, conference_seed, is_division_winner').eq('league_id', leagueId).eq('user_id', userId),
    ]);
    setRows(br ?? []);
    setPicks(Object.fromEntries((pk ?? []).map((p) => [p.playoff_game_id, p.picked_winner_id])));
    setStandings(st ?? []);
    setLoading(false);
  }, [leagueId, userId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const seed1 = useMemo(() => {
    const out = {};
    for (const s of standings) {
      if (s.conference_seed === 1) {
        const conf = teamsById[s.team_id]?.conference;
        if (conf) out[conf] = s.team_id;
      }
    }
    return out;
  }, [standings, teamsById]);

  const bracket = useMemo(() => computeBracket(rows, picks, seed1), [rows, picks, seed1]);

  const handlePick = async (gameId, teamId) => {
    if (locked) return;
    const next = { ...picks, [gameId]: teamId };
    const recomputed = computeBracket(rows, next, seed1);
    const allowed = {};
    for (const g of allGames(recomputed)) allowed[g.id] = [g.team1Id, g.team2Id].filter(Boolean);
    const invalid = Object.keys(next).filter(
      (gid) => gid !== gameId && next[gid] && allowed[gid] && !allowed[gid].includes(next[gid])
    );
    for (const gid of invalid) delete next[gid];
    setPicks(next);
    await supabase.from('user_picks_playoff').upsert(
      { league_id: leagueId, user_id: userId, playoff_game_id: gameId, picked_winner_id: teamId },
      { onConflict: 'league_id,user_id,playoff_game_id' }
    );
    if (invalid.length) {
      await supabase.from('user_picks_playoff').delete()
        .eq('league_id', leagueId).eq('user_id', userId).in('playoff_game_id', invalid);
    }
  };

  if (loading) return <p className="text-slate-500">Loading bracket…</p>;

  if (!rows.length) {
    return (
      <div className="card p-6">
        <p className="font-semibold text-slate-900">No bracket yet</p>
        <p className="mt-1 text-sm text-slate-500">
          Finish your picks and generate the bracket from the Standings page first.
        </p>
        <Link to={`/league/${leagueId}/standings`} className="btn-primary mt-4 inline-flex">
          Go to Standings →
        </Link>
      </div>
    );
  }

  const Column = ({ title, games, labels }) => (
    <div className="flex flex-col justify-around gap-3">
      <div className="text-center text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</div>
      {games.map((g, i) => (
        <BracketGame key={g.id} game={g} teamsById={teamsById} locked={locked} onPick={handlePick} label={labels?.[i]} />
      ))}
    </div>
  );

  const champId = bracket.sb?.pickedId;
  const champ = champId ? teamsById[champId] : null;
  const divWinners = standings.filter((s) => s.is_division_winner).map((s) => teamsById[s.team_id]).filter(Boolean);

  return (
    <div>
      <div className="flex items-end gap-6 overflow-x-auto pb-4">
        <Column title="AFC Wild Card" games={bracket.AFC.wc} />
        <Column title="AFC Divisional" games={bracket.AFC.div} />
        <Column title="AFC Champ" games={bracket.AFC.conf ? [bracket.AFC.conf] : []} />

        <div className="flex flex-col items-center gap-2 px-2">
          <div className="text-center text-[10px] font-bold uppercase tracking-wide text-amber-600">
            Super Bowl
          </div>
          {bracket.sb && <BracketGame game={bracket.sb} teamsById={teamsById} locked={locked} onPick={handlePick} />}
          {champ && (
            <div className="mt-1 flex flex-col items-center">
              <span className="text-[10px] uppercase tracking-wide text-amber-600">Champion</span>
              <TeamHelmet team={champ} size={56} />
            </div>
          )}
        </div>

        <Column title="NFC Champ" games={bracket.NFC.conf ? [bracket.NFC.conf] : []} />
        <Column title="NFC Divisional" games={bracket.NFC.div} />
        <Column title="NFC Wild Card" games={bracket.NFC.wc} />
      </div>

      {champ && (
        <div className="card mt-6 p-5">
          <h3 className="text-lg font-extrabold text-slate-900">Prediction Summary</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-3">
            <Summary label="Super Bowl Champion" team={champ} big />
            <Summary label="AFC Champion" team={teamsById[bracket.AFC.conf?.pickedId]} />
            <Summary label="NFC Champion" team={teamsById[bracket.NFC.conf?.pickedId]} />
          </div>
          <div className="mt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Division Winners</div>
            <div className="mt-2 flex flex-wrap gap-3">
              {divWinners.map((t) => (
                <div key={t.id} className="flex flex-col items-center">
                  <TeamHelmet team={t} size={40} />
                  <span className="text-[10px] text-slate-400">{t.abbreviation}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs text-slate-400">
            Regular-season pick accuracy will appear here once the season starts.
          </p>
        </div>
      )}
    </div>
  );
}

function Summary({ label, team, big }) {
  return (
    <div className="flex items-center gap-3">
      {team ? <TeamHelmet team={team} size={big ? 56 : 44} /> : <div className="h-11 w-11 rounded-full bg-slate-100" />}
      <div>
        <div className="text-[10px] uppercase tracking-wide text-slate-400">{label}</div>
        <div className="font-bold text-slate-900">{team ? `${team.city} ${team.name}` : '—'}</div>
      </div>
    </div>
  );
}
