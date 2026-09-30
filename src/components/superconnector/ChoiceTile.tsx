import type { ReactNode } from 'react';
import { CheckIcon } from '../icons/NavIcons';

/**
 * One big, tappable choice for the SuperConnector form (a radio in
 * disguise). Two looks, both built only from Design-superconnector.md
 * tokens:
 *  - `tone="pastel"` — the selected tile fills with a signature pastel
 *    (used for the day options, so each day keeps its own colour);
 *  - `tone="ink"` — the selected tile fills with the near-black primary
 *    (used for the connection format).
 * Unselected tiles are plain white with a hairline border, so the chosen
 * one is unmistakable at a glance, on a phone or a desktop.
 */
export function ChoiceTile({
  checked,
  disabled,
  onSelect,
  title,
  subtitle,
  detail,
  icon,
  tone,
  swatchClass,
  fillClass,
}: {
  checked: boolean;
  disabled?: boolean;
  onSelect: () => void;
  title: string;
  subtitle?: string;
  detail?: string;
  icon?: ReactNode;
  tone: 'pastel' | 'ink';
  /** Small colour chip shown on an unselected pastel tile (e.g. `bg-signature-peach`). */
  swatchClass?: string;
  /** Background of the selected pastel tile (e.g. `bg-signature-peach`). */
  fillClass?: string;
}) {
  const selected =
    tone === 'ink'
      ? 'border-ink bg-ink text-on-primary'
      : `border-ink ${fillClass ?? 'bg-signature-cream'} text-ink`;
  const idle = 'border-hairline bg-canvas text-ink active:bg-surface-soft';
  const mutedText = checked && tone === 'ink' ? 'text-on-primary/80' : 'text-body';

  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      disabled={disabled}
      onClick={onSelect}
      className={`relative flex min-h-[112px] w-full flex-col items-start justify-between gap-md rounded-lg border-2 p-md text-left transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? selected : idle
      }`}
    >
      <span className="flex w-full items-start justify-between gap-sm">
        {icon ? (
          <span
            aria-hidden="true"
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              checked ? (tone === 'ink' ? 'bg-on-primary/15' : 'bg-canvas/70') : 'bg-surface-soft'
            }`}
          >
            {icon}
          </span>
        ) : (
          <span
            aria-hidden="true"
            className={`mt-xxs h-3 w-3 rounded-xs ${checked ? 'bg-ink' : (swatchClass ?? 'bg-surface-strong')}`}
          />
        )}
        <span
          aria-hidden="true"
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 ${
            checked
              ? tone === 'ink'
                ? 'border-on-primary bg-on-primary text-ink'
                : 'border-ink bg-ink text-on-primary'
              : 'border-border-strong bg-canvas'
          }`}
        >
          {checked && <CheckIcon width={14} height={14} strokeWidth={2.5} />}
        </span>
      </span>
      <span className="block">
        <span className="block font-haas-disp text-title-sm font-medium">{title}</span>
        {subtitle && <span className={`mt-xxs block text-body-md ${mutedText}`}>{subtitle}</span>}
        {detail && <span className={`mt-xxs block text-caption font-medium ${mutedText}`}>{detail}</span>}
      </span>
    </button>
  );
}
