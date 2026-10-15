// Light / dark switch: a small track with a sliding knob that shows the
// current mode (sun or moon). Used in the dashboard, storefront and auth headers.
import { useTheme } from '../context/ThemeContext';

const Sun = () => <svg viewBox="0 0 24 24" aria-hidden="true">
  <circle cx="12" cy="12" r="4.2" fill="currentColor" />
  <g stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </g>
</svg>;

const Moon = () => <svg viewBox="0 0 24 24" aria-hidden="true">
  <path d="M20.2 14.6A8.3 8.3 0 0 1 9.4 3.8a8.5 8.5 0 1 0 10.8 10.8Z" fill="currentColor" />
</svg>;

export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return <button type="button" role="switch" aria-checked={dark} aria-label={label} title={label}
    className={`theme-switch${dark ? ' is-dark' : ''}${className ? ` ${className}` : ''}`} onClick={toggleTheme}>
    <span className="theme-switch-track" aria-hidden="true">
      <span className="theme-switch-ghost sun"><Sun /></span>
      <span className="theme-switch-ghost moon"><Moon /></span>
      <span className="theme-switch-stars"><i /><i /><i /></span>
    </span>
    <span className="theme-switch-knob" aria-hidden="true">
      <span className="theme-switch-icon sun"><Sun /></span>
      <span className="theme-switch-icon moon"><Moon /></span>
    </span>
  </button>;
}
