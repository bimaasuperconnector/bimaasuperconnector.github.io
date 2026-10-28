import type { ReactNode } from 'react';

/**
 * Stylised, device-specific illustrations for the "Get the app" guide.
 *
 * They are drawn as inline SVG (no image files to host or download) from the
 * Design-superconnector.md palette only. They are deliberately simplified
 * mock-ups, not screenshots, so they stay correct when a browser tweaks its
 * look — the coral ring always marks exactly what to tap or click.
 */

const C = {
  ink: '#181d26',
  body: '#333840',
  muted: '#41454d',
  hair: '#dddddd',
  soft: '#f8fafc',
  strong: '#e0e2e6',
  white: '#ffffff',
  coral: '#aa2d00',
  cream: '#f5e9d4',
  peach: '#fcab79',
  mint: '#a8d8c4',
  yellow: '#f4d35e',
  mustard: '#d9a441',
  forest: '#0a2e0e',
  link: '#1b61c9',
  border: '#9297a0',
};
const FONT = 'Inter, system-ui, -apple-system, "Segoe UI", sans-serif';

/* ------------------------------ primitives ------------------------------ */

function Scene({ label, children }: { label: string; children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 320 220"
      role="img"
      aria-label={label}
      className="h-auto w-full rounded-lg border border-hairline bg-surface-soft"
      fontFamily={FONT}
    >
      {children}
    </svg>
  );
}

function T({
  x,
  y,
  size = 8,
  fill = C.ink,
  weight = 400,
  anchor = 'start',
  children,
}: {
  x: number;
  y: number;
  size?: number;
  fill?: string;
  weight?: number;
  anchor?: 'start' | 'middle' | 'end';
  children: ReactNode;
}) {
  return (
    <text x={x} y={y} fontSize={size} fill={fill} fontWeight={weight} textAnchor={anchor}>
      {children}
    </text>
  );
}

/** The coral ring that marks the thing to tap/click. */
function Hit({ x, y, w, h, r = 6 }: { x: number; y: number; w: number; h: number; r?: number }) {
  return (
    <rect
      x={x}
      y={y}
      width={w}
      height={h}
      rx={r}
      fill={C.coral}
      fillOpacity={0.1}
      stroke={C.coral}
      strokeWidth={2}
    />
  );
}

/** Coral label with a small pointer, e.g. "Tap Share". */
function Tag({ x, y, text }: { x: number; y: number; text: string }) {
  const w = text.length * 5.1 + 14;
  return (
    <g>
      <rect x={x} y={y} width={w} height={15} rx={7.5} fill={C.coral} />
      <T x={x + w / 2} y={y + 10.4} size={8} fill={C.white} weight={500} anchor="middle">
        {text}
      </T>
    </g>
  );
}

function Logo({ x, y, s = 28 }: { x: number; y: number; s?: number }) {
  return (
    <g>
      <rect x={x} y={y} width={s} height={s} rx={s * 0.23} fill={C.ink} />
      <T x={x + s / 2} y={y + s * 0.64} size={s * 0.4} fill={C.white} weight={600} anchor="middle">
        SC
      </T>
    </g>
  );
}

function Lines({ x, y, w, n = 3, gap = 7 }: { x: number; y: number; w: number; n?: number; gap?: number }) {
  return (
    <g fill={C.strong}>
      {Array.from({ length: n }).map((_, i) => (
        <rect key={i} x={x} y={y + i * gap} width={i === n - 1 ? w * 0.6 : w} height={3.2} rx={1.6} />
      ))}
    </g>
  );
}

function ShareGlyph({ x, y, s = 1 }: { x: number; y: number; s?: number }) {
  return (
    <g transform={`translate(${x} ${y}) scale(${s})`} fill="none" stroke={C.ink} strokeWidth={1.4} strokeLinecap="round" strokeLinejoin="round">
      <path d="M-4.5 -1.5h2.2M4.5 -1.5H2.2M-4.5 -1.5v8h9v-8M0 3.5v-10M-3 -3.8 0 -6.8l3 3" />
    </g>
  );
}

function Dots({ x, y, vertical = true }: { x: number; y: number; vertical?: boolean }) {
  return (
    <g fill={C.ink}>
      {[-4.5, 0, 4.5].map((d) => (
        <circle key={d} cx={vertical ? x : x + d} cy={vertical ? y + d : y} r={1.3} />
      ))}
    </g>
  );
}

