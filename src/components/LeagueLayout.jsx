import { useEffect } from 'react';
import { Outlet, NavLink, useParams } from 'react-router-dom';
import { useLeagueStore } from '../store/leagueStore';
import { useAuthStore } from '../store/authStore';

const tabClass = ({ isActive }) =>
  `whitespace-nowrap rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
    isActive
      ? 'bg-emerald-500 text-white shadow-sm'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
  }`;

export default function LeagueLayout() {
  const { leagueId } = useParams();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const league = useLeagueStore((s) => s.league);
  const loading = useLeagueStore((s) => s.loading);
  const error = useLeagueStore((s) => s.error);
  const loadLeague = useLeagueStore((s) => s.loadLeague);
  const isCommissioner = useLeagueStore((s) => s.isCommissioner);

  useEffect(() => {
    loadLeague(leagueId);
  }, [leagueId, loadLeague]);

  if (loading && !league) return <p className="text-slate-500">Loading league…</p>;
  if (error) return <p className="text-red-500">{error}</p>;
  if (!league) return null;

  const locked = league.pick_lock_status === 'locked';

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900">{league.name}</h1>
          <p className="text-sm text-slate-500">
            {league.season_year} ·{' '}
            <span className={locked ? 'font-semibold text-amber-600' : 'font-semibold text-emerald-600'}>
              {locked ? 'Locked' : 'Open'}
            </span>
          </p>
        </div>
      </div>

      <nav className="mt-4 flex gap-1 overflow-x-auto border-b border-slate-200 pb-3 scrollbar-none [-webkit-overflow-scrolling:touch]">
        <NavLink to={`/league/${leagueId}/picks`} className={tabClass}>
          Picks
        </NavLink>
        <NavLink to={`/league/${leagueId}/standings`} className={tabClass}>
          Standings
        </NavLink>
        <NavLink to={`/league/${leagueId}/playoffs`} className={tabClass}>
          Playoffs
        </NavLink>
        <NavLink to={`/league/${leagueId}/leaderboard`} className={tabClass}>
          Leaderboard
        </NavLink>
        <NavLink to={`/league/${leagueId}/predictions`} className={tabClass}>
          Predictions
        </NavLink>
        <NavLink to={`/league/${leagueId}/chat`} className={tabClass}>
          Chat
        </NavLink>
        <NavLink to={`/league/${leagueId}/settings`} className={tabClass}>
          Settings
        </NavLink>
      </nav>

      <div className="mt-5">
        <Outlet />
      </div>
    </div>
  );
}
