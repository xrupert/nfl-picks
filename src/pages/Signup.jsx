import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import AuthCard from '../components/AuthCard';

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setNotice(null);

    const uname = username.trim();
    if (uname.length < 3) { setError('Username must be at least 3 characters.'); return; }

    setBusy(true);

    const { data: existing } = await supabase
      .from('profiles')
      .select('id')
      .eq('username', uname)
      .maybeSingle();
    if (existing) { setBusy(false); setError('That username is taken. Try another.'); return; }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { username: uname },
        emailRedirectTo: `${window.location.origin}${next}`,
      },
    });
    setBusy(false);

    if (error) { setError(error.message); return; }

    if (data.session) {
      navigate(next, { replace: true });
    } else {
      setNotice('Account created! Check your email to confirm, then sign in.');
    }
  };

  return (
    <AuthCard title="Create your account" subtitle="Pick all 272 games. Beat your friends.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
        <label className="text-sm font-medium text-slate-700">
          Username
          <input
            type="text"
            required
            minLength={3}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="input mt-1"
            placeholder="gridiron_guru"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Email
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="input mt-1"
            placeholder="you@example.com"
          />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Password
          <input
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mt-1"
            placeholder="At least 6 characters"
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}
        {notice && <p className="text-sm text-emerald-600">{notice}</p>}

        <button type="submit" disabled={busy} className="btn-primary mt-1">
          {busy ? 'Creating…' : 'Create account'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-emerald-600 hover:underline">
          Sign in
        </Link>
      </p>
    </AuthCard>
  );
}