function Bars({ x, y }: { x: number; y: number }) {
  return (
    <g stroke={C.ink} strokeWidth={1.4} strokeLinecap="round">
      {[-4, 0, 4].map((d) => (
        <path key={d} d={`M${x - 5} ${y + d}h10`} />
      ))}
    </g>
  );
}

function InstallGlyph({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="none" stroke={C.ink} strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round">
      <rect x={-5} y={-4.5} width={10} height={7} rx={1} />
      <path d="M-2 5.2h4M0 -2.6v3.6M-1.8 -0.8 0 1l1.8-1.8" />
    </g>
  );
}

function PlusApp({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} fill="none" stroke={C.ink} strokeWidth={1.2} strokeLinecap="round">
      <rect x={-5} y={-5} width={10} height={10} rx={2} />
      <path d="M0 -2.4v4.8M-2.4 0h4.8" />
    </g>
  );
}

/* ------------------------------ device frames ------------------------------ */

function Phone({ children, dim = false }: { children: ReactNode; dim?: boolean }) {
  return (
    <g>
      <rect x={104} y={5} width={112} height={210} rx={17} fill={C.ink} />
      <rect x={108} y={9} width={104} height={202} rx={13.5} fill={C.white} />
      <rect x={146} y={13} width={28} height={6} rx={3} fill={C.ink} />
      {children}
      {dim && <rect x={108} y={9} width={104} height={202} rx={13.5} fill={C.ink} fillOpacity={0.3} />}
    </g>
  );
}

function Tablet({ children }: { children: ReactNode }) {
  return (
    <g>
      <rect x={24} y={8} width={272} height={204} rx={15} fill={C.ink} />
      <rect x={29} y={13} width={262} height={194} rx={11} fill={C.white} />
      {children}
    </g>
  );
}

function PageBody({ x, y, w }: { x: number; y: number; w: number }) {
  return (
    <g>
      <Logo x={x + w / 2 - 12} y={y} s={24} />
      <rect x={x + w * 0.2} y={y + 33} width={w * 0.6} height={5} rx={2.5} fill={C.ink} />
      <Lines x={x + w * 0.12} y={y + 46} w={w * 0.76} n={3} />
      <rect x={x + w * 0.12} y={y + 72} width={w * 0.34} height={12} rx={4} fill={C.ink} />
      <rect x={x + w * 0.52} y={y + 72} width={w * 0.34} height={12} rx={4} fill={C.white} stroke={C.hair} />
    </g>
  );
}

/* =========================== iPhone / iPad (iOS) =========================== */

export function IphoneBrowser({ variant }: { variant: 'bottom' | 'top' | 'menu' }) {
  return (
    <Scene
      label={
        variant === 'bottom'
          ? 'iPhone Safari with the Share button in the bottom toolbar highlighted'
          : variant === 'top'
            ? 'iPhone browser with the Share icon in the address bar highlighted'
            : 'iPhone browser with the menu button highlighted'
      }
    >
      <Phone>
        {variant === 'top' && (
          <g>
            <rect x={108} y={22} width={104} height={26} fill={C.soft} />
            <rect x={114} y={27} width={92} height={16} rx={8} fill={C.white} stroke={C.hair} />
            <T x={146} y={38} size={6.5} fill={C.muted}>
              bimaasuperconnector…
            </T>
            <Hit x={190} y={26} w={18} h={18} r={9} />
            <ShareGlyph x={199} y={34.5} s={0.85} />
          </g>
        )}
        <PageBody x={112} y={variant === 'top' ? 62 : 44} w={96} />
        {variant !== 'top' && (
          <g>
            <rect x={108} y={168} width={104} height={43} fill={C.soft} />
            <rect x={116} y={172} width={88} height={15} rx={7.5} fill={C.white} stroke={C.hair} />
            <T x={160} y={182} size={6.5} fill={C.muted} anchor="middle">
              bimaasuperconnector.github.io
            </T>
            <g stroke={C.ink} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
              <path d="m122 198-4 3.5 4 3.5" />
              <path d="m142 198 4 3.5-4 3.5" />
              <rect x={172} y={197} width={9} height={9} rx={1.5} />
              <path d="M196 197h8v9h-8z" />
            </g>
            {variant === 'bottom' ? (
              <>
                <Hit x={149} y={190} w={22} h={22} r={11} />
                <ShareGlyph x={160} y={201} s={0.9} />
              </>
            ) : (
              <>
                <Hit x={149} y={190} w={22} h={22} r={11} />
                <Dots x={160} y={201} vertical={false} />
              </>
            )}
          </g>
        )}
      </Phone>
      <Tag x={8} y={variant === 'top' ? 28 : 190} text={variant === 'menu' ? 'Tap ⋯ menu' : 'Tap Share'} />
    </Scene>
  );
}

