import { useState } from 'react';
import TeamHelmet from './TeamHelmet';

export default function TiebreakerModal({ divKey, teams, onSave, onClose }) {
  const [order, setOrder] = useState(teams);

  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    const next = [...order];
    [next[i], next[j]] = [next[j], next[i]];
    setOrder(next);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="card w-full max-w-md p-5 shadow-xl">
        <h3 className="text-lg font-bold text-slate-900">Resolve tiebreaker — {divKey}</h3>
        <p className="mt-1 text-sm text-slate-500">
          These teams have an identical predicted record. Use the arrows to set the division
          winner and seeding order.
        </p>

        <ul className="mt-4 flex flex-col gap-2">
          {order.map((t, i) => (
            <li key={t.teamId} className="flex items-center gap-3 rounded-lg bg-slate-50 p-2 border border-slate-100">
              <span className="w-5 text-center text-sm font-bold text-slate-400">{i + 1}</span>
              <TeamHelmet team={t.team} size={36} />
              <div className="flex-1">
                <div className="text-sm font-semibold text-slate-900">{t.team?.city} {t.team?.name}</div>
                <div className="text-xs text-slate-400">{t.w}-{t.l}</div>
              </div>
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="rounded bg-slate-200 px-2 text-xs text-slate-600 hover:bg-slate-300 disabled:opacity-30"
                >
                  ▲
                </button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === order.length - 1}
                  className="rounded bg-slate-200 px-2 text-xs text-slate-600 hover:bg-slate-300 disabled:opacity-30"
                >
                  ▼
                </button>
              </div>
            </li>
          ))}
        </ul>

        <div className="mt-5 flex gap-2">
          <button onClick={onClose} className="btn-secondary flex-1">Cancel</button>
          <button
            onClick={() => onSave(divKey, order.map((t) => t.teamId))}
            className="btn-primary flex-1"
          >
            Save order
          </button>
        </div>
      </div>
    </div>
  );
}
