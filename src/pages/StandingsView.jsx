import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { useLeagueStore } from '../store/leagueStore';
import { useTeamsStore } from '../store/teamsStore';
import { usePicksStore } from '../store/picksStore';
import { deriveSeeding } from '../lib/seeding';
import { persistSeeding, generateBracket } from '../lib/bracket';
import TeamHelmet from '../components/TeamHelmet';
import TiebreakerModal from '../components/TiebreakerModal';

const TOTAL_GAMES = 272;

function DivisionCard({ div, divKey, onResolve }) {
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">{divKey}</h3>
        {div.unresolved && (
          <button
            onClick={() => onResolve(divKey)}
            className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-700 hover:bg-amber-200"
          >
            Resolve tie
          </button>
        )}
      </div>
      <ul className="flex flex-col gap-1">
        {div.teams.map((t) => (
          <li key={t.teamId} className="flex items-center gap-3 rounded-lg p-1.5 hover:bg-slate-50">
            <span className="w-4 text-center text-xs text-slate-400">{t.rank}</span>
            <TeamHelmet team={t.team} size={34} />
            <span className="flex-1 text-sm font-medium text-slate-900">
              {t.team?.city} {t.team?.name}
            </span>
            {t.rank === 1 && <span title="Division winner">🏆</span>}
            <span className="text-sm font-bold tabular-nums text-slate-700">
              {t.w}-{t.l}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SeedBoard({ conf, seeds }) {
  return (
    <div className="card p-4">
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wider text-slate-400">{conf} Seeds</h3>
      <ul className="flex flex-col gap-1.5">
        {seeds.map((s) => (
          <li key={s.seed} className="flex items-center gap-3 rounded-lg bg-slate-50 p-1.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-sm font-extrabold text-emerald-700">
              {s.seed}
            </span>
            <TeamHelmet team={s.team} size={36} />
            <span className="flex-1 text-sm font-medium text-slate-900">
              {s.team?.city} {s.team?.name}
            </span>
            {s.seed === 1 && (
              <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                BYE
              </span>
            )}
            <span className="text-sm font-bold tabular-nums text-slate-700">
              {s.w}-{s.l}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StandingsView() {
  const { leagueId } = useParams();
  const navigate = useNavigate();
  const userId = useAuthStore((s) => s.session?.user?.id);
  const league = useLeagueStore((s) => s.league);

  const teams = useTeamsStore((s) => s.teams);
  const load = usePicksStore((s) => s.load);
  const schedule = usePicksStore((s) => s.schedule);
  const picks = usePicksStore((s) => s.picks);
  const picksLoading = usePicksStore((s) => s.loading);
  const picksLeagueId = usePicksStore((s) => s.leagueId);

  const [overrides, setOverrides] = useState({});
  const [resolving, setResolving] = useState(null);
  const [proceeding, setProceeding] = useState(false);
  const [error, setError] = useState(null);

  const seasonYear = league?.season_year ?? 2026;

  useEffect(() => {
    if (league && userId && picksLeagueId !== leagueId) {
      load(leagueId, userId, seasonYear);
    }
  }, [league, userId, leagueId, seasonYear, load, picksLeagueId]);

  const derived = useMemo(() => {
    if (!teams.length || !schedule.length) return null;
    return deriveSeeding(teams, schedule, picks, overrides);
  }, [teams, schedule, picks, overrides]);

  const pickedCount = Object.keys(picks).length;
  const allPicked = pickedCount >= TOTAL_GAMES && schedule.length >= TOTAL_GAMES;
  const unresolved = derived?.unresolvedDivisions ?? [];
  const canProceed = allPicked && unresolved.length === 0;

  const handleSaveOrder = (divKey, orderedIds) => {
    setOverrides((o) => ({ ...o, [divKey]: orderedIds }));
    setResolving(null);
  };

  const handleProceed = async () => {
    setProceeding(true);
    setError(null);
    try {
      await persistSeeding({ leagueId, userId, teams, derived });
      await generateBracket({ leagueId, userId, seasonYear, derived });
      navigate(`/league/${leagueId}/playoffs`);
    } catch (e) {
      setError(e.message);
      setProceeding(false);
    }
  };

  if (picksLoading || !derived) return <p className="text-slate-500">Deriving standings…</p>;

  if (!allPicked) {
    return (
      <div className="card p-6">
        <p className="font-semibold text-slate-900">Finish your picks first</p>
        <p className="mt-1 text-sm text-slate-500">
          You've picked {pickedCount}/{TOTAL_GAMES} games. Standings derive from all 272 picks.
        </p>
        <Link to={`/league/${leagueId}/picks`} className="btn-primary mt-4 inline-flex">
          Back to picks →
        </Link>
      </div>
    );
  }

  const resolveDiv = resolving ? derived.divisions[resolving] : null;

  return (
    <div>
      {unresolved.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          {unresolved.length} division{unresolved.length > 1 ? 's have' : ' has'} a tie that needs
          manual resolution before playoffs unlock.
        </div>
      )}

      {['NFC', 'AFC'].map((conf) => (
        <div key={conf} className="mb-6">
          <h2 className="mb-3 text-lg font-extrabold text-slate-900">{conf}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.keys(derived.divisions)
              .filter((k) => k.startsWith(conf))
              .map((k) => (
                <DivisionCard key={k} divKey={k} div={derived.divisions[k]} onResolve={setResolving} />
              ))}
          </div>
        </div>
      ))}

      <h2 className="mb-3 text-lg font-extrabold text-slate-900">Playoff Picture</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <SeedBoard conf="NFC" seeds={derived.seeds.NFC} />
        <SeedBoard conf="AFC" seeds={derived.seeds.AFC} />
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Only the #1 seed earns a first-round bye (NFL format since 2021). Seeds 2–7 play Wild Card.
      </p>

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}

      <button
        onClick={handleProceed}
        disabled={!canProceed || proceeding}
        className="btn-primary mt-6"
        title={canProceed ? '' : 'Resolve all ties to continue'}
      >
        {proceeding ? 'Generating bracket…' : 'Proceed to Playoffs →'}
      </button>

      {resolveDiv && (
        <TiebreakerModal
          divKey={resolving}
          teams={resolveDiv.teams}
          onSave={handleSaveOrder}
          onClose={() => setResolving(null)}
        />
      )}
    </div>
  );
}