function SheetRow({ y, label, hl = false }: { y: number; label: string; hl?: boolean }) {
  return (
    <g>
      {hl && <Hit x={113} y={y - 2} w={94} h={24} r={5} />}
      <rect x={118} y={y + 3} width={13} height={13} rx={3} fill={hl ? C.ink : C.strong} />
      {hl ? (
        <path d={`M124.5 ${y + 6.5}v6M121.5 ${y + 9.5}h6`} stroke={C.white} strokeWidth={1.4} strokeLinecap="round" />
      ) : null}
      <T x={137} y={y + 13} size={7.5} fill={C.ink} weight={hl ? 600 : 400}>
        {label}
      </T>
    </g>
  );
}

export function IphoneShareSheet() {
  return (
    <Scene label="iPhone share sheet with Add to Home Screen highlighted">
      <Phone dim>
        <PageBody x={112} y={30} w={96} />
        <rect x={108} y={78} width={104} height={133} rx={13.5} fill={C.white} />
        <rect x={148} y={83} width={24} height={3} rx={1.5} fill={C.strong} />
        <T x={160} y={100} size={7.5} fill={C.muted} anchor="middle">
          SuperConnector
        </T>
        <SheetRow y={108} label="Copy" />
        <SheetRow y={134} label="Add to Bookmarks" />
        <SheetRow y={160} label="Add to Home Screen" hl />
        <SheetRow y={186} label="Find on Page" />
      </Phone>
      <Tag x={8} y={160} text="Add to Home Screen" />
    </Scene>
  );
}

export function IphoneAddScreen() {
  return (
    <Scene label="iPhone Add to Home Screen sheet with the Add button highlighted">
      <Phone dim>
        <rect x={108} y={44} width={104} height={167} rx={13.5} fill={C.soft} />
        <T x={120} y={64} size={8} fill={C.link}>
          Cancel
        </T>
        <Hit x={181} y={52} w={26} h={17} r={8} />
        <T x={194} y={64} size={8} fill={C.link} weight={600} anchor="middle">
          Add
        </T>
        <rect x={114} y={78} width={92} height={50} rx={9} fill={C.white} />
        <Logo x={120} y={85} s={28} />
        <T x={154} y={98} size={7.5}>
          SuperConnector
        </T>
        <T x={154} y={110} size={5.8} fill={C.muted}>
          bimaasuperconnector.github.io
        </T>
        <line x1={114} y1={134} x2={206} y2={134} stroke={C.hair} />
        <rect x={114} y={138} width={92} height={22} rx={9} fill={C.white} />
        <T x={120} y={152} size={7}>
          Open as Web App
        </T>
        <rect x={184} y={143} width={20} height={12} rx={6} fill="#34c759" />
        <circle cx={198} cy={149} r={4.6} fill={C.white} />
      </Phone>
      <Tag x={8} y={52} text="Tap Add" />
    </Scene>
  );
}

function AppIcon({ x, y, c }: { x: number; y: number; c: string }) {
  return <rect x={x} y={y} width={18} height={18} rx={4.5} fill={c} />;
}

