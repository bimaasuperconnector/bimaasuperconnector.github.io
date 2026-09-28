/**
 * The hero illustration: how SuperConnector works, in one picture.
 *   1. Alumni enrol (individual avatars)
 *   2. They're matched into small circles (3–6) or a one-to-one
 *   3. They meet on the third weekend (5–6 PM IST, Google Meet)
 *
 * Drawn as a single inline SVG in the design system's palette. The overlapping
 * circles echo the BIMAA logo mark. All text is real SVG text so it stays
 * crisp and selectable; sizes are chosen so it's still legible (~12px) when
 * the 400-unit-wide drawing is scaled down to a phone screen.
 */

const INK = '#181d26';
const MUTED = '#41454d';
const CREAM = '#f5e9d4';
const CORAL = '#aa2d00';

type Swatch = { fill: string; glyph: string };

const PEACH: Swatch = { fill: '#fcab79', glyph: INK };
const MINT: Swatch = { fill: '#a8d8c4', glyph: INK };
const YELLOW: Swatch = { fill: '#f4d35e', glyph: INK };
const FOREST: Swatch = { fill: '#0a2e0e', glyph: CREAM };
const CORAL_S: Swatch = { fill: CORAL, glyph: CREAM };
const INK_S: Swatch = { fill: INK, glyph: CREAM };

/** A small person glyph on a coloured disc. Glyph colour is picked per swatch for contrast. */
function Person({ cx, cy, r, swatch }: { cx: number; cy: number; r: number; swatch: Swatch }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <circle r={r} fill={swatch.fill} />
      <circle cy={-r * 0.22} r={r * 0.3} fill={swatch.glyph} />
      <path
        d={`M ${-r * 0.56} ${r * 0.74} A ${r * 0.56} ${r * 0.5} 0 0 1 ${r * 0.56} ${r * 0.74} Z`}
        fill={swatch.glyph}
      />
    </g>
  );
}

function StepBadge({ n, cy }: { n: number; cy: number }) {
  return (
    <g>
      <circle cx={36} cy={cy} r={14} fill={INK} />
      <text
        x={36}
        y={cy}
        dy="0.35em"
        textAnchor="middle"
        fontSize={15}
        fontWeight={600}
        fill={CREAM}
      >
        {n}
      </text>
    </g>
  );
}

function StepText({ y, title, sub }: { y: number; title: string; sub: string }) {
  return (
    <g>
      <text x={64} y={y} fontSize={21} fontWeight={600} fill={INK}>
        {title}
      </text>
      <text x={64} y={y + 23} fontSize={15} fill={MUTED}>
        {sub}
      </text>
    </g>
  );
}

/** Points on a ring, starting at `startDeg` (0° = right, -90° = top). */
function ring(cx: number, cy: number, radius: number, count: number, startDeg: number) {
  return Array.from({ length: count }, (_, i) => {
    const a = ((startDeg + (360 / count) * i) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  });
}

const ENROL: { x: number; y: number; s: Swatch }[] = [
  { x: 80, y: 116, s: PEACH },
  { x: 120, y: 104, s: FOREST },
  { x: 160, y: 122, s: MINT },
  { x: 200, y: 108, s: CORAL_S },
  { x: 240, y: 120, s: YELLOW },
  { x: 280, y: 106, s: INK_S },
  { x: 320, y: 118, s: PEACH },
  { x: 360, y: 110, s: MINT },
];

const CIRCLES = [
  { cx: 118, cy: 290, r: 54, ring: 28, av: 12.5, start: -90, swatches: [PEACH, FOREST, MINT, CORAL_S, YELLOW] },
  { cx: 242, cy: 290, r: 44, ring: 22, av: 11.5, start: 45, swatches: [MINT, INK_S, PEACH, CORAL_S] },
];

// Week rows of the mini calendar; the third row carries the highlighted weekend.
const DAY_X = (i: number) => 88 + i * 44.5;
const ROWS = [474, 500, 526];

export function ProgramIllustration({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 570"
      role="img"
      aria-label="How SuperConnector works in three steps: alumni enrol, get matched into small circles, and meet on the third weekend of the month."
      className={`font-haas ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width={400} height={570} rx={12} fill={CREAM} />

      {/* Dotted spine joining the three steps */}
      <path
        d="M36 58 V164 M36 192 V372"
        stroke={INK}
        strokeOpacity={0.35}
        strokeWidth={2}
        strokeLinecap="round"
        strokeDasharray="1 7"
        fill="none"
      />

      {/* 1 — Enrol */}
      <g className="sc-rise" style={{ animationDelay: '0.1s' }}>
        <StepBadge n={1} cy={44} />
        <StepText y={50} title="Enrol" sub="Choose one-to-one or a small circle" />
        {ENROL.map((a) => (
          <Person key={a.x} cx={a.x} cy={a.y} r={15} swatch={a.s} />
        ))}
      </g>

      {/* 2 — Get matched */}
      <g className="sc-rise" style={{ animationDelay: '0.35s' }}>
        <StepBadge n={2} cy={178} />
        <StepText y={184} title="Get matched" sub="Circles of 3 to 6, or a one-to-one" />

        {CIRCLES.map((c) => {
          const pts = ring(c.cx, c.cy, c.ring, c.swatches.length, c.start);
          return (
            <g key={c.cx}>
              <circle cx={c.cx} cy={c.cy} r={c.r} fill="#fff" stroke={INK} strokeWidth={1.75} />
              <polygon
                points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke={INK}
                strokeOpacity={0.3}
                strokeWidth={1.25}
              />
              {pts.map((p, i) => (
                <Person key={i} cx={p.x} cy={p.y} r={c.av} swatch={c.swatches[i]} />
              ))}
            </g>
          );
        })}

        {/* one-to-one pair */}
        <circle cx={344} cy={290} r={32} fill="#fff" stroke={INK} strokeWidth={1.75} />
        <line x1={331} y1={290} x2={357} y2={290} stroke={CORAL} strokeWidth={2} />
        <Person cx={331} cy={290} r={11} swatch={PEACH} />
        <Person cx={357} cy={290} r={11} swatch={MINT} />
      </g>

      {/* 3 — Meet */}
      <g className="sc-rise" style={{ animationDelay: '0.6s' }}>
        <StepBadge n={3} cy={386} />
        <StepText y={392} title="Meet on the third weekend" sub="Sat or Sun, 5–6 PM IST, on Google Meet" />

        {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d, i) => (
          <text key={i} x={DAY_X(i)} y={448} textAnchor="middle" fontSize={14} fontWeight={500} fill={MUTED}>
            {d}
          </text>
        ))}

        {ROWS.map((y, row) =>
          Array.from({ length: 7 }, (_, i) => {
            const isThirdWeekend = row === 2 && i >= 5;
            if (isThirdWeekend) return null;
            return <circle key={`${row}-${i}`} cx={DAY_X(i)} cy={y} r={3.2} fill={INK} fillOpacity={0.28} />;
          }),
        )}

        {[
          { i: 5, label: 'Sat' },
          { i: 6, label: 'Sun' },
        ].map(({ i, label }) => (
          <g key={label}>
            <rect x={DAY_X(i) - 20} y={ROWS[2] - 12} width={40} height={24} rx={12} fill={CORAL} />
            <text
              x={DAY_X(i)}
              y={ROWS[2]}
              dy="0.35em"
              textAnchor="middle"
              fontSize={13}
              fontWeight={600}
              fill="#fff"
            >
              {label}
            </text>
          </g>
        ))}
      </g>
    </svg>
  );
}
