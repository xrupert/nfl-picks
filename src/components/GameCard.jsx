import TeamHelmet from './TeamHelmet';

function TeamSide({ team, record, picked, locked, completed, onPick }) {
  if (!team) return <div className="flex-1" />;
  return (
    <button
      type="button"
      disabled={locked}
      onClick={onPick}
      className={`flex flex-1 flex-col items-center gap-1 rounded-lg p-2 transition
        ${picked ? 'ring-2' : 'ring-1 ring-transparent hover:bg-slate-50'}
        ${locked ? 'cursor-default' : 'cursor-pointer'}`}
      style={picked ? { boxShadow: `inset 0 0 0 2px ${team.secondary_color}`, background: `${team.secondary_color}18` } : undefined}
    >
      <TeamHelmet team={team} size={48} selected={picked && !completed} />
      <span className="text-xs font-bold text-slate-800">{team.abbreviation}</span>
      <span className="text-[10px] text-slate-400">
        {record.w}-{record.l}
      </span>
    </button>
  );
}

export default function GameCard({ game, teamsById, picked, locked, getRecord, onPick }) {
  const home = teamsById[game.home_team_id];
  const away = teamsById[game.away_team_id];

  const completed = locked && game.game_completed;
  let resultBadge = null;
  if (completed) {
    if (game.actual_winner_id == null) {
      resultBadge = <span className="text-[10px] font-semibold text-slate-400">Tie</span>;
    } else if (picked === game.actual_winner_id) {
      resultBadge = <span className="text-[10px] font-bold text-emerald-600">✓ Correct</span>;
    } else if (picked) {
      resultBadge = <span className="text-[10px] font-bold text-red-500">✗ Wrong</span>;
    }
  }

  return (
    <div className="card p-2">
      <div className="flex items-center justify-center gap-1">
        <TeamSide
          team={away}
          record={away ? getRecord(away.id) : { w: 0, l: 0 }}
          picked={picked === game.away_team_id}
          locked={locked}
          completed={completed}
          onPick={() => onPick(game.id, game.away_team_id)}
        />
        <div className="flex flex-col items-center px-1 text-slate-300">
          <span className="text-[10px]">@</span>
        </div>
        <TeamSide
          team={home}
          record={home ? getRecord(home.id) : { w: 0, l: 0 }}
          picked={picked === game.home_team_id}
          locked={locked}
          completed={completed}
          onPick={() => onPick(game.id, game.home_team_id)}
        />
      </div>

      <div className="mt-1 flex items-center justify-center gap-2 text-center">
        {completed ? (
          <>
            <span className="text-[10px] text-slate-400">
              {game.actual_away_score}–{game.actual_home_score}
            </span>
            {resultBadge}
          </>
        ) : (
          <span className="text-[10px] text-slate-400">
            {game.game_date
              ? new Date(game.game_date).toLocaleDateString(undefined, {
                  month: 'short',
                  day: 'numeric',
                })
              : ''}
          </span>
        )}
      </div>
    </div>
  );
}
