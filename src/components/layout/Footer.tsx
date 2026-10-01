import { Link } from 'react-router-dom';
import { Container } from '../ui/Container';

export function Footer() {
  return (
    <footer className="border-t border-hairline bg-canvas py-xl text-body-md text-muted md:py-xxl">
      <Container className="flex flex-col gap-md md:flex-row md:items-center md:justify-between">
        <p className="text-[14px] leading-relaxed">
          © 2026 BIM Alumni Association. BIM, Trichy exclusive alumni network.
        </p>
        <nav aria-label="Legal" className="flex gap-lg">
          <Link to="/terms" className="text-muted hover:text-ink">
            Terms
          </Link>
          <Link to="/privacy" className="text-muted hover:text-ink">
            Privacy
          </Link>
        </nav>
      </Container>
    </footer>
  );
}
