import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Container } from '../ui/Container';
import { RouterLinkButton } from '../ui/Button';

/**
 * Scroll thresholds (px). The brand collapses once the page is scrolled past
 * COLLAPSE_AT and only expands again near the very top (EXPAND_AT). The gap
 * between the two is deliberate hysteresis: without it, a scroll position
 * sitting right on a single threshold would flicker between both states.
 */
const COLLAPSE_AT = 48;
const EXPAND_AT = 8;
const BORDER_AT = 4;

function useHeaderScroll() {
  const [compact, setCompact] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const y = window.scrollY;
      setCompact((prev) => (prev ? y > EXPAND_AT : y > COLLAPSE_AT));
      setScrolled(y > BORDER_AT);
    };
    const onScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return { compact, scrolled };
}

/**
 * A run of letters that collapses to zero width (and fades) when `open` is
 * false. Animating grid-template-columns between 1fr and 0fr gives an exact,
 * content-sized width transition — no guessed max-width values. Below 360px
 * the collapsed form is forced so the header can never overflow.
 */
function Collapsible({ open, children }: { open: boolean; children: string }) {
  return (
    <span
      className={`grid transition-[grid-template-columns,opacity] duration-300 ease-out motion-reduce:transition-none ${
        open ? 'grid-cols-[1fr] opacity-100' : 'grid-cols-[0fr] opacity-0'
      } max-[359px]:grid-cols-[0fr] max-[359px]:opacity-0`}
    >
      <span className="min-w-0 overflow-hidden">{children}</span>
    </span>
  );
}

export function TopNav() {
  const { compact, scrolled } = useHeaderScroll();

  return (
    <header
      className={`sticky top-0 z-30 h-16 w-full border-b bg-canvas transition-colors duration-200 ${
        scrolled ? 'border-hairline' : 'border-transparent'
      }`}
    >
      {/* Flex on phones/tablets; a 3-column grid from lg up so the centred nav and the
          right-hand button stay put while the brand on the left changes width. */}
      <Container className="flex h-full items-center justify-between lg:grid lg:grid-cols-[1fr_auto_1fr]">
        <Link
          to="/"
          aria-label="BIM Alumni Association, home"
          className="flex items-center gap-sm justify-self-start"
        >
          <img
            src="/assets/branding/logo-192.png"
            width={32}
            height={32}
            alt=""
            className="h-8 w-8 shrink-0"
          />
          {/* Visual-only: the link's aria-label carries the full name in both
              states, so screen readers never hear the collapsed form. */}
          <span
            aria-hidden="true"
            className="flex whitespace-nowrap font-haas-disp text-[15px] font-medium text-ink min-[400px]:text-title-sm"
          >
            <span>BIM&nbsp;A</span>
            <Collapsible open={!compact}>{'lumni\u00a0'}</Collapsible>
            <span>A</span>
            <Collapsible open={!compact}>ssociation</Collapsible>
          </span>
        </Link>

        <nav className="hidden items-center gap-xl text-body-md text-body lg:flex">
          <Link to="/#how-it-works" className="text-body hover:text-ink">
            How it works
          </Link>
          <Link to="/#network" className="text-body hover:text-ink">
            The network
          </Link>
        </nav>

        <RouterLinkButton to="/login" variant="primary" className="justify-self-end px-md py-sm min-[400px]:px-lg">
          Sign in
        </RouterLinkButton>
      </Container>
    </header>
  );
}
