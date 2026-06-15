// ============================================================
// TEAM EMBLEM RENDERER  (original aggressive mascot symbols)
// File: src/components/TeamHelmet.jsx
// ============================================================
// Renders an ORIGINAL, aggressive sporty mascot mark for each team's nickname
// on a team-colored badge. Sharp angular geometry, snarling expressions —
// original drawings of generic concepts, NOT NFL logos or trademarked art.
//
// If you drop your own image at public/helmets/<ABBR>.png it is used instead.
//
// Props: team, size=120, showLabel=false, selected=false, onClick
// ============================================================

import { useId, useState } from 'react';

// ── color helpers ────────────────────────────────────────────
const clamp = (n) => Math.max(0, Math.min(255, n));
function hexToRgb(hex) {
  const h = (hex || '#888888').replace('#', '');
  const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [parseInt(v.slice(0, 2), 16), parseInt(v.slice(2, 4), 16), parseInt(v.slice(4, 6), 16)];
}
const rgbToHex = (r, g, b) =>
  '#' + [r, g, b].map((n) => clamp(Math.round(n)).toString(16).padStart(2, '0')).join('');
function shade(hex, pct) {
  const [r, g, b] = hexToRgb(hex);
  const t = pct < 0 ? 0 : 255;
  const p = Math.abs(pct) / 100;
  return rgbToHex(r + (t - r) * p, g + (t - g) * p, b + (t - b) * p);
}
const lum = (hex) => {
  const [r, g, b] = hexToRgb(hex);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
};
function pickContrast(bg, cands) {
  const l = lum(bg);
  return cands.reduce((best, c) => (Math.abs(lum(c) - l) > Math.abs(lum(best) - l) ? c : best), cands[0]);
}
const stk = (c, w = 6) => ({ stroke: c, strokeWidth: w, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' });

// ── shared aggressive base shapes ────────────────────────────
// Angular snarling beast head, facing right.
function beastHead(c, a, { ears = 'pointed', mane = false, stripes = false, extraFang = false } = {}) {
  return (
    <g>
      {mane &&
        [...Array(11)].map((_, i) => {
          const ang = (i * (360 / 11) - 90) * (Math.PI / 180);
          return (
            <polygon
              key={i}
              points={`${27 * Math.cos(ang)},${27 * Math.sin(ang)} ${15 * Math.cos(ang - 0.28)},${15 * Math.sin(ang - 0.28)} ${15 * Math.cos(ang + 0.28)},${15 * Math.sin(ang + 0.28)}`}
              fill={a}
            />
          );
        })}
      {ears === 'pointed' && (
        <>
          <polygon points="-16,-13 -11,-25 -3,-13" fill={c} />
          <polygon points="2,-13 9,-24 13,-12" fill={c} />
        </>
      )}
      {ears === 'round' && (
        <>
          <polygon points="-17,-9 -11,-19 -4,-10" fill={c} />
          <polygon points="4,-10 11,-19 17,-9" fill={c} />
        </>
      )}
      {/* angular head + jaw, facing right */}
      <polygon points="-23,-6 -7,-16 9,-13 26,-3 13,2 20,14 6,8 -9,13 -23,5" fill={c} />
      {stripes && (
        <g {...stk(a, 2.5)}>
          <line x1="-15" y1="-8" x2="-7" y2="-9" />
          <line x1="-13" y1="-3" x2="-5" y2="-4" />
          <line x1="-17" y1="2" x2="-9" y2="2" />
        </g>
      )}
      {/* angry slit eye */}
      <polygon points="-3,-7 11,-4 -2,-1" fill={a} />
      {/* bared fang */}
      <polygon points="13,2 16,13 9,5" fill={a} />
      {extraFang && <polygon points="2,8 4,15 6,8" fill={a} />}
      {/* snout tip */}
      <polygon points="22,-2 28,0 22,3" fill={a} />
    </g>
  );
}

// Angular raptor head, facing right.
function raptorHead(c, a, { crest = false, tribal = false, lean = 0 } = {}) {
  return (
    <g transform={lean ? `rotate(${lean})` : undefined}>
      {crest && (
        <>
          <polygon points="-15,-11 -20,-26 -10,-12" fill={c} />
          <polygon points="-7,-12 -10,-26 -1,-12" fill={c} />
        </>
      )}
      <polygon points="-22,-3 -8,-14 8,-12 18,-7 31,-3 17,2 19,10 5,6 -8,11 -20,4" fill={c} />
      {/* sharp hooked beak */}
      <polygon points="31,-3 29,5 23,1" fill={c} />
      {/* aggressive brow */}
      <polygon points="-7,-7 9,-11 3,-2" fill={a} />
      {/* eye cut into brow */}
      <polygon points="-1,-5 6,-6 1,-1" fill={c} />
      {tribal && (
        <g {...stk(a, 2)}>
          <line x1="-18" y1="0" x2="-7" y2="2" />
          <line x1="-16" y1="5" x2="-6" y2="6" />
        </g>
      )}
    </g>
  );
}

// Angular horse head with flying mane, facing right.
function horseHead(c, a) {
  return (
    <g>
      <polygon points="-2,-20 12,-16 16,-4 27,11 18,14 14,5 12,15 -3,16 -9,6 -13,-8" fill={c} />
      <g fill={a}>
        <polygon points="-2,-20 -11,-15 -6,-10" />
        <polygon points="-8,-11 -17,-5 -10,-1" />
        <polygon points="-12,-3 -19,7 -11,8" />
      </g>
      <polygon points="-2,-20 4,-27 9,-19" fill={c} />
      <polygon points="6,-4 14,-2 6,1" fill={a} />
      <polygon points="22,9 27,12 20,13" fill={a} />
    </g>
  );
}

// Angular bovine head with horns, facing forward.
function bovineHead(c, a, star = false) {
  return (
    <g>
      {star && <polygon points="0,-23 2,-18 -2,-18" fill={a} />}
      <polygon points="-16,0 -8,-13 8,-13 16,0 12,13 -12,13" fill={c} />
      <polygon points="-16,0 -28,-7 -26,3 -16,4" fill={c} />
      <polygon points="16,0 28,-7 26,3 16,4" fill={c} />
      <polygon points="-8,2 -2,3 -8,5" fill={a} />
      <polygon points="8,2 2,3 8,5" fill={a} />
      <polygon points="-6,13 6,13 0,18" fill={a} />
    </g>
  );
}

// ── ORIGINAL AGGRESSIVE MASCOT SYMBOLS (centered 0,0, ±28) ───
const symbols = {
  // birds
  ARI: (c, a) => raptorHead(c, a, { crest: true }),
  ATL: (c, a) => raptorHead(c, a, { lean: -14 }),
  BAL: (c, a) => (
    <g>
      <polygon points="-16,-8 -29,-13 -14,-2" fill={c} />
      {raptorHead(c, a, {})}
    </g>
  ),
  SEA: (c, a) => raptorHead(c, a, { tribal: true }),
  PHI: (c, a) => raptorHead(c, a, {}),
  // cats
  CIN: (c, a) => beastHead(c, a, { stripes: true }),
  JAX: (c, a) => beastHead(c, a, { extraFang: true }),
  CAR: (c, a) => beastHead(c, a, { extraFang: true }),
  DET: (c, a) => beastHead(c, a, { mane: true }),
  CHI: (c, a) => beastHead(c, a, { ears: 'round' }),
  // viking horned helmet
  MIN: (c, a) => (
    <g>
      <path d="M-15,10 L-15,-3 C-15,-16 15,-16 15,-3 L15,10 Z" fill={c} />
      <polygon points="-17,10 17,10 14,15 -14,15" fill={a} />
      <polygon points="-13,-5 -28,-17 -25,-1 -15,2" fill={a} />
      <polygon points="13,-5 28,-17 25,-1 15,2" fill={a} />
    </g>
  ),
  // horses / ram
  DEN: (c, a) => horseHead(c, a),
  IND: (c, a) => horseHead(c, a),
  LAR: (c, a) => (
    <g>
      <polygon points="-8,-4 8,-4 6,13 -6,13" fill={c} />
      <path d="M-8,-6 C-25,-9 -27,13 -12,15 C-22,9 -19,-4 -8,0" {...stk(c, 5)} />
      <path d="M8,-6 C25,-9 27,13 12,15 C22,9 19,-4 8,0" {...stk(c, 5)} />
      <polygon points="-6,-1 -1,1 -6,3" fill={a} />
      <polygon points="6,-1 1,1 6,3" fill={a} />
      <polygon points="-3,13 3,13 0,19" fill={a} />
    </g>
  ),
  // other animals
  BUF: (c, a) => bovineHead(c, a),
  HOU: (c, a) => bovineHead(c, a, true),
  MIA: (c, a) => (
    <g>
      <polygon points="-21,15 -5,-6 11,-17 25,-6 12,-5 0,3 -8,15" fill={c} />
      <polygon points="6,-12 17,-23 12,-7" fill={a} />
      <polygon points="-21,15 -28,9 -22,19" fill={c} />
      <polygon points="16,-7 21,-6 16,-3" fill={a} />
    </g>
  ),
  CLE: (c, a) => (
    <g>
      <polygon points="-16,-13 -8,-15 -8,-6" fill={c} />
      <polygon points="16,-13 8,-15 8,-6" fill={c} />
      <polygon points="-17,-8 -8,-12 8,-12 17,-8 16,10 8,16 -8,16 -16,10" fill={c} />
      <rect x="-12" y="6" width="24" height="11" rx="3" fill={a} />
      <polygon points="-4,7 4,7 0,12" fill={c} />
      <polygon points="-9,-3 -3,-1 -9,1" fill={a} />
      <polygon points="9,-3 3,-1 9,1" fill={a} />
      <polygon points="-8,15 -6,20 -4,15" fill={a} />
      <polygon points="8,15 6,20 4,15" fill={a} />
    </g>
  ),
  GB: (c, a) => (
    <g>
      <polygon points="-20,13 21,13 6,-16" fill={c} />
      <polygon points="0,0 4,3 0,6 -4,3" fill={a} />
      <circle cx="-9" cy="8" r="2" fill={a} />
      <circle cx="10" cy="8" r="2" fill={a} />
    </g>
  ),
  // symbol marks
  PIT: (c, a) => (
    <g>
      {[0, 120, 240].map((d, i) => (
        <polygon key={i} points="0,-25 6,-3 -6,-3" fill={c} transform={`rotate(${d})`} />
      ))}
      <circle cx="0" cy="0" r="5" fill={a} />
    </g>
  ),
  TEN: (c, a) => (
    <g>
      <polygon points="2,-25 9,-7 15,-13 9,5 17,1 5,19 9,9 -1,15 1,3 -11,9 -5,-5 -13,-3" fill={c} />
      <polygon points="1,-6 7,4 1,12 -5,4" fill={a} />
    </g>
  ),
  NE: (c, a) => (
    <g>
      <polygon points="-25,8 -14,1 0,-16 14,1 25,8 12,9 0,4 -12,9" fill={c} />
      <polygon points="0,-16 3,-7 -3,-7" fill={a} />
    </g>
  ),
  NYJ: (c, a) => (
    <g>
      <polygon points="2,-26 8,-2 24,11 8,6 6,22 0,14 -6,22 -8,6 -24,11 -8,-2" fill={c} />
      <circle cx="1" cy="-5" r="3" fill={a} />
    </g>
  ),
  KC: (c, a) => (
    <g>
      <polygon points="0,-24 16,10 0,3 -16,10" fill={c} />
      <polygon points="0,-13 7,5 0,2 -7,5" fill={a} />
    </g>
  ),
  LV: (c, a) => (
    <g>
      <polygon points="0,-20 13,-15 18,-2 12,8 12,16 6,12 0,16 -6,12 -12,16 -12,8 -18,-2 -13,-15" fill={c} />
      <polygon points="-10,-4 -2,-1 -9,3" fill={a} />
      <polygon points="10,-4 2,-1 9,3" fill={a} />
      <polygon points="0,3 3,10 -3,10" fill={a} />
    </g>
  ),
  LAC: (c) => <polygon points="7,-25 -13,4 0,4 -8,25 18,-6 3,-6" fill={c} />,
  NO: (c) => (
    <g>
      <polygon points="0,-24 5,-10 0,-3 -5,-10" fill={c} />
      <polygon points="0,-3 17,-9 11,10 2,4 0,9 -2,4 -11,10 -17,-9" fill={c} />
      <rect x="-11" y="8" width="22" height="4" rx="1" fill={c} />
    </g>
  ),
  TB: (c, a) => (
    <g>
      <polygon points="-24,-2 -12,-11 0,-20 12,-11 24,-2 14,1 0,-6 -14,1" fill={c} />
      <g {...stk(a, 3)}>
        <line x1="-16" y1="21" x2="15" y2="4" />
        <line x1="16" y1="21" x2="-15" y2="4" />
      </g>
      <circle cx="0" cy="-8" r="3" fill={a} />
    </g>
  ),
  DAL: (c) => <polygon points="0,-25 6,-7 25,-7 9,4 15,23 0,11 -15,23 -9,4 -25,-7 -6,-7" fill={c} />,
  NYG: (c, a) => (
    <g>
      <polygon points="-15,-6 -15,15 15,15 15,-2 8,-2 8,-12 -8,-12 -8,-6" fill={c} />
      <g {...stk(a, 2)}>
        <line x1="-7" y1="-11" x2="-7" y2="-3" />
        <line x1="0" y1="-12" x2="0" y2="-3" />
        <line x1="7" y1="-11" x2="7" y2="-3" />
      </g>
      <polygon points="15,-1 23,1 15,7" fill={c} />
    </g>
  ),
  WSH: (c) => (
    <g>
      <polygon points="0,-21 5,-12 -5,-12" fill={c} />
      <polygon points="-16,2 0,-9 16,2 0,-4" fill={c} />
      <polygon points="-16,14 0,3 16,14 0,8" fill={c} />
    </g>
  ),
  SF: (c, a) => (
    <g>
      <g {...stk(c, 5)}>
        <line x1="-17" y1="-17" x2="16" y2="16" />
        <line x1="17" y1="-17" x2="-16" y2="16" />
      </g>
      <polygon points="-24,-13 -7,-21 -10,-11" fill={c} />
      <polygon points="24,-13 7,-21 10,-11" fill={c} />
      <circle cx="0" cy="0" r="3.5" fill={a} />
    </g>
  ),
  default: (c, a) => (
    <g>
      <polygon points="0,-22 6,-7 22,-7 10,3 15,20 0,10 -15,20 -10,3 -22,-7 -6,-7" fill={c} />
      <circle cx="0" cy="0" r="5" fill={a} />
    </g>
  ),
};

// ── BADGE ────────────────────────────────────────────────────
function Badge({ team, size = 120, selected = false }) {
  const gid = useId().replace(/:/g, '');
  const p = team.primary_color || '#222831';
  const s = team.secondary_color || '#aaaaaa';
  const t = team.tertiary_color || '#ffffff';

  const symbolFn = symbols[team.abbreviation] || symbols.default;
  const sym = pickContrast(p, [s, t, '#ffffff', '#0c0e12']);
  const acc = sym === s ? t : s;

  return (
    <svg viewBox="0 0 100 100" width={size} height={size} xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id={`d${gid}`} cx="0.4" cy="0.35" r="0.8">
          <stop offset="0%" stopColor={shade(p, 30)} />
          <stop offset="55%" stopColor={p} />
          <stop offset="100%" stopColor={shade(p, -34)} />
        </radialGradient>
        <clipPath id={`c${gid}`}>
          <circle cx="50" cy="50" r="46" />
        </clipPath>
      </defs>

      <circle cx="50" cy="50" r="46" fill={`url(#d${gid})`} stroke={sym} strokeWidth="3" />
      <circle cx="50" cy="50" r="46" fill="none" stroke={shade(p, 45)} strokeWidth="0.75" opacity="0.5" />

      <g clipPath={`url(#c${gid})`}>
        <ellipse cx="38" cy="24" rx="40" ry="20" fill="#ffffff" opacity="0.14" />
      </g>

      <g transform="translate(50,50)" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.45))' }}>
        {symbolFn(sym, acc)}
      </g>

      {selected && <circle cx="50" cy="50" r="46" fill="none" stroke={sym} strokeWidth="3.5" opacity="0.95" />}
    </svg>
  );
}

// ── DEFAULT EXPORT: image override → original symbol ─────────
export default function TeamHelmet({ team, size = 120, showLabel = false, selected = false, onClick }) {
  const [imgFailed, setImgFailed] = useState(false);
  if (!team) return null;

  const abbr = team.abbreviation;
  const src = `${import.meta.env.BASE_URL}helmets/${abbr}.jpg`;
  const p = team.primary_color || '#222831';
  const s = team.secondary_color || '#aaaaaa';

  return (
    <div
      onClick={onClick}
      className={`helmet ${selected ? 'is-selected' : ''}`}
      style={{ width: size, cursor: onClick ? 'pointer' : 'default', '--glow': s }}
    >
      {imgFailed ? (
        <Badge team={team} size={size} selected={selected} />
      ) : (
        <img
          src={src}
          alt={`${team.city} ${team.name}`}
          width={size}
          height={size}
          onError={() => setImgFailed(true)}
          style={{ width: size, height: size, objectFit: 'contain', display: 'block' }}
        />
      )}
      {showLabel && (
        <span style={{ color: shade(p, 58), fontSize: size * 0.12, fontWeight: 800, letterSpacing: '0.05em' }}>
          {abbr}
        </span>
      )}
    </div>
  );
}
