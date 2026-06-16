import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { fetchLeagueByInvite, joinLeague } from '../lib/leagues';

export default function JoinLeague() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.session?.user?.id);

  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!userId || !inviteCode) return;
    (async () => {
      try {
        const l = await fetchLeagueByInvite(inviteCode, userId);
        if (!l) setError('No league found for this invite code.');
        else setLeague(l);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [inviteCode, userId]);

  const full = league && league.memberCount >= league.max_members;
  const locked = league && league.pick_lock_status === 'locked';

  const handleJoin = async () => {
    setBusy(true);
    setError(null);
    try {
      await joinLeague({ leagueId: league.id, userId });
      navigate(`/league/${league.id}/picks`);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-extrabold text-slate-900">Join a League</h1>

      {loading && <p className="mt-6 text-slate-400">Looking up invite…</p>}

      {!loading && error && !league && (
        <div className="card mt-6 p-6">
          <p className="font-semibold text-red-500">{error}</p>
          <p className="mt-1 text-sm text-slate-500">Double-check your invite link and try again.</p>
        </div>
      )}

      {league && (
        <div className="card mt-6 p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold text-slate-900">{league.name}</h2>
              <p className="mt-0.5 text-sm text-slate-500">
                {league.season_year} · {league.memberCount} / {league.max_members} members
              </p>
            </div>
            <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${locked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              {locked ? 'Locked' : 'Open'}
            </span>
          </div>

          {league.alreadyMember ? (
            <>
              <p className="mt-4 text-sm font-medium text-emerald-600">You're already in this league.</p>
              <button
                onClick={() => navigate(`/league/${league.id}/picks`)}
                className="btn-primary mt-4 w-full"
              >
                Go to picks →
              </button>
            </>
          ) : full ? (
            <p className="mt-4 text-sm text-amber-600">This league is full ({league.max_members} members max).</p>
          ) : locked ? (
            <p className="mt-4 text-sm text-amber-600">
              Picks are locked — this league is no longer accepting new members.
            </p>
          ) : (
            <>
              {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
              <button onClick={handleJoin} disabled={busy} className="btn-primary mt-6 w-full">
                {busy ? 'Joining…' : `Join ${league.name} →`}
              </button>
            </>
          )}
        </div>
      )}

      <p className="mt-6 text-center text-sm text-slate-400">
        Need an account?{' '}
        <Link to={`/signup?next=${encodeURIComponent(`/join/${inviteCode}`)}`} className="font-semibold text-emerald-600 hover:underline">
          Create one first
        </Link>
      </p>
    </div>
  );
}