export function HomeScreenResult({ device }: { device: 'phone' | 'tablet' }) {
  const cols = device === 'phone' ? 4 : 7;
  const rows = device === 'phone' ? 4 : 3;
  const x0 = device === 'phone' ? 116 : 52;
  const y0 = device === 'phone' ? 34 : 38;
  const dx = device === 'phone' ? 22 : 33;
  const dy = device === 'phone' ? 33 : 44;
  const palette = [C.peach, C.mint, C.yellow, C.mustard, C.cream, C.strong];
  const cells = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const idx = r * cols + c;
      if (r === rows - 1 && c === 0) continue; // our app goes here
      cells.push(<AppIcon key={idx} x={x0 + c * dx} y={y0 + r * dy} c={palette[idx % palette.length]} />);
    }
  }
  const ox = x0;
  const oy = y0 + (rows - 1) * dy;
  const body = (
    <>
      {cells}
      <Hit x={ox - 5} y={oy - 5} w={28} h={42} r={7} />
      <Logo x={ox} y={oy} s={18} />
      <T x={ox + 9} y={oy + 27} size={5} fill={C.ink} anchor="middle" weight={500}>
        SuperConnector
      </T>
    </>
  );
  return (
    <Scene label="Home screen showing the new SuperConnector app icon">
      {device === 'phone' ? (
        <Phone>
          <rect x={108} y={9} width={104} height={202} rx={13.5} fill={C.soft} />
          {body}
          <rect x={146} y={203} width={28} height={3} rx={1.5} fill={C.ink} />
        </Phone>
      ) : (
        <Tablet>
          <rect x={29} y={13} width={262} height={194} rx={11} fill={C.soft} />
          {body}
        </Tablet>
      )}
      <Tag x={device === 'phone' ? 8 : 12} y={device === 'phone' ? 164 : 190} text="Your new app" />
    </Scene>
  );
}

export function IpadBrowser() {
  return (
    <Scene label="iPad Safari with the Share button in the top toolbar highlighted">
      <Tablet>
        <rect x={29} y={13} width={262} height={28} rx={11} fill={C.soft} />
        <g stroke={C.ink} strokeWidth={1.4} fill="none" strokeLinecap="round" strokeLinejoin="round">
          <path d="m50 27-4 3.5 4 3.5M64 27l4 3.5-4 3.5" />
        </g>
        <rect x={92} y={21} width={118} height={18} rx={9} fill={C.white} stroke={C.hair} />
        <T x={151} y={33} size={7} fill={C.muted} anchor="middle">
          bimaasuperconnector.github.io
        </T>
        <Hit x={236} y={19} w={22} h={22} r={11} />
        <ShareGlyph x={247} y={30} s={0.9} />
        <PlusApp x={272} y={30} />
        <PageBody x={80} y={62} w={160} />
      </Tablet>
      <Tag x={150} y={190} text="Tap Share (top right)" />
    </Scene>
  );
}

export function IpadShareSheet() {
  return (
    <Scene label="iPad share menu with Add to Home Screen highlighted">
      <Tablet>
        <rect x={29} y={13} width={262} height={28} rx={11} fill={C.soft} />
        <rect x={92} y={21} width={118} height={18} rx={9} fill={C.white} stroke={C.hair} />
        <ShareGlyph x={247} y={30} s={0.9} />
        <PageBody x={60} y={62} w={160} />
        <rect x={158} y={46} width={128} height={112} rx={10} fill={C.white} stroke={C.hair} />
        <T x={222} y={62} size={7.5} fill={C.muted} anchor="middle">
          SuperConnector
        </T>
        {[
          ['Copy', 70],
          ['Add to Bookmarks', 90],
          ['Add to Home Screen', 110],
          ['Find on Page', 130],
        ].map(([label, y]) => (
          <g key={label as string}>
            {label === 'Add to Home Screen' && <Hit x={163} y={(y as number) - 4} w={118} h={22} r={5} />}
            <rect x={168} y={(y as number) + 1} width={11} height={11} rx={2.5} fill={label === 'Add to Home Screen' ? C.ink : C.strong} />
            <T x={187} y={(y as number) + 10} size={7.5} weight={label === 'Add to Home Screen' ? 600 : 400}>
              {label as string}
            </T>
          </g>
        ))}
      </Tablet>
      <Tag x={34} y={190} text="Add to Home Screen" />
    </Scene>
  );
}

/* =========================== generic dialog =========================== */

