import type { ReactNode } from 'react';

/** Consistent page title block: display headline, optional lede, optional actions. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-md">
      <div className="min-w-0 max-w-[62ch]">
        <h1 className="font-haas-disp text-title-lg text-ink md:text-display-md">{title}</h1>
        {description && <p className="copy mt-xs">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-sm">{actions}</div>}
    </div>
  );
}

/** A quiet placeholder block for empty lists. */
export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-hairline bg-surface-soft px-lg py-xl text-center">
      <p className="text-label-md text-ink">{title}</p>
      {children && <p className="copy mx-auto mt-xs max-w-[46ch] text-muted">{children}</p>}
    </div>
  );
}

/** Loading placeholder: `count` skeleton blocks of the given height class. */
export function SkeletonList({ count = 3, heightClass = 'h-24' }: { count?: number; heightClass?: string }) {
  return (
    <div className="space-y-sm" aria-busy="true" aria-label="Loading">
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className={`skeleton ${heightClass}`} />
      ))}
    </div>
  );
}

/** Inline error line. */
export function ErrorNote({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-lg border border-signature-coral/30 bg-signature-coral/5 px-md py-sm text-body-md text-signature-coral">
      {children}
    </p>
  );
}
