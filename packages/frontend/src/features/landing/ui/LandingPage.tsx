import { Link } from 'react-router';
import { Logo } from '../../../shared/ui/Logo';
import { Button } from '../../../shared/ui/Button';

export function LandingPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-background">
      <Logo size="lg" />
      <div className="flex items-center gap-4">
        <Link to="/login">
          <Button variant="primary">Login</Button>
        </Link>
        <Link to="/signup">
          <Button variant="secondary">Sign Up</Button>
        </Link>
        <Link to="/docs">
          <Button variant="secondary">API Reference</Button>
        </Link>
      </div>
    </div>
  );
}