function Dialog({
  x,
  y,
  w,
  title,
  subtitle,
  primary,
  secondary = 'Cancel',
}: {
  x: number;
  y: number;
  w: number;
  title: string;
  subtitle: string;
  primary: string;
  secondary?: string;
}) {
  const h = 78;
  const pw = primary.length * 5 + 16;
  const sw = secondary.length * 5 + 14;
  return (
    <g>
      <rect x={x + 1} y={y + 3} width={w} height={h} rx={10} fill={C.ink} fillOpacity={0.12} />
      <rect x={x} y={y} width={w} height={h} rx={10} fill={C.white} stroke={C.hair} />
      <Logo x={x + 10} y={y + 10} s={26} />
      <T x={x + 43} y={y + 22} size={8} weight={600}>
        {title}
      </T>
      <T x={x + 43} y={y + 33} size={6} fill={C.muted}>
        {subtitle}
      </T>
      <rect x={x + w - sw - pw - 16} y={y + 52} width={sw} height={16} rx={6} fill={C.white} stroke={C.hair} />
      <T x={x + w - sw - pw - 16 + sw / 2} y={y + 63} size={7} anchor="middle">
        {secondary}
      </T>
      <Hit x={x + w - pw - 10} y={y + 49} w={pw + 4} h={22} r={8} />
      <rect x={x + w - pw - 8} y={y + 52} width={pw} height={16} rx={6} fill={C.ink} />
      <T x={x + w - 8 - pw / 2} y={y + 63} size={7} fill={C.white} weight={500} anchor="middle">
        {primary}
      </T>
    </g>
  );
}

export function IpadAddScreen() {
  return (
    <Scene label="iPad Add to Home Screen dialog with the Add button highlighted">
      <Tablet>
        <rect x={29} y={13} width={262} height={194} rx={11} fill={C.ink} fillOpacity={0.18} />
        <Dialog x={80} y={62} w={160} title="SuperConnector" subtitle="bimaasuperconnector.github.io" primary="Add" />
      </Tablet>
      <Tag x={34} y={190} text="Tap Add" />
    </Scene>
  );
}

/* =========================== Android =========================== */

export function AndroidBrowser({
  position,
  icon,
  open,
  items,
  hl,
  tag,
}: {
  position: 'top' | 'bottom';
  icon: 'dots' | 'bars';
  open: boolean;
  items: string[];
  hl: number;
  tag: string;
}) {
  const menuBtn = position === 'top' ? { x: 198, y: 30 } : { x: 198, y: 196 };
  const rowH = 22;
  const menuH = items.length * rowH + 8;
  const menuY = position === 'top' ? 44 : 178 - menuH;
  return (
    <Scene label={open ? `Android browser menu open with ${items[hl]} highlighted` : 'Android browser with the menu button highlighted'}>
      <Phone>
        {position === 'top' && (
          <g>
            <rect x={108} y={20} width={104} height={20} fill={C.soft} />
            <rect x={114} y={23} width={74} height={14} rx={7} fill={C.white} stroke={C.hair} />
            <T x={151} y={33} size={6} fill={C.muted} anchor="middle">
              bimaasuperconnector…
            </T>
          </g>
        )}
        <PageBody x={112} y={position === 'top' ? 56 : 44} w={96} />
        {position === 'bottom' && (
          <g>
            <rect x={108} y={176} width={104} height={35} fill={C.soft} />
            <rect x={114} y={179} width={74} height={14} rx={7} fill={C.white} stroke={C.hair} />
            <T x={151} y={189} size={6} fill={C.muted} anchor="middle">
              bimaasuperconnector…
            </T>
          </g>
        )}
        {!open && <Hit x={menuBtn.x - 11} y={menuBtn.y - 11} w={22} h={22} r={11} />}
        {icon === 'dots' ? <Dots x={menuBtn.x} y={menuBtn.y} /> : <Bars x={menuBtn.x} y={menuBtn.y} />}
        {open && (
          <g>
            <rect x={129} y={menuY + 2} width={80} height={menuH} rx={7} fill={C.ink} fillOpacity={0.14} />
            <rect x={128} y={menuY} width={80} height={menuH} rx={7} fill={C.white} stroke={C.hair} />
            {items.map((label, i) => (
              <g key={label}>
                {i === hl && <Hit x={131} y={menuY + 4 + i * rowH} w={74} h={rowH - 2} r={5} />}
                <T x={137} y={menuY + 4 + i * rowH + 13} size={7} weight={i === hl ? 600 : 400}>
                  {label}
                </T>
              </g>
            ))}
          </g>
        )}
      </Phone>
      <Tag x={8} y={position === 'top' ? 28 : 188} text={tag} />
    </Scene>
  );
}

export function AndroidInstallDialog({ primary = 'Install' }: { primary?: string }) {
  return (
    <Scene label={`Android install confirmation with the ${primary} button highlighted`}>
      <Phone dim>
        <PageBody x={112} y={44} w={96} />
        <Dialog x={113} y={92} w={94} title="Install app?" subtitle="SuperConnector" primary={primary} secondary="Cancel" />
      </Phone>
      <Tag x={8} y={110} text={`Tap ${primary}`} />
    </Scene>
  );
}

