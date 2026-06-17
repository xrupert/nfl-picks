import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { joinLeague } from '../lib/leagues';
import TeamHelmet from '../components/TeamHelmet';

const LOGO_HELMET = {
  primary_color: '#10b981',
  secondary_color: '#064e3b',
  tertiary_color: '#ffffff',
  abbreviation: 'NFL',
};

export default function JoinLeague() {
  const { inviteCode } = useParams();
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const userId = session?.user?.id;

  const [league, setLeague] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!inviteCode) return;
    // Use server API so this works even when the user is not logged in (bypasses RLS)
    const params = new URLSearchParams({ code: inviteCode });
    if (userId) params.set('userId', userId);
    (async () => {
      try {
        const res = await fetch(`/api/league-by-invite?${params}`);
        const json = await res.json();
        if (!res.ok) { setError(json.error ?? 'Could not load league.'); }
        else setLeague(json);
      } catch {
        setError('Could not load league info. Please try again.');
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

  const next = encodeURIComponent(`/join/${inviteCode}`);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-emerald-50 px-4 py-10">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center">
          <TeamHelmet team={LOGO_HELMET} size={80} />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            NFL Picks <span className="text-emerald-500">2026</span>
          </h1>
        </div>

        {/* Card */}
        <div className="card p-6 shadow-md">
          {loading && <p className="text-slate-400">Looking up invite…</p>}

          {!loading && error && !league && (
            <>
              <p className="font-semibold text-red-500">{error}</p>
              <p className="mt-1 text-sm text-slate-500">Double-check your invite link and try again.</p>
            </>
          )}

          {league && (
            <>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">You're invited to join</p>
                  <h2 className="mt-0.5 text-2xl font-extrabold text-slate-900">{league.name}</h2>
                  <p className="mt-0.5 text-sm text-slate-500">
                    {league.season_year} · {league.memberCount} / {league.max_members} members
                  </p>
                </div>
                <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${locked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                  {locked ? 'Locked' : 'Open'}
                </span>
              </div>

              <div className="mt-6">
                {/* Not logged in — show auth CTAs */}
                {!userId && (
                  <div className="space-y-3">
                    <Link
                      to={`/signup?next=${next}`}
                      className="btn-primary block w-full text-center"
                    >
                      Create account to join →
                    </Link>
                    <Link
                      to={`/login?next=${next}`}
                      className="block w-full rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-center text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                    >
                      Already have an account? Sign in
                    </Link>
                  </div>
                )}

                {/* Logged in states */}
                {userId && league.alreadyMember && (
                  <>
                    <p className="text-sm font-medium text-emerald-600">You're already in this league.</p>
                    <button
                      onClick={() => navigate(`/league/${league.id}/picks`)}
                      className="btn-primary mt-4 w-full"
                    >
                      Go to picks →
                    </button>
                  </>
                )}

                {userId && !league.alreadyMember && full && (
                  <p className="text-sm text-amber-600">This league is full ({league.max_members} members max).</p>
                )}

                {userId && !league.alreadyMember && !full && locked && (
                  <p className="text-sm text-amber-600">
                    Picks are locked — this league is no longer accepting new members.
                  </p>
                )}

                {userId && !league.alreadyMember && !full && !locked && (
                  <>
                    {error && <p className="mb-3 text-sm text-red-500">{error}</p>}
                    <button onClick={handleJoin} disabled={busy} className="btn-primary w-full">
                      {busy ? 'Joining…' : `Join ${league.name} →`}
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
