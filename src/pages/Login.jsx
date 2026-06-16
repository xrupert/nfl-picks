import { useState } from 'react';
import { Link, useNavigate, Navigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuthStore } from '../store/authStore';
import AuthCard from '../components/AuthCard';

export default function Login() {
  const navigate = useNavigate();
  const session = useAuthStore((s) => s.session);
  const [searchParams] = useSearchParams();
  const next = searchParams.get('next') || '/dashboard';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  if (session) return <Navigate to={next} replace />;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) { setError(error.message); return; }
    navigate(next, { replace: true });
  };

  return (
    <AuthCard title="Welcome back" subtitle="Sign in to make your picks.">
      <form onSubmit={handleSubmit} className="flex flex-col gap-3">
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="input mt-1"
            placeholder="••••••••"
          />
        </label>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button type="submit" disabled={busy} className="btn-primary mt-1">
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      <p className="mt-4 text-center text-sm text-slate-500">
        No account?{' '}
        <Link to={`/signup${next !== '/dashboard' ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-semibold text-emerald-600 hover:underline">
          Create one
        </Link>
      </p>
    </AuthCard>
  );
}
