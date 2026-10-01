import type { PropsWithChildren, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Container } from '../ui/Container';
import { LEGAL } from '../../lib/legalConfig';

export function LegalPage({
  title,
  intro,
  otherLink,
  children,
}: PropsWithChildren<{
  title: string;
  intro: ReactNode;
  otherLink: { to: string; label: string };
}>) {
  return (
    <section className="py-12 md:py-section">
      <Container className="max-w-[760px]">
        <h1 className="text-display-md text-ink">{title}</h1>
        <p className="mt-sm text-body-md text-muted">
          Effective {LEGAL.effectiveDate} · Last updated {LEGAL.effectiveDate}
        </p>
        <p className="mt-lg text-[16px] leading-relaxed text-body">{intro}</p>
        <div className="mt-xl space-y-xl text-[15px] leading-relaxed text-body">{children}</div>
        <p className="mt-xxl border-t border-hairline pt-lg text-body-md text-muted">
          This page is for information and is not legal advice. See also our{' '}
          <Link to={otherLink.to} className="text-link hover:text-link-active">
            {otherLink.label}
          </Link>
          .
        </p>
      </Container>
    </section>
  );
}

export function Section({ title, children }: PropsWithChildren<{ title: string }>) {
  return (
    <section>
      <h2 className="text-title-lg text-ink">{title}</h2>
      <div className="mt-sm space-y-sm">{children}</div>
    </section>
  );
}

export function Bullets({ items }: { items: ReactNode[] }) {
  return (
    <ul className="list-disc space-y-xs pl-lg">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}
