import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { ThemeToggle } from '../components/ThemeToggle';
import { landingVariants } from '../components/PageTransition';
import { useAuth } from '../store/useAuth';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

const SIGNALS = [
  { ticker: 'AAPL',  dir: '▲', pct: '2.31%', label: 'Strongly Bullish', color: '#16a34a' },
  { ticker: 'TSLA',  dir: '▼', pct: '1.87%', label: 'Bearish',          color: '#ef4444' },
  { ticker: 'NVDA',  dir: '▲', pct: '3.14%', label: 'Bullish',          color: '#22c55e' },
  { ticker: 'META',  dir: '▲', pct: '0.94%', label: 'Bullish',          color: '#22c55e' },
  { ticker: 'AMZN',  dir: '▼', pct: '0.52%', label: 'Neutral',          color: '#d97706' },
  { ticker: 'MSFT',  dir: '▲', pct: '1.42%', label: 'Bullish',          color: '#22c55e' },
  { ticker: 'JPM',   dir: '▲', pct: '0.78%', label: 'Bullish',          color: '#22c55e' },
  { ticker: 'GOOGL', dir: '▼', pct: '0.33%', label: 'Neutral',          color: '#d97706' },
  { ticker: 'BRK-B', dir: '▲', pct: '0.61%', label: 'Bullish',          color: '#22c55e' },
  { ticker: 'XOM',   dir: '▼', pct: '1.19%', label: 'Bearish',          color: '#ef4444' },
];

const STREAM = [
  { time: '14:32:07', ticker: 'NVDA',  signal: 'BULLISH',       score: '+0.71', src: 'Reuters'       },
  { time: '14:31:54', ticker: 'TSLA',  signal: 'BEARISH',       score: '-0.44', src: 'Bloomberg'     },
  { time: '14:31:22', ticker: 'AAPL',  signal: 'STRONGLY BULL', score: '+0.82', src: 'WSJ'           },
  { time: '14:30:58', ticker: 'META',  signal: 'BULLISH',       score: '+0.39', src: 'CNBC'          },
  { time: '14:30:41', ticker: 'AMZN',  signal: 'NEUTRAL',       score: '+0.12', src: 'FT'            },
  { time: '14:30:09', ticker: 'MSFT',  signal: 'BULLISH',       score: '+0.55', src: 'MarketWatch'   },
  { time: '14:29:47', ticker: 'JPM',   signal: 'BULLISH',       score: '+0.61', src: 'Reuters'       },
  { time: '14:29:18', ticker: 'XOM',   signal: 'BEARISH',       score: '-0.38', src: 'Bloomberg'     },
  { time: '14:28:55', ticker: 'GOOGL', signal: 'NEUTRAL',       score: '-0.08', src: 'Yahoo'         },
  { time: '14:28:30', ticker: 'BRK-B', signal: 'BULLISH',       score: '+0.47', src: "Barron's"      },
  { time: '14:28:01', ticker: 'NVDA',  signal: 'STRONGLY BULL', score: '+0.91', src: 'Seeking Alpha' },
  { time: '14:27:44', ticker: 'TSLA',  signal: 'BEARISH',       score: '-0.52', src: 'CNBC'          },
];

const STATS = [
  { value: '50+',  label: 'News Sources'     },
  { value: '100+', label: 'Stocks Tracked'   },
  { value: '5',    label: 'Sentiment Levels' },
];

function signalColor(signal: string) {
  if (signal.includes('BULL')) return '#22c55e';
  if (signal.includes('BEAR')) return '#ef4444';
  return '#d97706';
}

