import { useEffect } from 'react';
import { useTeamsStore, DIVISION_ORDER } from '../store/teamsStore';
import TeamHelmet from '../components/TeamHelmet';

export default function HelmetShowcase() {
  const teams = useTeamsStore((s) => s.teams);
  const loadTeams = useTeamsStore((s) => s.loadTeams);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-10">
      <h1 className="text-3xl font-extrabold text-slate-900">
        Team Showcase <span className="text-emerald-600">— all 32</span>
      </h1>
      <p className="mt-1 text-slate-500">Cartoon mascot icons · team colors.</p>

      {DIVISION_ORDER.map((d) => {
        const list = teams
          .filter((t) => t.conference === d.conference && t.division === d.division)
          .sort((a, b) => a.city.localeCompare(b.city));
        return (
          <section key={`${d.conference} ${d.division}`} className="mt-8">
            <h2 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">
              {d.conference} {d.division}
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {list.map((team) => (
                <div key={team.id} className="card flex flex-col items-center p-4">
                  <TeamHelmet team={team} size={150} />
                  <div className="mt-2 text-center">
                    <div className="font-bold text-slate-900">{team.city} {team.name}</div>
                    <div className="text-xs text-slate-400">{team.abbreviation}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
