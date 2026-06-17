import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { fetchMyLeagues } from '../lib/leagues';

const TOTAL_GAMES = 272;

function JoinByCode() {
  const navigate = useNavigate();
  const [code, setCode] = useState('');

  const handleJoin = (e) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (trimmed) navigate(`/join/${trimmed}`);
  };

  return (
    <form onSubmit={handleJoin} className="flex gap-2">
      <input
        value={code}
        onChange={(e) => setCode(e.target.value)}
        placeholder="Enter invite code"
        className="input flex-1"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
      />
      <button type="submit" disabled={!code.trim()} className="btn-primary shrink-0">
        Join
      </button>
    </form>
  );
}

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
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {/* Join with code — shown first since most new users are joining, not creating */}
          <div className="card p-6">
            <p className="text-lg font-bold text-slate-900">Have an invite code?</p>
            <p className="mt-1 text-sm text-slate-500">Enter the code your league commissioner sent you.</p>
            <div className="mt-4">
              <JoinByCode />
            </div>
          </div>

          <div className="card p-6">
            <p className="text-lg font-bold text-slate-900">Start a new league</p>
            <p className="mt-1 text-sm text-slate-500">Create a league and invite your friends.</p>
            <Link to="/create-league" className="btn-primary mt-4 inline-flex">
              Create a league
            </Link>
          </div>
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
                    locked ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}
                >
                  {locked ? 'Locked' : 'Open'}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between text-sm">
                <span className="text-slate-500">
                  Picks: <span className="font-semibold text-slate-900">{l.picksMade}</span>/{TOTAL_GAMES}
                </span>
                {l.score && (
                  <span className="text-slate-500">
                    Score: <span className="font-bold text-emerald-600">{l.score.total_points}</span>
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
        <div className="card mt-6 p-5">
          <p className="text-sm font-semibold text-slate-700">Join another league</p>
          <div className="mt-3">
            <JoinByCode />
          </div>
        </div>
      )}
    </div>
  );
}
