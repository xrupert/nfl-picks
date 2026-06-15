import TeamHelmet from './TeamHelmet';

function Side({ team, picked, decided, locked, onPick }) {
  const dim = decided && !picked;
  return (
    <button
      type="button"
      disabled={!team || locked}
      onClick={onPick}
      className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left transition
        ${picked ? 'bg-emerald-50 ring-1 ring-emerald-400' : team ? 'hover:bg-slate-50' : ''}
        ${dim ? 'opacity-35' : ''} ${!team || locked ? 'cursor-default' : 'cursor-pointer'}`}
    >
      {team ? (
        <>
          <TeamHelmet team={team} size={34} />
          <span className="text-xs font-bold text-slate-800">{team.abbreviation}</span>
        </>
      ) : (
        <span className="py-2 text-[10px] uppercase tracking-wide text-slate-400">TBD</span>
      )}
    </button>
  );
}

export default function BracketGame({ game, teamsById, locked, onPick, label }) {
  const t1 = game.team1Id ? teamsById[game.team1Id] : null;
  const t2 = game.team2Id ? teamsById[game.team2Id] : null;
  const decided = Boolean(game.pickedId);

  return (
    <div className="card w-36 p-1.5">
      {label && <div className="px-1 pb-1 text-[9px] uppercase tracking-wide text-slate-400">{label}</div>}
      <Side
        team={t1}
        picked={game.pickedId === game.team1Id}
        decided={decided}
        locked={locked}
        onPick={() => t1 && onPick(game.id, game.team1Id)}
      />
      <div className="my-0.5 text-center text-[8px] text-slate-300">vs</div>
      <Side
        team={t2}
        picked={game.pickedId === game.team2Id}
        decided={decided}
        locked={locked}
        onPick={() => t2 && onPick(game.id, game.team2Id)}
      />
    </div>
  );
}
