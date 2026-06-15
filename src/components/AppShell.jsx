import { Outlet, Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export default function AppShell() {
  const profile = useAuthStore((s) => s.profile);
  const session = useAuthStore((s) => s.session);
  const signOut = useAuthStore((s) => s.signOut);
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const displayName = profile?.username ?? session?.user?.email ?? 'You';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Dark sticky header — visual anchor for the app */}
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-900 shadow-sm backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link to="/dashboard" className="flex items-center gap-2 font-extrabold tracking-tight text-white">
            <span className="text-lg">🏈</span>
            <span>
              NFL Picks <span className="text-emerald-400">2026</span>
            </span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-white/60 sm:inline">{displayName}</span>
            <button
              onClick={handleSignOut}
              className="inline-flex items-center justify-center rounded-lg border border-white/20 bg-white/5 px-3 py-1.5 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