export function Landing() {
  const navigate  = useNavigate();
  const { isLoggedIn, email } = useAuth();
  const [blink,     setBlink]     = useState(true);
  const [activeRow, setActiveRow] = useState(0);

  function goToApp() { navigate('/app'); }

  useEffect(() => {
    const onKey   = (e: KeyboardEvent) => { if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) goToApp(); };
    const onWheel = (e: WheelEvent)    => { if (e.deltaY > 0) goToApp(); };
    window.addEventListener('keydown', onKey);
    window.addEventListener('wheel', onWheel, { passive: true });
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('wheel', onWheel); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const t = setInterval(() => setBlink(b => !b), 700);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setActiveRow(r => (r + 1) % STREAM.length), 1400);
    return () => clearInterval(t);
  }, []);

  const ticker = [...SIGNALS, ...SIGNALS, ...SIGNALS];

  return (
    <motion.div variants={landingVariants} initial="initial" animate="animate" exit="exit">
      <div className="relative min-h-screen flex flex-col overflow-hidden" style={{ backgroundColor: 'var(--bg-page)' }}>

        {/* ── Top system bar ─────────────────────────────────────────── */}
        <div
          className="flex items-center justify-between px-6 py-2.5 border-b shrink-0"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
        >
          <span className="text-[11px] font-bold tracking-[0.25em]" style={{ color: 'var(--text-primary)', ...MONO }}>
            SENTIMENTSIGNAL
          </span>

          <div className="hidden sm:flex items-center gap-6 text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
            <span className="flex items-center gap-1.5 whitespace-nowrap">
              <span style={{ color: 'var(--accent)', opacity: blink ? 1 : 0.25, transition: 'opacity 0.15s' }}>●</span>
              <span>System: </span><span style={{ color: 'var(--accent)' }}>Live</span>
            </span>
            <span className="whitespace-nowrap">Engine: <span style={{ color: 'var(--text-secondary)' }}>Active</span></span>
            <span className="whitespace-nowrap">Sources: <span style={{ color: 'var(--text-secondary)' }}>50+</span></span>
          </div>

          <div className="flex items-center gap-3">
            {isLoggedIn() ? (
              <button
                onClick={goToApp}
                className="text-[9px] font-bold uppercase tracking-widest border px-3 py-1 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
              >
                {email?.split('@')[0]} →
              </button>
            ) : (
              <>
                <Link to="/auth" className="text-[9px] font-bold uppercase tracking-widest transition-colors hover:text-[var(--accent)]" style={{ color: 'var(--text-muted)', ...MONO }}>
                  Sign In
                </Link>
                <Link
                  to="/auth?mode=register"
                  className="text-[9px] font-bold uppercase tracking-widest border px-3 py-1 transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)', ...MONO }}
                >
                  Create Account
                </Link>
              </>
            )}
            <ThemeToggle />
          </div>
        </div>

        {/* ── Main split ─────────────────────────────────────────────── */}
        <div className="flex flex-1 min-h-0">

          {/* LEFT — hero */}
          <div className="flex flex-col justify-center px-8 sm:px-16 py-12 flex-1 min-w-0">

            <motion.div
              initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              className="mb-8 flex items-center gap-3"
            >
              <div className="h-px w-8" style={{ backgroundColor: 'var(--accent)' }} />
              <span className="text-[9px] font-bold uppercase tracking-[0.3em]" style={{ color: 'var(--accent)', ...MONO }}>
                Stock Sentiment Intelligence
              </span>
            </motion.div>

            <div className="mb-6">
              {['Read the', 'Market.'].map((line, i) => (
                <motion.div
                  key={line}
                  initial={{ opacity: 0, y: 28 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] as [number,number,number,number] }}
                >
                  <h1
                    className="font-black leading-none"
                    style={{
                      fontSize: 'clamp(3rem, 7vw, 6.5rem)',
                      letterSpacing: '-0.02em',
                      color: i === 1 ? 'var(--accent)' : 'var(--text-primary)',
                    }}
                  >
                    {line}
                  </h1>
                </motion.div>
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.5, duration: 0.5 }}
              className="mb-10 max-w-md text-sm leading-relaxed"
              style={{ color: 'var(--text-secondary)' }}
            >
              Sentiment scored from 50+ financial sources — Reuters, Bloomberg, WSJ and more.
              {' '}<span style={{ color: 'var(--text-muted)' }}>Trade with context, not just price.</span>
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.4 }}
              className="mb-12 flex items-center gap-5"
            >
              <motion.button
                onClick={goToApp}
                whileHover={{ x: 3 }} whileTap={{ scale: 0.98 }}
                className="group flex items-center gap-3 px-8 py-3.5 text-xs font-bold uppercase tracking-widest"
                style={{ backgroundColor: 'var(--accent)', color: '#000', ...MONO }}
              >
                Enter the Feed
                <ArrowRight size={13} className="transition-transform group-hover:translate-x-1" strokeWidth={2.5} />
              </motion.button>
              <Link
                to="/auth?mode=register"
                className="text-xs font-bold uppercase tracking-widest transition-colors hover:text-[var(--accent)]"
                style={{ color: 'var(--text-muted)', ...MONO }}
              >
                Create account →
              </Link>
            </motion.div>

            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              className="flex items-center gap-10 border-t pt-8"
              style={{ borderColor: 'var(--border)' }}
            >
              {STATS.map(s => (
                <div key={s.label} className="flex flex-col gap-1">
                  <span className="text-xl font-black tabular-nums" style={{ color: 'var(--text-primary)', ...MONO }}>
                    {s.value}
                  </span>
                  <span className="text-[8px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
                    {s.label}
                  </span>
                </div>
              ))}
            </motion.div>

          </div>

          {/* RIGHT — live signal panel (desktop only) */}
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.35, duration: 0.55 }}
            className="hidden lg:flex flex-col border-l shrink-0"
            style={{ width: '380px', borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3 border-b" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[9px] font-bold uppercase tracking-[0.25em]" style={{ color: 'var(--text-muted)', ...MONO }}>
                Live Signal Stream
              </span>
              <span className="flex items-center gap-1.5 text-[9px]" style={{ color: 'var(--accent)', ...MONO }}>
                <span style={{ opacity: blink ? 1 : 0.3, transition: 'opacity 0.15s' }}>●</span>
                LIVE
              </span>
            </div>

            {/* Column headers */}
            <div
              className="grid px-5 py-2 border-b"
              style={{ gridTemplateColumns: '58px 50px 1fr 56px', gap: '8px', borderColor: 'var(--border)' }}
            >
              {['TIME', 'TICKER', 'SIGNAL', 'SCORE'].map(h => (
                <span key={h} className="text-[8px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>{h}</span>
              ))}
            </div>

            {/* Rows */}
            <div className="flex-1 overflow-hidden">
              {STREAM.map((row, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 + i * 0.03 }}
                  className="grid px-5 py-2.5 border-b transition-colors"
                  style={{
                    gridTemplateColumns: '58px 50px 1fr 56px',
                    gap: '8px',
                    borderColor: 'var(--border)',
                    backgroundColor: i === activeRow ? 'var(--accent-dim)' : 'transparent',
                  }}
                >
                  <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-muted)', ...MONO }}>{row.time}</span>
                  <span className="text-[9px] font-bold" style={{ color: 'var(--text-primary)', ...MONO }}>{row.ticker}</span>
                  <span className="text-[9px] font-bold uppercase" style={{ color: signalColor(row.signal), ...MONO }}>{row.signal}</span>
                  <span className="text-[9px] font-bold tabular-nums text-right" style={{ color: signalColor(row.signal), ...MONO }}>{row.score}</span>
                </motion.div>
              ))}
            </div>

            {/* Footer */}
            <div className="px-5 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
              <span className="text-[8px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
                Sentiment scored via NLP · Updated continuously
              </span>
            </div>
          </motion.div>

        </div>

        {/* ── Ticker ────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
          className="overflow-hidden shrink-0 border-t"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
        >
          <div className="flex items-center py-1.5" style={{ animation: 'ticker-scroll 35s linear infinite', width: 'max-content' }}>
            {ticker.map((s, i) => (
              <span key={i} className="inline-flex items-center gap-2 px-5 text-[10px] border-r shrink-0" style={{ borderColor: 'var(--border)', ...MONO }}>
                <span style={{ color: s.color, fontSize: '7px' }}>●</span>
                <span className="font-black" style={{ color: 'var(--text-primary)' }}>{s.ticker}</span>
                <span className="font-bold" style={{ color: s.color }}>{s.dir} {s.pct}</span>
                <span style={{ color: 'var(--text-muted)' }}>{s.label}</span>
              </span>
            ))}
          </div>
        </motion.div>

        {/* ── Hint ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-center py-1.5 shrink-0" style={{ backgroundColor: 'var(--bg-page)' }}>
          <span className="text-[8px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
            Press Enter or scroll to explore
          </span>
        </div>

      </div>
    </motion.div>
  );
}
