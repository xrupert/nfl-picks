import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLeagueStore } from '../store/leagueStore';
import { supabase } from '../lib/supabase';

function Medal({ rank }) {
  if (rank === 1) return <span className="text-xl">🥇</span>;
  if (rank === 2) return <span className="text-xl">🥈</span>;
  if (rank === 3) return <span className="text-xl">🥉</span>;
  return (
    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-sm font-bold text-slate-500">
      {rank}
    </span>
  );
}

function StatPill({ label, value, accent }) {
  return (
    <div className={`rounded-lg px-2.5 py-1 text-center ${accent ?? 'bg-slate-100'}`}>
      <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="text-sm font-bold text-slate-900">{value}</p>
    </div>
  );
}

export default function Leaderboard() {
  const { leagueId } = useParams();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const members = useLeagueStore((s) => s.members);

  const [scores, setScores] = useState([]);
  const [pickCounts, setPickCounts] = useState({});
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: sc }, { data: picks }] = await Promise.all([
      supabase.from('scoring').select('*').eq('league_id', leagueId),
      supabase.from('user_picks_regular').select('user_id').eq('league_id', leagueId),
    ]);

    const counts = {};
    for (const p of picks ?? []) counts[p.user_id] = (counts[p.user_id] ?? 0) + 1;
    setPickCounts(counts);
    setScores(sc ?? []);
    setLoading(false);
  };

  useEffect(() => {
    if (leagueId) load();
  }, [leagueId]);

  // Live updates via Supabase Realtime
  useEffect(() => {
    if (!leagueId) return;
    const channel = supabase
      .channel(`scoring-${leagueId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'scoring', filter: `league_id=eq.${leagueId}` },
        (payload) => {
          setScores((prev) => {
            const idx = prev.findIndex((s) => s.user_id === payload.new.user_id);
            if (idx === -1) return [...prev, payload.new];
            const next = [...prev];
            next[idx] = payload.new;
            return next;
          });
        })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [leagueId]);

  // Build ranked rows — merge members + scores
  const rows = members
    .map((m) => {
      const sc = scores.find((s) => s.user_id === m.user_id);
      return {
        ...m,
        total_points: sc?.total_points ?? 0,
        regular_correct: sc?.regular_picks_correct ?? 0,
        regular_total: sc?.regular_picks_total ?? 0,
        picks_submitted: pickCounts[m.user_id] ?? 0,
        sc,
      };
    })
    .sort((a, b) => b.total_points - a.total_points || b.picks_submitted - a.picks_submitted);

  const seasonStarted = rows.some((r) => r.regular_total > 0);

  if (loading) return <p className="text-slate-500">Loading leaderboard…</p>;

  return (
    <div className="space-y-4">
      {!seasonStarted && (
        <div className="card p-4">
          <p className="text-sm text-slate-500">
            The 2026 NFL season hasn't started yet — scores will appear here once games are played.
            Picks submitted are shown so everyone knows where they stand heading in.
          </p>
        </div>
      )}

      <div className="space-y-3">
        {rows.map((row, i) => {
          const rank = i + 1;
          const isMe = row.user_id === userId;
          const acc = row.regular_total > 0
            ? `${Math.round((row.regular_correct / row.regular_total) * 100)}%`
            : '—';

          return (
            <div
              key={row.user_id}
              className={`card flex items-center gap-4 p-4 ${isMe ? 'ring-2 ring-emerald-400' : ''}`}
            >
              {/* Rank */}
              <div className="flex w-8 shrink-0 justify-center">
                <Medal rank={rank} />
              </div>

              {/* Avatar + name */}
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full font-bold ${isMe ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-600'}`}>
                  {row.username[0].toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="font-semibold text-slate-900">{row.username}</span>
                    {isMe && (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">You</span>
                    )}
                  </div>
                  {!seasonStarted && (
                    <p className="text-xs text-slate-400">{row.picks_submitted} / 272 picks submitted</p>
                  )}
                  {seasonStarted && (
                    <p className="text-xs text-slate-400">
                      {row.regular_correct}/{row.regular_total} correct · {acc} accuracy
                    </p>
                  )}
                </div>
              </div>

              {/* Score */}
              <div className="shrink-0 text-right">
                <p className="text-2xl font-extrabold tabular-nums text-slate-900">{row.total_points}</p>
                <p className="text-xs text-slate-400">pts</p>
              </div>

              {/* Breakdown — only show once season starts */}
              {seasonStarted && row.sc && (
                <div className="hidden shrink-0 gap-1.5 sm:flex">
                  {row.sc.wildcard_correct > 0 && <StatPill label="WC" value={row.sc.wildcard_correct} accent="bg-blue-50" />}
                  {row.sc.divisional_correct > 0 && <StatPill label="DIV" value={row.sc.divisional_correct} accent="bg-purple-50" />}
                  {row.sc.conf_championship_correct > 0 && <StatPill label="CCG" value={row.sc.conf_championship_correct} accent="bg-amber-50" />}
                  {row.sc.superbowl_correct > 0 && <StatPill label="SB" value={row.sc.superbowl_correct} accent="bg-emerald-50" />}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="card p-4">
        <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-400">How Points Are Scored</h3>
        <div className="space-y-2">
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Regular Season</p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded bg-slate-100 px-2 py-1">Correct game pick <b>1 pt</b></span>
              <span className="rounded bg-slate-100 px-2 py-1">Division winner <b>5 pts</b></span>
              <span className="rounded bg-slate-100 px-2 py-1">Correct playoff seed <b>2 pts</b></span>
            </div>
          </div>
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Playoffs</p>
            <div className="flex flex-wrap gap-2 text-xs text-slate-600">
              <span className="rounded bg-blue-50 px-2 py-1">Wild Card correct <b>3 pts</b></span>
              <span className="rounded bg-purple-50 px-2 py-1">Divisional correct <b>5 pts</b></span>
              <span className="rounded bg-amber-50 px-2 py-1">Conf Champ correct <b>8 pts</b></span>
              <span className="rounded bg-emerald-50 px-2 py-1">Super Bowl correct <b>15 pts</b></span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
