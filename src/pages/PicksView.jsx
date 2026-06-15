import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLeagueStore } from '../store/leagueStore';
import { useTeamsStore, DIVISION_ORDER } from '../store/teamsStore';
import { usePicksStore } from '../store/picksStore';
import { supabase } from '../lib/supabase';
import TeamHelmet from '../components/TeamHelmet';
import GameCard from '../components/GameCard';

const TOTAL_GAMES = 272;

export default function PicksView() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const league = useLeagueStore((s) => s.league);

  const teams = useTeamsStore((s) => s.teams);
  const teamsById = useTeamsStore((s) => s.byId);

  const load = usePicksStore((s) => s.load);
  const setPick = usePicksStore((s) => s.setPick);
  const getRecord = usePicksStore((s) => s.getRecord);
  const picks = usePicksStore((s) => s.picks);
  const schedule = usePicksStore((s) => s.schedule);
  const loading = usePicksStore((s) => s.loading);
  const saving = usePicksStore((s) => s.saving);
  const lastSavedAt = usePicksStore((s) => s.lastSavedAt);

  const [activeDivision, setActiveDivision] = useState(DIVISION_ORDER[0]);
  const [savedVisible, setSavedVisible] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const locked = league?.pick_lock_status === 'locked';
  const seasonYear = league?.season_year ?? 2026;

  useEffect(() => {
    if (league && userId) load(leagueId, userId, seasonYear);
  }, [league, userId, leagueId, seasonYear, load]);

  useEffect(() => {
    if (!lastSavedAt) return;
    setSavedVisible(true);
    const t = setTimeout(() => setSavedVisible(false), 2000);
    return () => clearTimeout(t);
  }, [lastSavedAt]);

  const teamsByDivision = useMemo(() => {
    const map = {};
    for (const t of teams) {
      const key = `${t.conference} ${t.division}`;
      (map[key] ??= []).push(t);
    }
    return map;
  }, [teams]);

  const activeTeams = teamsByDivision[`${activeDivision.conference} ${activeDivision.division}`] ?? [];
  const activeTeamIds = useMemo(() => new Set(activeTeams.map((t) => t.id)), [activeTeams]);

  const gamesByWeek = useMemo(() => {
    const weeks = {};
    for (const g of schedule) {
      if (!activeTeamIds.has(g.home_team_id) && !activeTeamIds.has(g.away_team_id)) continue;
      (weeks[g.week] ??= []).push(g);
    }
    return weeks;
  }, [schedule, activeTeamIds]);

  const divisionPickStats = useMemo(() => {
    const stats = {};
    for (const d of DIVISION_ORDER) {
      const key = `${d.conference} ${d.division}`;
      const ids = new Set((teamsByDivision[key] ?? []).map((t) => t.id));
      let total = 0;
      let done = 0;
      for (const g of schedule) {
        if (!ids.has(g.home_team_id) && !ids.has(g.away_team_id)) continue;
        total++;
        if (picks[g.id]) done++;
      }
      stats[key] = { total, done };
    }
    return stats;
  }, [schedule, picks, teamsByDivision]);

  const pickedCount = Object.keys(picks).length;
  const allPicked = pickedCount >= TOTAL_GAMES && schedule.length >= TOTAL_GAMES;

  const handlePick = (gameId, teamId) => {
    if (locked) return;
    setPick(gameId, teamId);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    await supabase.rpc('recalculate_standings', { p_league_id: leagueId, p_user_id: userId });
    setSubmitting(false);
    navigate(`/league/${leagueId}/standings`);
  };

  if (loading) return <p className="text-slate-500">Loading games…</p>;

  if (schedule.length === 0) {
    return (
      <div className="card p-6">
        <p className="font-semibold text-slate-900">No schedule loaded for {seasonYear}.</p>
        <p className="mt-1 text-sm text-slate-500">
          Run the seed script (<code className="rounded bg-slate-100 px-1 py-0.5 text-xs">npm run seed</code>) to import the {seasonYear} schedule from ESPN.
        </p>
      </div>
    );
  }

  const weekNumbers = Object.keys(gamesByWeek).map(Number).sort((a, b) => a - b);

  return (
    <div className="flex flex-col gap-5 lg:flex-row">
      {/* Sidebar */}
      <aside className="lg:w-60 lg:shrink-0">
        <div className="card sticky top-20 p-3">
          <div className="mb-3">
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>Progress</span>
              <span className="font-semibold text-slate-900">{pickedCount}/{TOTAL_GAMES}</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div
                className="h-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(100, (pickedCount / TOTAL_GAMES) * 100)}%` }}
              />
            </div>
          </div>

          <ul className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
            {DIVISION_ORDER.map((d) => {
              const key = `${d.conference} ${d.division}`;
              const isActive =
                d.conference === activeDivision.conference && d.division === activeDivision.division;
              const stat = divisionPickStats[key] ?? { total: 0, done: 0 };
              const complete = stat.total > 0 && stat.done === stat.total;
              return (
                <li key={key}>
                  <button
                    onClick={() => setActiveDivision(d)}
                    className={`flex w-full items-center justify-between gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition ${
                      isActive
                        ? 'bg-emerald-50 font-semibold text-emerald-700 ring-1 ring-emerald-200'
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span>{d.conference} {d.division}</span>
                    <span className={`text-[10px] font-semibold ${complete ? 'text-emerald-600' : 'text-slate-400'}`}>
                      {complete ? '✓' : `${stat.done}/${stat.total}`}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {!locked && (
            <button
              onClick={handleSubmit}
              disabled={!allPicked || submitting}
              className="btn-primary mt-4 w-full text-sm"
              title={allPicked ? '' : `Pick all ${TOTAL_GAMES} games first`}
            >
              {submitting ? 'Submitting…' : 'Submit Picks →'}
            </button>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className="min-w-0 flex-1">
        {/* Division team headers */}
        <div className="card mb-4 flex flex-wrap items-center justify-around gap-3 p-4">
          {activeTeams.map((t) => {
            const r = getRecord(t.id);
            return (
              <div key={t.id} className="flex flex-col items-center">
                <TeamHelmet team={t} size={60} />
                <span className="mt-1 text-sm font-bold text-slate-900">{t.abbreviation}</span>
                <span className="text-xs text-slate-400">{r.w}-{r.l}</span>
              </div>
            );
          })}
        </div>

        {locked && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
            Picks are locked. Results appear here as games are played.
          </div>
        )}

        {weekNumbers.map((week) => (
          <section key={week} className="mb-5">
            <h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">
              Week {week}
            </h3>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {gamesByWeek[week].map((g) => (
                <GameCard
                  key={g.id}
                  game={g}
                  teamsById={teamsById}
                  picked={picks[g.id]}
                  locked={locked}
                  getRecord={getRecord}
                  onPick={handlePick}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      {/* Save toast */}
      {(saving || savedVisible) && (
        <div className="fixed bottom-4 right-4 z-30 rounded-full bg-slate-900 px-3 py-1.5 text-xs text-white shadow-lg">
          {saving ? 'Saving…' : '✓ Saved'}
        </div>
      )}
    </div>
  );
}
