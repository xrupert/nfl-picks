import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLeagueStore } from '../store/leagueStore';
import { supabase } from '../lib/supabase';

function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={copy}
      className="rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-50 active:bg-slate-100"
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
}

function Countdown({ lockedAt }) {
  const [diff, setDiff] = useState(null);

  useEffect(() => {
    if (!lockedAt) return;
    const update = () => {
      const ms = new Date(lockedAt) - Date.now();
      setDiff(ms);
    };
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [lockedAt]);

  if (diff === null || diff <= 0) return null;

  const totalSec = Math.floor(diff / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;

  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
      <span className="text-base">⏱</span>
      <span className="font-semibold">Locks in</span>
      <span className="tabular-nums">
        {d > 0 && `${d}d `}{String(h).padStart(2, '0')}:{String(m).padStart(2, '0')}:{String(s).padStart(2, '0')}
      </span>
    </div>
  );
}

export default function LeagueSettings() {
  const { leagueId } = useParams();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const league = useLeagueStore((s) => s.league);
  const members = useLeagueStore((s) => s.members);
  const isCommissioner = useLeagueStore((s) => s.isCommissioner);
  const setLocked = useLeagueStore((s) => s.setLocked);
  const setUnlocked = useLeagueStore((s) => s.setUnlocked);

  const [lockDate, setLockDate] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [memberPicks, setMemberPicks] = useState({});

  const isComm = isCommissioner(userId);
  const locked = league?.pick_lock_status === 'locked';

  // Load pick counts per member
  useEffect(() => {
    if (!leagueId || !members.length) return;
    supabase
      .from('user_picks_regular')
      .select('user_id')
      .eq('league_id', leagueId)
      .then(({ data }) => {
        if (!data) return;
        const counts = {};
        for (const row of data) {
          counts[row.user_id] = (counts[row.user_id] ?? 0) + 1;
        }
        setMemberPicks(counts);
      });
  }, [leagueId, members]);

  const flash = (text) => {
    setMsg(text);
    setTimeout(() => setMsg(''), 3000);
  };

  const handleLock = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('leagues')
      .update({ pick_lock_status: 'locked', locked_at: new Date().toISOString() })
      .eq('id', leagueId);
    setSaving(false);
    if (error) { flash('Error: ' + error.message); return; }
    setLocked();
    flash('Picks locked.');
  };

  const handleUnlock = async () => {
    setSaving(true);
    const { error } = await supabase
      .from('leagues')
      .update({ pick_lock_status: 'open', locked_at: null })
      .eq('id', leagueId);
    setSaving(false);
    if (error) { flash('Error: ' + error.message); return; }
    setUnlocked();
    flash('Picks unlocked.');
  };

  const handleScheduleLock = async () => {
    if (!lockDate) return;
    setSaving(true);
    const { error } = await supabase
      .from('leagues')
      .update({ locked_at: new Date(lockDate).toISOString() })
      .eq('id', leagueId);
    setSaving(false);
    if (error) { flash('Error: ' + error.message); return; }
    flash('Lock time saved.');
  };

  const inviteUrl = `${window.location.origin}/join/${league?.invite_code}`;

  if (!league) return <p className="text-slate-500">Loading…</p>;

  return (
    <div className="space-y-6">
      {/* League info */}
      <div className="card p-5">
        <h2 className="text-xl font-extrabold text-slate-900">{league.name}</h2>
        <p className="mt-0.5 text-sm text-slate-500">Season {league.season_year} · {members.length} / {league.max_members} members</p>

        <div className="mt-4 space-y-2">
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invite code</p>
              <p className="mt-0.5 font-mono text-lg font-bold tracking-widest text-slate-900">{league.invite_code}</p>
            </div>
            <CopyButton text={league.invite_code} />
          </div>
          <div className="flex items-center justify-between rounded-lg bg-slate-50 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Invite link</p>
              <p className="mt-0.5 truncate text-xs text-slate-600">{inviteUrl}</p>
            </div>
            <div className="ml-3 shrink-0">
              <CopyButton text={inviteUrl} />
            </div>
          </div>
        </div>
      </div>

      {/* Pick lock status */}
      {isComm && (
        <div className="card p-5">
          <h3 className="font-semibold text-slate-900">Pick Lock</h3>

          <div className="mt-3 flex items-center gap-3">
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold ${locked ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
              <span className={`h-2 w-2 rounded-full ${locked ? 'bg-red-500' : 'bg-emerald-500'}`} />
              {locked ? 'Locked' : 'Open'}
            </span>

            {locked ? (
              <button onClick={handleUnlock} disabled={saving} className="btn-secondary text-sm">
                Unlock picks
              </button>
            ) : (
              <button onClick={handleLock} disabled={saving} className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600 disabled:opacity-40">
                Lock picks now
              </button>
            )}
          </div>

          {!locked && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-sm font-medium text-slate-700">Schedule auto-lock</p>
              <div className="mt-2 flex gap-2">
                <input
                  type="datetime-local"
                  value={lockDate}
                  onChange={(e) => setLockDate(e.target.value)}
                  className="input max-w-xs text-sm"
                />
                <button onClick={handleScheduleLock} disabled={!lockDate || saving} className="btn-primary text-sm">
                  Save
                </button>
              </div>
              {league.locked_at && !locked && (
                <div className="mt-3">
                  <Countdown lockedAt={league.locked_at} />
                </div>
              )}
            </div>
          )}

          {msg && (
            <p className={`mt-3 text-sm font-medium ${msg.startsWith('Error') ? 'text-red-500' : 'text-emerald-600'}`}>
              {msg}
            </p>
          )}
        </div>
      )}

      {/* Scoring */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900">How Points Are Scored</h3>
        <div className="mt-3 space-y-3">
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

      {/* Members */}
      <div className="card p-5">
        <h3 className="font-semibold text-slate-900">Members</h3>
        <ul className="mt-3 space-y-2">
          {members.map((m) => {
            const count = memberPicks[m.user_id] ?? 0;
            const pct = Math.round((count / 272) * 100);
            return (
              <li key={m.user_id} className="flex items-center gap-3 rounded-lg p-2.5 hover:bg-slate-50">
                {m.avatar_url ? (
                  <img
                    src={m.avatar_url}
                    alt={m.username}
                    className="h-9 w-9 shrink-0 rounded-full object-cover ring-1 ring-slate-200"
                  />
                ) : (
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 font-bold text-emerald-700">
                    {m.username[0].toUpperCase()}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-slate-900">{m.username}</span>
                    {league.commissioner_id === m.user_id && (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">Commissioner</span>
                    )}
                    {m.user_id === userId && (
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">You</span>
                    )}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-xs text-slate-400">{count} / 272 picks</span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
