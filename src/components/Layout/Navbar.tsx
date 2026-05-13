import { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Settings, Menu, X, ChevronDown, Moon, Sun } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { SearchBar } from '../SearchBar';
import { useAuth } from '../../store/useAuth';
import { useTheme } from '../../store/useTheme';
import { Avatar } from '../Avatar';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

function useDateDisplay() {
  const now = new Date();
  return now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  }).toUpperCase();
}

export function Navbar() {
  const location    = useLocation();
  const { isLoggedIn, email, username, avatar_url } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const dateDisplay = useDateDisplay();
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [extrasOpen, setExtrasOpen] = useState(false);
  const extrasRef = useRef<HTMLDivElement>(null);

  // Close both menus on route change
  useEffect(() => { setMenuOpen(false); setExtrasOpen(false); }, [location.pathname]);

  // Close extras dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (extrasRef.current && !extrasRef.current.contains(e.target as Node)) {
        setExtrasOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Main nav links visible on desktop
  const MAIN_NAV = [
    { label: 'Feed',      path: '/app' },
    { label: 'Discuss',   path: '/app/discuss' },
    { label: 'Watchlist', path: '/app/watchlists' },
    { label: 'Portfolio', path: '/app/portfolio' },
  ];

  // Extra tools — hidden behind "More ▾" on desktop
  const EXTRAS_NAV = [
    { label: 'Screener',     path: '/app/screener' },
    { label: 'Activity',     path: '/app/activity' },
    { label: 'Compare',      path: '/app/compare' },
    { label: 'Heatmap',      path: '/app/heatmap' },
    { label: 'Alerts',       path: '/app/alerts' },
    { label: 'How It Works', path: '/app/how-it-works' },
  ];

  // All links for the mobile menu
  const ALL_NAV = [...MAIN_NAV, ...EXTRAS_NAV];

  function closeMenu() { setMenuOpen(false); }

  return (
    <header className="sticky top-0 z-40" style={{ backgroundColor: 'var(--bg-page)' }}>
      {/* Accent stripe — thin cyan glow line */}
      <div className="nav-stripe h-px w-full" style={{ backgroundColor: 'var(--accent)' }} />

      {/* Main bar */}
      <div className="border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="mx-auto flex h-12 max-w-screen-xl items-center justify-between gap-4 px-5">

          {/* Brand */}
          <Link
            to="/"
            className="shrink-0 font-black uppercase"
            style={{ color: 'var(--text-primary)', fontFamily: '"IBM Plex Mono", monospace', fontSize: '0.875rem', letterSpacing: '0.22em' }}
          >
            SentimentSignal
          </Link>

          {/* ── Desktop right side ── */}
          <div className="hidden sm:flex items-center gap-4">
            <div className="max-w-xs flex-1">
              <SearchBar />
            </div>

            {/* Nav links with sliding indicator */}
            <nav className="flex items-center">
              {MAIN_NAV.map(({ label, path }) => {
                const active = path === '/app'
                  ? location.pathname === '/app'
                  : location.pathname.startsWith(path);
                return (
                  <Link
                    key={path}
                    to={path}
                    className="relative px-3 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors"
                    style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)' }}
                  >
                    {label}
                    {active && (
                      <motion.div
                        layoutId="nav-indicator"
                        className="absolute bottom-0 left-0 right-0 h-[2px]"
                        style={{ backgroundColor: 'var(--accent)' }}
                        transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                      />
                    )}
                  </Link>
                );
              })}

              {/* Extras "More ▾" dropdown */}
              <div ref={extrasRef} className="relative">
                <button
                  onClick={() => setExtrasOpen((v) => !v)}
                  className="relative flex items-center gap-0.5 px-3 py-1 text-[11px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    color: EXTRAS_NAV.some(({ path }) => location.pathname.startsWith(path))
                      ? 'var(--text-primary)'
                      : 'var(--text-muted)',
                  }}
                >
                  More
                  <ChevronDown size={10} style={{ transition: 'transform 0.15s', transform: extrasOpen ? 'rotate(180deg)' : 'rotate(0deg)' }} />
                  {EXTRAS_NAV.some(({ path }) => location.pathname.startsWith(path)) && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute bottom-0 left-0 right-0 h-[2px]"
                      style={{ backgroundColor: 'var(--accent)' }}
                      transition={{ type: 'spring', stiffness: 500, damping: 40 }}
                    />
                  )}
                </button>
                <AnimatePresence>
                  {extrasOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full mt-1 border py-1 z-50 min-w-[140px]"
                      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                    >
                      {EXTRAS_NAV.map(({ label, path }) => {
                        const active = location.pathname.startsWith(path);
                        return (
                          <Link
                            key={path}
                            to={path}
                            className="block px-4 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors hover:text-[var(--accent)]"
                            style={{ color: active ? 'var(--accent)' : 'var(--text-muted)', fontFamily: '"IBM Plex Mono", monospace' }}
                          >
                            {label}
                          </Link>
                        );
                      })}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </nav>

            {/* Dark/Light mode toggle */}
            <button
              onClick={toggleTheme}
              className="p-1.5 transition-colors hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Toggle dark/light mode"
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            </button>

            {/* Auth / Settings */}
            {isLoggedIn() ? (
              <Link
                to="/app/profile"
                className="flex items-center gap-2 rounded px-2 py-1 transition-colors hover:bg-[var(--bg-elevated)]"
                style={{ color: location.pathname === '/app/profile' ? 'var(--accent)' : 'var(--text-muted)' }}
                title="Profile & Settings"
              >
                <Avatar name={username ?? '?'} avatarUrl={avatar_url} size={22} />
                <span className="text-[9px] font-bold uppercase tracking-widest hidden sm:block truncate max-w-[80px]" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
                  {username ?? 'Profile'}
                </span>
                <Settings size={13} />
              </Link>
            ) : (
              <Link
                to="/auth"
                className="text-[9px] font-bold uppercase tracking-widest border px-2.5 py-1 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', fontFamily: '"IBM Plex Mono", monospace' }}
              >
                Sign in
              </Link>
            )}
          </div>

          {/* ── Mobile right side ── */}
          <div className="flex sm:hidden items-center gap-3">
            {isLoggedIn() ? (
              <Link to="/app/profile" onClick={closeMenu}>
                <Avatar name={username ?? '?'} avatarUrl={avatar_url} size={24} />
              </Link>
            ) : (
              <Link
                to="/auth"
                className="text-[12px] font-semibold border px-2.5 py-1 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
              >
                Sign in
              </Link>
            )}
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="p-1.5 transition-colors hover:text-[var(--accent)]"
              style={{ color: 'var(--text-muted)' }}
              aria-label="Toggle menu"
            >
              {menuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>
      </div>

      {/* ── Mobile menu ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="sm:hidden border-b overflow-hidden"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            <div className="px-5 py-4 space-y-4">
              {/* Search */}
              <SearchBar />

              {/* Nav links */}
              <nav className="flex flex-col gap-1">
                {ALL_NAV.map(({ label, path }) => {
                  const active = path === '/app'
                    ? location.pathname === '/app'
                    : location.pathname.startsWith(path);
                  return (
                    <Link
                      key={path}
                      to={path}
                      onClick={closeMenu}
                      className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors"
                      style={{
                        color: active ? 'var(--accent)' : 'var(--text-secondary)',
                        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
                      }}
                    >
                      {label}
                    </Link>
                  );
                })}
                {isLoggedIn() && (
                  <Link
                    to="/app/profile"
                    onClick={closeMenu}
                    className="flex items-center gap-2 px-3 py-2 text-[11px] font-bold uppercase tracking-widest transition-colors"
                    style={{
                      color: location.pathname === '/app/profile' ? 'var(--accent)' : 'var(--text-secondary)',
                      borderLeft: location.pathname === '/app/profile' ? '2px solid var(--accent)' : '2px solid transparent',
                      ...MONO,
                    }}
                  >
                    Profile &amp; Settings
                  </Link>
                )}
              </nav>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Secondary sub-nav */}
      <div className="border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
        <div className="mx-auto flex h-8 max-w-screen-xl items-center justify-end px-3 sm:px-5">
          <span className="text-[9px] font-bold tracking-widest select-none shrink-0 hidden sm:block" style={{ color: 'var(--text-muted)', ...MONO }}>
            {dateDisplay}
          </span>
        </div>
      </div>
    </header>
  );
}
