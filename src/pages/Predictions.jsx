import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useLeagueStore } from '../store/leagueStore';
import { useTeamsStore, DIVISION_ORDER, divisionKey } from '../store/teamsStore';
import { supabase } from '../lib/supabase';

function TeamCell({ teamId, teamsById, highlight }) {
  const team = teamId ? teamsById[teamId] : null;
  if (!team) return <span className="text-slate-300 text-xs">—</span>;
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span className={`text-sm font-bold ${highlight ? 'text-amber-700' : 'text-slate-800'}`}>
        {team.abbreviation}
      </span>
      <span className="text-[10px] leading-none text-slate-400">{team.city}</span>
    </div>
  );
}

function Avatar({ member }) {
  if (member.avatar_url) {
    return (
      <img src={member.avatar_url} alt={member.username}
        className="h-8 w-8 rounded-full object-cover ring-1 ring-slate-200" />
    );
  }
  return (
    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-xs font-bold text-emerald-700">
      {member.username[0].toUpperCase()}
    </div>
  );
}

const GROUPS = [
  {
    label: 'NFC Divisions',
    bg: 'bg-blue-50/60',
    rows: DIVISION_ORDER
      .filter((d) => d.conference === 'NFC')
      .map((d) => ({ key: divisionKey(d.conference, d.division), label: `NFC ${d.division}`, type: 'division' })),
  },
  {
    label: 'AFC Divisions',
    bg: 'bg-red-50/60',
    rows: DIVISION_ORDER
      .filter((d) => d.conference === 'AFC')
      .map((d) => ({ key: divisionKey(d.conference, d.division), label: `AFC ${d.division}`, type: 'division' })),
  },
  {
    label: 'Conference Champions',
    bg: 'bg-purple-50/60',
    rows: [
      { key: 'AFC', label: 'AFC Champion', type: 'conf', conf: 'AFC' },
      { key: 'NFC', label: 'NFC Champion', type: 'conf', conf: 'NFC' },
    ],
  },
  {
    label: 'Super Bowl',
    bg: 'bg-amber-50',
    rows: [{ key: 'SUPERBOWL', label: '🏆 Super Bowl Winner', type: 'sb' }],
  },
];

export default function Predictions() {
  const { leagueId } = useParams();
  const members = useLeagueStore((s) => s.members);
  const teamsById = useTeamsStore((s) => s.byId);
  const teams = useTeamsStore((s) => s.teams);

  const [divPicks, setDivPicks] = useState({});   // { userId: { 'AFC North': teamId } }
  const [confPicks, setConfPicks] = useState({}); // { userId: { AFC: teamId, NFC: teamId } }
  const [sbPicks, setSbPicks] = useState({});     // { userId: teamId }
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!leagueId || !teams.length) return;

    (async () => {
      // Division winner picks
      const { data: standings } = await supabase
        .from('predicted_standings')
        .select('user_id, team_id')
        .eq('league_id', leagueId)
        .eq('is_division_winner', true);

      const divMap = {};
      for (const row of standings ?? []) {
        const team = teamsById[row.team_id];
        if (!team) continue;
        const key = divisionKey(team.conference, team.division);
        if (!divMap[row.user_id]) divMap[row.user_id] = {};
        divMap[row.user_id][key] = row.team_id;
      }

      // Conference Champ + Super Bowl picks
      const { data: bracketRows } = await supabase
        .from('playoff_bracket')
        .select('id, user_id, round, conference')
        .eq('league_id', leagueId)
        .in('round', ['Conference Championship', 'Super Bowl']);

      const bracketIds = (bracketRows ?? []).map((r) => r.id);
      const bracketMap = Object.fromEntries((bracketRows ?? []).map((r) => [r.id, r]));

      const confMap = {};
      const sbMap = {};

      if (bracketIds.length) {
        const { data: ppicks } = await supabase
          .from('user_picks_playoff')
          .select('user_id, playoff_game_id, picked_winner_id')
          .eq('league_id', leagueId)
          .in('playoff_game_id', bracketIds);

        for (const pick of ppicks ?? []) {
          const bracket = bracketMap[pick.playoff_game_id];
          if (!bracket || !pick.picked_winner_id) continue;

          if (bracket.round === 'Super Bowl') {
            sbMap[pick.user_id] = pick.picked_winner_id;
          } else if (bracket.round === 'Conference Championship') {
            if (!confMap[pick.user_id]) confMap[pick.user_id] = {};
            confMap[pick.user_id][bracket.conference] = pick.picked_winner_id;
          }
        }
      }

      setDivPicks(divMap);
      setConfPicks(confMap);
      setSbPicks(sbMap);
      setLoading(false);
    })();
  }, [leagueId, teams]);

  const getTeam = (userId, row) => {
    if (row.type === 'division') return divPicks[userId]?.[row.key] ?? null;
    if (row.type === 'conf') return confPicks[userId]?.[row.conf] ?? null;
    if (row.type === 'sb') return sbPicks[userId] ?? null;
    return null;
  };

  if (loading) return <p className="text-slate-500">Loading predictions…</p>;

  return (
    <div>
      <h2 className="mb-1 text-xl font-extrabold text-slate-900">Everyone's Predictions</h2>
      <p className="mb-4 text-sm text-slate-500">Who picked whom — divisions, conference champions, and the Super Bowl.</p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full">
          {/* Member header row */}
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50">
              <th className="py-3 pl-4 pr-6 text-left text-xs font-bold uppercase tracking-wide text-slate-400 whitespace-nowrap w-36">
                Pick
              </th>
              {members.map((m) => (
                <th key={m.user_id} className="px-3 py-3 text-center min-w-[80px]">
                  <div className="flex flex-col items-center gap-1">
                    <Avatar member={m} />
                    <span className="text-xs font-semibold text-slate-700 whitespace-nowrap leading-tight">
                      {m.username}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {GROUPS.map((group) => (
              <>
                {/* Group header */}
                <tr key={`hdr-${group.label}`} className={group.bg}>
                  <td
                    colSpan={members.length + 1}
                    className="py-1.5 pl-4 text-[10px] font-bold uppercase tracking-widest text-slate-500"
                  >
                    {group.label}
                  </td>
                </tr>

                {/* Rows */}
                {group.rows.map((row) => (
                  <tr
                    key={row.key}
                    className={`border-b border-slate-100 hover:bg-slate-50/70 transition-colors ${row.type === 'sb' ? 'bg-amber-50/40' : ''}`}
                  >
                    <td className={`py-2.5 pl-4 pr-6 text-sm whitespace-nowrap ${row.type === 'sb' ? 'font-bold text-amber-800' : row.type === 'conf' ? 'font-semibold text-slate-700' : 'text-slate-600'}`}>
                      {row.label}
                    </td>
                    {members.map((m) => (
                      <td key={m.user_id} className="px-3 py-2.5 text-center">
                        <TeamCell
                          teamId={getTeam(m.user_id, row)}
                          teamsById={teamsById}
                          highlight={row.type === 'sb'}
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
