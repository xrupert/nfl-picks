import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
    if (!userId) return;
    (async () => {
      try {
        const l = await fetchLeagueByInvite(inviteCode, userId);
        if (!l) setError('No league found for this invite link.');
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
      <h1 className="text-2xl font-extrabold">Join a League</h1>

      {loading && <p className="mt-6 text-white/50">Looking up invite…</p>}

      {!loading && error && !league && (
        <div className="card mt-6 border-red-500/40 p-6 text-red-300">{error}</div>
      )}

      {league && (
        <div className="card mt-6 p-6">
          <h2 className="text-xl font-bold">{league.name}</h2>
          <p className="mt-1 text-white/50">
            {league.season_year} · {league.memberCount}/{league.max_members} members
          </p>

          {league.alreadyMember ? (
            <>
              <p className="mt-4 text-emerald-400">You're already in this league.</p>
              <button
                onClick={() => navigate(`/league/${league.id}/picks`)}
                className="btn-primary mt-4 w-full"
              >
                Go to picks →
              </button>
            </>
          ) : full ? (
            <p className="mt-4 text-amber-300">This league is full ({league.max_members} members).</p>
          ) : locked ? (
            <p className="mt-4 text-amber-300">
              Picks are locked — this league is no longer accepting new members.
            </p>
          ) : (
            <>
              {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
              <button onClick={handleJoin} disabled={busy} className="btn-primary mt-4 w-full">
                {busy ? 'Joining…' : 'Join League'}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