/* =========================== Desktop =========================== */

function Window({
  os,
  children,
  addressInstall,
  menu = true,
}: {
  os: 'windows' | 'mac';
  children?: ReactNode;
  addressInstall?: 'monitor' | 'plus' | null;
  menu?: boolean;
}) {
  return (
    <g>
      <rect x={16} y={10} width={288} height={186} rx={os === 'mac' ? 9 : 4} fill={C.white} stroke={C.border} />
      <rect x={16} y={10} width={288} height={24} rx={os === 'mac' ? 9 : 4} fill={C.strong} />
      <rect x={16} y={26} width={288} height={8} fill={C.strong} />
      {os === 'mac' ? (
        <g>
          <circle cx={29} cy={22} r={3.4} fill="#ff5f57" />
          <circle cx={40} cy={22} r={3.4} fill="#febc2e" />
          <circle cx={51} cy={22} r={3.4} fill="#28c840" />
        </g>
      ) : (
        <g stroke={C.ink} strokeWidth={1} fill="none">
          <path d="M262 22h7M278 18.5h7v7h-7zM294 18.5l6.5 7M300.5 18.5 294 25.5" />
        </g>
      )}
      <rect x={os === 'mac' ? 64 : 24} y={14} width={78} height={20} rx={5} fill={C.white} />
      <T x={os === 'mac' ? 103 : 63} y={27} size={6.5} anchor="middle" fill={C.muted}>
        SuperConnector
      </T>
      <rect x={16} y={34} width={288} height={22} fill={C.white} />
      <line x1={16} y1={56} x2={304} y2={56} stroke={C.hair} />
      <g stroke={C.ink} strokeWidth={1.2} fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="m30 45-3.5 3.5L30 52M44 45l3.5 3.5L44 52" />
      </g>
      <rect x={64} y={38} width={198} height={14} rx={7} fill={C.soft} stroke={C.hair} />
      <T x={92} y={48} size={6.5} fill={C.muted}>
        bimaasuperconnector.github.io
      </T>
      {addressInstall && (
        <g>
          <Hit x={241} y={37} w={18} h={16} r={7} />
          {addressInstall === 'monitor' ? <InstallGlyph x={250} y={45} /> : <PlusApp x={250} y={45} />}
        </g>
      )}
      {menu && <Dots x={285} y={45} />}
      {children}
    </g>
  );
}

function DesktopPage() {
  return (
    <g>
      <PageBody x={80} y={76} w={160} />
    </g>
  );
}

export function DesktopAddressInstall({ os, glyph }: { os: 'windows' | 'mac'; glyph: 'monitor' | 'plus' }) {
  return (
    <Scene label="Desktop browser with the install icon in the address bar highlighted">
      <Window os={os} addressInstall={glyph}>
        <DesktopPage />
      </Window>
      <Tag x={172} y={170} text="Click the install icon" />
    </Scene>
  );
}

export function DesktopMenu({ os, parent, child }: { os: 'windows' | 'mac'; parent: string; child: string }) {
  return (
    <Scene label={`Browser menu with ${child} highlighted`}>
      <Window os={os}>
        <DesktopPage />
        <rect x={191} y={61} width={108} height={64} rx={6} fill={C.white} stroke={C.hair} />
        <T x={198} y={76} size={7} fill={C.muted}>
          New tab
        </T>
        <T x={198} y={91} size={7} fill={C.muted}>
          History
        </T>
        <rect x={194} y={97} width={102} height={18} rx={4} fill={C.strong} />
        <T x={198} y={109} size={7} weight={500}>
          {parent}
        </T>
        <T x={288} y={109} size={7}>
          ›
        </T>
        <rect x={72} y={92} width={116} height={46} rx={6} fill={C.white} stroke={C.hair} />
        <T x={79} y={106} size={7} fill={C.muted}>
          Save page as…
        </T>
        <Hit x={75} y={111} w={110} h={18} r={5} />
        <T x={80} y={123} size={7} weight={600}>
          {child}
        </T>
      </Window>
      <Tag x={20} y={170} text={`${parent} → ${child}`} />
    </Scene>
  );
}

