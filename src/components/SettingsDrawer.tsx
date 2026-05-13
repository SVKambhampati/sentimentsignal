import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Check, Monitor, AlignJustify, AlignCenter, Eye, EyeOff, Bell } from 'lucide-react';
import { usePreferences, applyPreferences } from '../store/usePreferences';
import { useAuth } from '../store/useAuth';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

const ACCENT_PRESETS = [
  { label: 'Cyan',     value: '#22d3ee' },
  { label: 'Blue',     value: '#3b82f6' },
  { label: 'Purple',   value: '#a855f7' },
  { label: 'Orange',   value: '#f97316' },
  { label: 'Rose',     value: '#f43f5e' },
  { label: 'Green',    value: '#22c55e' },
  { label: 'Yellow',   value: '#eab308' },
  { label: 'White',    value: '#f0f0f0' },
];

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y'] as const;

const SECTIONS = [
  { key: 'tickertape', label: 'Ticker Tape' },
  { key: 'movers',     label: 'Top Movers'  },
  { key: 'mostactive', label: 'Most Active' },
  { key: 'trending',   label: 'Trending'    },
] as const;

interface Props {
  open:    boolean;
  onClose: () => void;
}

export function SettingsDrawer({ open, onClose }: Props) {
  const prefs       = usePreferences();
  const { isLoggedIn } = useAuth();
  const drawerRef   = useRef<HTMLDivElement>(null);
  const [customColor, setCustomColor] = useState(prefs.accent_color);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handle(e: MouseEvent) {
      if (drawerRef.current && !drawerRef.current.contains(e.target as Node)) onClose();
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function handle(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open, onClose]);

  async function handleSet(patch: Parameters<typeof prefs.set>[0]) {
    await prefs.set(patch);
    applyPreferences({ ...prefs, ...patch });
  }

  function toggleSection(key: string) {
    const current = prefs.hidden_sections;
    const next = current.includes(key)
      ? current.filter(s => s !== key)
      : [...current, key];
    handleSet({ hidden_sections: next });
  }

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50"
            style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
          />

          {/* Drawer */}
          <motion.div
            key="drawer"
            ref={drawerRef}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-80 overflow-y-auto flex flex-col"
            style={{
              backgroundColor: 'var(--bg-surface)',
              borderLeft: '1px solid var(--border)',
            }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 sticky top-0"
              style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}
            >
              <span className="text-[11px] font-black uppercase tracking-widest" style={{ ...MONO, color: 'var(--text-primary)' }}>
                Preferences
              </span>
              <button
                onClick={onClose}
                className="rounded p-1 transition-colors hover:bg-[var(--bg-elevated)]"
                style={{ color: 'var(--text-muted)' }}
              >
                <X size={16} />
              </button>
            </div>

            <div className="flex-1 px-5 py-4 flex flex-col gap-7">

              {/* ── Accent colour ────────────────────────────────── */}
              <Section title="Accent Color">
                <div className="flex flex-wrap gap-2">
                  {ACCENT_PRESETS.map(p => (
                    <button
                      key={p.value}
                      title={p.label}
                      onClick={() => handleSet({ accent_color: p.value })}
                      className="relative h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
                      style={{ backgroundColor: p.value, boxShadow: prefs.accent_color === p.value ? `0 0 0 2px var(--bg-surface), 0 0 0 4px ${p.value}` : undefined }}
                    >
                      {prefs.accent_color === p.value && (
                        <Check size={12} className="absolute inset-0 m-auto" style={{ color: '#000' }} />
                      )}
                    </button>
                  ))}
                </div>
                {/* Custom hex input */}
                <div className="mt-3 flex items-center gap-2">
                  <div
                    className="h-6 w-6 rounded-full shrink-0 border"
                    style={{ backgroundColor: customColor, borderColor: 'var(--border)' }}
                  />
                  <input
                    type="text"
                    value={customColor}
                    onChange={e => setCustomColor(e.target.value)}
                    onBlur={() => {
                      if (/^#[0-9a-fA-F]{6}$/.test(customColor)) handleSet({ accent_color: customColor });
                    }}
                    maxLength={7}
                    placeholder="#22c55e"
                    className="flex-1 bg-transparent border rounded px-2 py-1 text-[11px] outline-none focus:border-[var(--accent)]"
                    style={{ ...MONO, borderColor: 'var(--border)', color: 'var(--text-primary)' }}
                  />
                  <button
                    onClick={() => { if (/^#[0-9a-fA-F]{6}$/.test(customColor)) handleSet({ accent_color: customColor }); }}
                    className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded transition-colors"
                    style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', ...MONO }}
                  >
                    Set
                  </button>
                </div>
              </Section>

              {/* ── Default chart timeframe ───────────────────────── */}
              <Section title="Default Chart Timeframe">
                <div className="flex gap-1.5">
                  {TIMEFRAMES.map(tf => (
                    <button
                      key={tf}
                      onClick={() => handleSet({ default_timeframe: tf })}
                      className="flex-1 py-1.5 rounded text-[11px] font-bold transition-colors"
                      style={{
                        ...MONO,
                        backgroundColor: prefs.default_timeframe === tf ? 'var(--accent)' : 'var(--bg-elevated)',
                        color:           prefs.default_timeframe === tf ? '#000'          : 'var(--text-muted)',
                      }}
                    >
                      {tf}
                    </button>
                  ))}
                </div>
              </Section>

              {/* ── Density ──────────────────────────────────────────── */}
              <Section title="Layout Density">
                <div className="flex gap-2">
                  {(['comfortable', 'compact'] as const).map(d => (
                    <button
                      key={d}
                      onClick={() => handleSet({ density: d })}
                      className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded border transition-colors"
                      style={{
                        borderColor:     prefs.density === d ? 'var(--accent)' : 'var(--border)',
                        backgroundColor: prefs.density === d ? 'var(--accent-dim)' : 'transparent',
                        color:           prefs.density === d ? 'var(--accent)' : 'var(--text-muted)',
                      }}
                    >
                      {d === 'comfortable' ? <AlignCenter size={14} /> : <AlignJustify size={14} />}
                      <span className="text-[11px] font-bold capitalize" style={MONO}>{d}</span>
                    </button>
                  ))}
                </div>
              </Section>

              {/* ── Source credibility filter ─────────────────────── */}
              <Section title={`Source Credibility Filter — min ${prefs.min_credibility}`}>
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={10}
                  value={prefs.min_credibility}
                  onChange={e => handleSet({ min_credibility: Number(e.target.value) })}
                  className="w-full accent-[var(--accent)]"
                  style={{ accentColor: 'var(--accent)' }}
                />
                <div className="flex justify-between mt-1">
                  <span className="text-[9px]" style={{ ...MONO, color: 'var(--text-muted)' }}>All sources</span>
                  <span className="text-[9px]" style={{ ...MONO, color: 'var(--text-muted)' }}>Top-tier only</span>
                </div>
                <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>
                  {prefs.min_credibility === 0
                    ? 'Showing articles from all sources'
                    : `Only showing sources with credibility ≥ ${prefs.min_credibility}`}
                </p>
              </Section>

              {/* ── Hide / show dashboard sections ───────────────── */}
              <Section title="Dashboard Sections">
                <div className="flex flex-col gap-2">
                  {SECTIONS.map(({ key, label }) => {
                    const hidden = prefs.hidden_sections.includes(key);
                    return (
                      <button
                        key={key}
                        onClick={() => toggleSection(key)}
                        className="flex items-center justify-between px-3 py-2 rounded border transition-colors"
                        style={{
                          borderColor:     hidden ? 'var(--border)' : 'var(--accent)',
                          backgroundColor: hidden ? 'var(--bg-elevated)' : 'var(--accent-dim)',
                          color:           hidden ? 'var(--text-muted)' : 'var(--accent)',
                        }}
                      >
                        <span className="text-[11px] font-bold uppercase tracking-widest" style={MONO}>{label}</span>
                        {hidden
                          ? <EyeOff size={13} />
                          : <Eye    size={13} />}
                      </button>
                    );
                  })}
                </div>
              </Section>

              {/* ── Price Alerts link ────────────────────────────── */}
              <Section title="Alerts">
                <Link
                  to="/app/alerts"
                  onClick={onClose}
                  className="flex items-center gap-2 px-3 py-2.5 border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', display: 'inline-flex' }}
                >
                  <Bell size={13} />
                  <span className="text-[10px] font-bold uppercase tracking-widest" style={MONO}>Price Alerts</span>
                </Link>
              </Section>

              {/* ── Personalized feed note ───────────────────────── */}
              <Section title="Personalized Feed">
                <div
                  className="rounded p-3 text-[11px] leading-relaxed"
                  style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                >
                  {isLoggedIn() ? (
                    <>
                      <span style={{ color: 'var(--accent)', ...MONO, fontSize: 10 }}>ACTIVE</span>
                      <p className="mt-1">Your feed is ranked by watchlist matches and stocks you've recently viewed. Keep browsing to improve it.</p>
                    </>
                  ) : (
                    <>
                      <span style={{ color: 'var(--text-muted)', ...MONO, fontSize: 10 }}>SIGN IN TO ENABLE</span>
                      <p className="mt-1">Sign in to get a feed ranked by your watchlist and browsing history.</p>
                    </>
                  )}
                </div>
              </Section>

            </div>

            {/* Footer */}
            <div
              className="px-5 py-3 text-[9px] text-center"
              style={{ borderTop: '1px solid var(--border)', color: 'var(--text-muted)', ...MONO }}
            >
              Preferences are saved {isLoggedIn() ? 'to your account' : 'locally in your browser'}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2.5 text-[9px] font-black uppercase tracking-widest" style={{ ...MONO, color: 'var(--text-muted)' }}>
        {title}
      </p>
      {children}
    </div>
  );
}
