import TeamHelmet from './TeamHelmet';

const DEMO_HELMET = {
  primary_color: '#10b981',
  secondary_color: '#064e3b',
  tertiary_color: '#ffffff',
  abbreviation: 'NFL',
};

export default function AuthCard({ title, subtitle, children }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-100 via-white to-emerald-50 px-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex flex-col items-center">
          <TeamHelmet team={DEMO_HELMET} size={96} />
          <h1 className="mt-3 text-2xl font-extrabold tracking-tight text-slate-900">
            NFL Picks <span className="text-emerald-500">2026</span>
          </h1>
        </div>
        <div className="card p-6 shadow-md">
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </div>
  );
}