export function DesktopInstallDialog({ os, primary = 'Install' }: { os: 'windows' | 'mac'; primary?: string }) {
  return (
    <Scene label={`Desktop install dialog with the ${primary} button highlighted`}>
      <Window os={os} addressInstall={null}>
        <DesktopPage />
        <Dialog x={150} y={60} w={146} title="Install app?" subtitle="SuperConnector" primary={primary} secondary="Cancel" />
      </Window>
      <Tag x={20} y={170} text={`Click ${primary}`} />
    </Scene>
  );
}

export function DesktopAppResult({ os }: { os: 'windows' | 'mac' }) {
  return (
    <Scene label="SuperConnector open as its own app window with its icon in the taskbar or dock">
      <rect x={16} y={10} width={288} height={170} rx={os === 'mac' ? 9 : 4} fill={C.white} stroke={C.border} />
      <rect x={16} y={10} width={288} height={22} rx={os === 'mac' ? 9 : 4} fill={C.ink} />
      <rect x={16} y={24} width={288} height={8} fill={C.ink} />
      {os === 'mac' ? (
        <g>
          <circle cx={29} cy={21} r={3.4} fill="#ff5f57" />
          <circle cx={40} cy={21} r={3.4} fill="#febc2e" />
          <circle cx={51} cy={21} r={3.4} fill="#28c840" />
        </g>
      ) : (
        <g stroke={C.white} strokeWidth={1} fill="none">
          <path d="M262 21h7M278 17.5h7v7h-7zM294 17.5l6.5 7M300.5 17.5 294 24.5" />
        </g>
      )}
      <T x={os === 'mac' ? 160 : 70} y={24.5} size={7} fill={C.white} weight={500} anchor="middle">
        SuperConnector
      </T>
      <PageBody x={80} y={52} w={160} />
      {os === 'windows' ? (
        <g>
          <rect x={16} y={188} width={288} height={24} rx={4} fill={C.ink} />
          <rect x={30} y={194} width={12} height={12} rx={2} fill={C.link} />
          <Hit x={96} y={190} w={26} h={20} r={5} />
          <Logo x={103} y={194} s={12} />
        </g>
      ) : (
        <g>
          <rect x={92} y={186} width={136} height={26} rx={9} fill={C.strong} stroke={C.hair} />
          {[100, 120, 140].map((x, i) => (
            <rect key={x} x={x} y={190} width={18} height={18} rx={4.5} fill={[C.peach, C.mint, C.yellow][i]} />
          ))}
          <Hit x={156} y={187} w={26} h={24} r={6} />
          <Logo x={160} y={190} s={18} />
          <rect x={196} y={190} width={18} height={18} rx={4.5} fill={C.cream} />
        </g>
      )}
      <Tag x={20} y={158} text={os === 'windows' ? 'Pin it to your taskbar' : 'It lives in your Dock'} />
    </Scene>
  );
}

export function MacSafariFileMenu() {
  return (
    <Scene label="Safari on Mac with the File menu open and Add to Dock highlighted">
      <rect x={0} y={0} width={320} height={220} fill={C.soft} />
      <rect x={0} y={0} width={320} height={16} fill={C.white} stroke={C.hair} />
      <T x={10} y={11} size={8} weight={700}>
        {'\uF8FF'}
      </T>
      {[
        ['Safari', 24],
        ['File', 60],
        ['Edit', 84],
        ['View', 106],
        ['History', 130],
        ['Bookmarks', 164],
      ].map(([label, x]) => (
        <T key={label as string} x={x as number} y={11} size={7.5} weight={label === 'File' ? 600 : 400}>
          {label as string}
        </T>
      ))}
      <Hit x={55} y={2} w={24} h={13} r={4} />
      <rect x={14} y={28} width={292} height={170} rx={9} fill={C.white} stroke={C.border} />
      <PageBody x={80} y={80} w={160} />
      <rect x={52} y={17} width={118} height={92} rx={6} fill={C.white} stroke={C.hair} />
      {[
        ['New Window', 24],
        ['New Tab', 38],
        ['Open File…', 52],
        ['Share', 66],
        ['Add to Dock…', 86],
      ].map(([label, y]) => (
        <g key={label as string}>
          {label === 'Add to Dock…' && <Hit x={55} y={(y as number) - 10} w={112} h={16} r={4} />}
          <T x={62} y={y as number} size={7} weight={label === 'Add to Dock…' ? 600 : 400}>
            {label as string}
          </T>
        </g>
      ))}
      <Tag x={180} y={52} text="File → Add to Dock…" />
    </Scene>
  );
}

