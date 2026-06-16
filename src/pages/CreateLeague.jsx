import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { createLeague } from '../lib/leagues';

export default function CreateLeague() {
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const [name, setName] = useState('');
  const [seasonYear, setSeasonYear] = useState(2026);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [created, setCreated] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const league = await createLeague({ name: name.trim(), seasonYear, userId });
      setCreated(league);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const inviteUrl = created ? `${window.location.origin}/join/${created.invite_code}` : '';

  const copyInvite = async () => {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  if (created) {
    return (
      <div className="mx-auto max-w-lg">
        <div className="card p-6 text-center">
          <div className="text-3xl">🎉</div>
          <h1 className="mt-2 text-2xl font-extrabold text-slate-900">{created.name} is live!</h1>
          <p className="mt-1 text-slate-500">Share this invite link with your league members.</p>

          <div className="mt-5 flex items-center gap-2">
            <input readOnly value={inviteUrl} className="input font-mono text-sm" />
            <button onClick={copyInvite} className="btn-primary whitespace-nowrap">
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-400">
            Invite code: <span className="font-mono font-semibold text-slate-600">{created.invite_code}</span>
          </p>

          <button
            onClick={() => navigate(`/league/${created.id}/picks`)}
            className="btn-primary mt-6 w-full"
          >
            Start making picks →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-2xl font-extrabold text-slate-900">Create a League</h1>
      <form onSubmit={handleSubmit} className="card mt-5 flex flex-col gap-4 p-6">
        <label className="text-sm font-medium text-slate-700">
          League name
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input mt-1"
            placeholder="The Couch Coaches"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Season year
          <input
            type="number"
            value={seasonYear}
            onChange={(e) => setSeasonYear(parseInt(e.target.value, 10) || 2026)}
            className="input mt-1"
            min={2024}
            max={2030}
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={busy || !name.trim()} className="btn-primary">
          {busy ? 'Creating…' : 'Create League'}
        </button>
      </form>
    </div>
  );
}
