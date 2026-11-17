import { Link } from 'react-router-dom';
import ThemeToggle from './ThemeToggle';

/** Sign-in, sign-up and password pages: a photo beside the form (form only on phones). */
export default function AuthLayout({ title, subtitle, children }) {
  return (
    <main className="auth">
      <aside className="auth-photo">
        <img src="/hero-standin.jpg" alt="" />
        <div>
          <Link to="/" className="site-logo">Ikiguzi</Link>
          <p>Trusted sellers,<br /><em>everyday finds.</em></p>
        </div>
      </aside>
      <section className="auth-side">
        <header className="auth-bar">
          <Link to="/" className="site-logo">Ikiguzi</Link>
          <ThemeToggle />
        </header>
        <div className="auth-card">
          <h1>{title}</h1>
          {subtitle && <p className="auth-sub">{subtitle}</p>}
          {children}
        </div>
      </section>
    </main>
  );
}