export function MacAddToDock() {
  return (
    <Scene label="Safari Add to Dock dialog with the Add button highlighted">
      <rect x={14} y={14} width={292} height={184} rx={9} fill={C.white} stroke={C.border} />
      <rect x={14} y={14} width={292} height={184} rx={9} fill={C.ink} fillOpacity={0.15} />
      <Dialog x={80} y={72} w={160} title="SuperConnector" subtitle="bimaasuperconnector.github.io" primary="Add" />
      <Tag x={20} y={178} text="Click Add" />
    </Scene>
  );
}

/* =========================== Notifications =========================== */

export function NotificationPromptMobile() {
  return (
    <Scene label="Phone notification permission prompt with the Allow button highlighted">
      <Phone dim>
        <PageBody x={112} y={44} w={96} />
        <rect x={116} y={78} width={88} height={78} rx={10} fill={C.white} stroke={C.hair} />
        <T x={160} y={94} size={6.8} weight={600} anchor="middle">
          “SuperConnector” would like
        </T>
        <T x={160} y={104} size={6.8} weight={600} anchor="middle">
          to send you notifications
        </T>
        <line x1={116} y1={118} x2={204} y2={118} stroke={C.hair} />
        <line x1={160} y1={118} x2={160} y2={156} stroke={C.hair} />
        <T x={138} y={140} size={8} fill={C.link} anchor="middle">
          Don’t Allow
        </T>
        <Hit x={162} y={122} w={40} h={30} r={6} />
        <T x={182} y={140} size={8} fill={C.link} weight={600} anchor="middle">
          Allow
        </T>
      </Phone>
      <Tag x={8} y={110} text="Tap Allow" />
    </Scene>
  );
}

export function NotificationPromptDesktop({ os }: { os: 'windows' | 'mac' }) {
  return (
    <Scene label="Desktop notification permission prompt with the Allow button highlighted">
      <Window os={os}>
        <DesktopPage />
        <rect x={62} y={60} width={150} height={66} rx={8} fill={C.white} stroke={C.hair} />
        <rect x={63} y={62} width={150} height={66} rx={8} fill={C.ink} fillOpacity={0.08} />
        <rect x={62} y={60} width={150} height={66} rx={8} fill={C.white} stroke={C.hair} />
        <T x={72} y={76} size={7} weight={600}>
          bimaasuperconnector.github.io
        </T>
        <T x={72} y={88} size={6.8} fill={C.muted}>
          wants to show notifications
        </T>
        <rect x={116} y={100} width={42} height={17} rx={6} fill={C.white} stroke={C.hair} />
        <T x={137} y={111.5} size={7} anchor="middle">
          Block
        </T>
        <Hit x={160} y={97} w={46} h={23} r={8} />
        <rect x={162} y={100} width={42} height={17} rx={6} fill={C.ink} />
        <T x={183} y={111.5} size={7} fill={C.white} weight={500} anchor="middle">
          Allow
        </T>
      </Window>
      <Tag x={20} y={170} text="Click Allow" />
    </Scene>
  );
}

export function NotificationBanner() {
  return (
    <Scene label="Example of a SuperConnector notification appearing on your device">
      <rect x={52} y={52} width={216} height={50} rx={12} fill={C.white} stroke={C.hair} />
      <Logo x={62} y={62} s={30} />
      <T x={102} y={74} size={8.5} weight={600}>
        SuperConnector
      </T>
      <T x={102} y={87} size={7.5} fill={C.muted}>
        New job posted
      </T>
      <T x={258} y={74} size={7} fill={C.muted} anchor="end">
        now
      </T>
      <rect x={72} y={112} width={176} height={36} rx={10} fill={C.white} stroke={C.hair} opacity={0.7} />
      <Logo x={80} y={118} s={24} />
      <T x={112} y={130} size={7.5} weight={600}>
        SuperConnector
      </T>
      <T x={112} y={141} size={6.5} fill={C.muted}>
        Your monthly connection is ready
      </T>
      <Tag x={52} y={168} text="Heads-up on this device" />
    </Scene>
  );
}
