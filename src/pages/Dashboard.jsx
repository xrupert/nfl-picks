import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { fetchMyLeagues } from '../lib/leagues';

const TOTAL_GAMES = 272;

export default function Dashboard() {
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;
  const [leagues, setLeagues] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      try {
        setLeagues(await fetchMyLeagues(userId));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [userId]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-extrabold text-slate-900">Your Leagues</h1>
        <Link to="/create-league" className="btn-primary">+ New League</Link>
      </div>

      {loading && <p className="mt-8 text-slate-500">Loading your leagues…</p>}
      {error && <p className="mt-8 text-red-500">{error}</p>}

      {!loading && !error && leagues.length === 0 && (
        <div className="card mt-8 p-8 text-center">
          <p className="text-lg font-semibold text-slate-900">No leagues yet</p>
          <p className="mt-1 text-slate-500">
            Create a league and invite friends, or join one with an invite code.
          </p>
          <Link to="/create-league" className="btn-primary mt-4 inline-flex">
            Create your first league
          </Link>
        </div>
      )}

      <div className="mt-6 grid gap-4 sm:grid-cols-2">
        {leagues.map((l) => {
          const complete = l.picksMade >= TOTAL_GAMES;
          const locked = l.pick_lock_status === 'locked';
          return (
            <div key={l.id} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">{l.name}</h2>
                  <p className="text-sm text-slate-500">
                    {l.season_year} · {l.memberCount}/{l.max_members} members
                  </p>
                </div>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                    locked
                      ? 'bg-amber-100 text-amber-700'
                      : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {locked ? 'Locked' : 'Open'}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Picks:{' '}
                  <span className="font-semibold text-slate-900">{l.picksMade}</span>
                  /{TOTAL_GAMES}
                </span>
                {l.score && (
                  <span className="text-slate-500">
                    Score:{' '}
                    <span className="font-bold text-emerald-600">{l.score.total_points}</span>
                  </span>
                )}
              </div>

              <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
                <div
                  className="h-full bg-emerald-500 transition-all"
                  style={{ width: `${Math.min(100, (l.picksMade / TOTAL_GAMES) * 100)}%` }}
                />
              </div>

              <div className="mt-4 flex gap-2">
                {!locked && !complete && (
                  <Link to={`/league/${l.id}/picks`} className="btn-primary flex-1 text-sm">
                    Continue Picks
                  </Link>
                )}
                {(locked || complete) && (
                  <Link to={`/league/${l.id}/picks`} className="btn-secondary flex-1 text-sm">
                    View Picks
                  </Link>
                )}
                <Link to={`/league/${l.id}/leaderboard`} className="btn-secondary flex-1 text-sm">
                  Leaderboard
                </Link>
              </div>
            </div>
          );
        })}
      </div>

      {!loading && leagues.length > 0 && (
        <div className="mt-4 text-center">
          <Link to="/join-league" className="text-sm text-slate-500 hover:text-emerald-600 hover:underline">
            Have an invite code? Join a league →
          </Link>
        </div>
      )}
    </div>
  );
}
