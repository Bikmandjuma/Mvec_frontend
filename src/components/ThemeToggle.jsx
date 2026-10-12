import Icon from './Icon';
import { useTheme } from '../context/ThemeContext';

/**
 * The one light/dark switch used everywhere (storefront, auth pages and
 * dashboards) so it looks and behaves the same on every screen.
 */
export default function ThemeToggle({ className = '' }) {
  const { theme, toggleTheme } = useTheme();
  const dark = theme === 'dark';
  const label = dark ? 'Switch to light mode' : 'Switch to dark mode';
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label={label}
      title={label}
      onClick={toggleTheme}
      className={`theme-switch ${dark ? 'is-dark' : ''} ${className}`.trim()}
    >
      <span className="theme-switch-icon theme-switch-sun" aria-hidden="true"><Icon name="sun" size={14} /></span>
      <span className="theme-switch-icon theme-switch-moon" aria-hidden="true"><Icon name="moon" size={14} /></span>
      <span className="theme-switch-knob" aria-hidden="true"><Icon name={dark ? 'moon' : 'sun'} size={14} /></span>
    </button>
  );
}
