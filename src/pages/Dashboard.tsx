import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpRight, ArrowDownRight, RefreshCw, Calendar } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion, type Variants } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, Cell, ResponsiveContainer, ReferenceLine,
} from 'recharts';
import {
  getTrending, getShifters, getFeed, getEarnings, getMarketSummary,
  type TrendingStock, type ShifterStock, type Mention, type FeedSince, type MarketSummary,
} from '../api/stocks';
import { getPersonalizedFeed } from '../api/preferences';
import { usePreferences } from '../store/usePreferences';
import { useAuth } from '../store/useAuth';
import { staggerContainer, staggerItem, staggerItemFast } from '../components/PageEnter';

const feedVariants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' } },
};

// ─── Utilities ──────────────────────────────────────────────────────────────

// Mono is for data-only: tickers, prices, scores, percentages
const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

const SOURCE_LABELS: Record<string, string> = {
  'yahoo.com':           'Yahoo Finance',
  'finance.yahoo.com':   'Yahoo Finance',
  'uk.finance.yahoo.com':'Yahoo Finance',
  'bloomberg.com':       'Bloomberg',
  'reuters.com':         'Reuters',
  'wsj.com':             'Wall St. Journal',
  'a.dj.com':            'Wall St. Journal',
  'cnbc.com':            'CNBC',
  'marketwatch.com':     'MarketWatch',
  'businessinsider.com': 'Business Insider',
  'forbes.com':          'Forbes',
  'barrons.com':         "Barron's",
  'ft.com':              'Financial Times',
  'economist.com':       'The Economist',
  'seekingalpha.com':    'Seeking Alpha',
  'thestreet.com':       'The Street',
  'investopedia.com':    'Investopedia',
  'morningstar.com':     'Morningstar',
  'benzinga.com':        'Benzinga',
  'fool.com':            'Motley Fool',
  'motleyfool.com':      'Motley Fool',
  'zacks.com':           'Zacks',
  'investing.com':       'Investing.com',
  'kiplinger.com':       'Kiplinger',
  'nasdaq.com':          'Nasdaq',
  'prnewswire.com':      'PR Newswire',
  'globenewswire.com':   'GlobeNewswire',
  'businesswire.com':    'Business Wire',
};

// Source → accent color blocks (The Verge-style thumbnails)
const SOURCE_COLORS: Record<string, { bg: string; label: string }> = {
  'bloomberg.com':       { bg: '#000000', label: 'BG' },
  'reuters.com':         { bg: '#FF6200', label: 'RT' },
  'wsj.com':             { bg: '#004276', label: 'WJ' },
  'a.dj.com':            { bg: '#004276', label: 'WJ' },
  'cnbc.com':            { bg: '#CC0000', label: 'CB' },
  'marketwatch.com':     { bg: '#004899', label: 'MW' },
  'ft.com':              { bg: '#FD0F58', label: 'FT' },
  'economist.com':       { bg: '#E3120B', label: 'EC' },
  'yahoo.com':           { bg: '#6001D2', label: 'YF' },
  'finance.yahoo.com':   { bg: '#6001D2', label: 'YF' },
  'uk.finance.yahoo.com':{ bg: '#6001D2', label: 'YF' },
  'seekingalpha.com':    { bg: '#1C6B3A', label: 'SA' },
  'businessinsider.com': { bg: '#E03E2D', label: 'BI' },
  'forbes.com':          { bg: '#000000', label: 'FB' },
  'barrons.com':         { bg: '#1A1A6E', label: 'BR' },
  'thestreet.com':       { bg: '#0057FF', label: 'TS' },
  'investopedia.com':    { bg: '#1CB0A3', label: 'IP' },
  'morningstar.com':     { bg: '#E8273C', label: 'MS' },
  'benzinga.com':        { bg: '#00AEEF', label: 'BZ' },
  'fool.com':            { bg: '#7B2FBE', label: 'MF' },
  'motleyfool.com':      { bg: '#7B2FBE', label: 'MF' },
  'zacks.com':           { bg: '#0066CC', label: 'ZK' },
  'investing.com':       { bg: '#FF6B00', label: 'IV' },
  'kiplinger.com':       { bg: '#005B99', label: 'KP' },
  'nasdaq.com':          { bg: '#0066CC', label: 'NQ' },
  'prnewswire.com':      { bg: '#333333', label: 'PR' },
  'globenewswire.com':   { bg: '#444444', label: 'GN' },
  'businesswire.com':    { bg: '#333333', label: 'BW' },
};

function getSourceLabel(domain: string): string {
  const key = Object.keys(SOURCE_LABELS).find(k => domain.includes(k));
  return key ? SOURCE_LABELS[key] : domain.replace(/\.(com|net|org|io)$/, '');
}

function getSourceColor(domain: string): { bg: string; label: string } {
  const key = Object.keys(SOURCE_COLORS).find(k => domain.includes(k));
  return key ? SOURCE_COLORS[key] : { bg: '#444444', label: domain.slice(0, 2).toUpperCase() };
}

function timeAgo(isoDate: string) {
  const diff = Date.now() - new Date(isoDate).getTime();
  const h = Math.floor(diff / 3_600_000);
  const m = Math.floor(diff / 60_000);
  if (h >= 24) return `${Math.floor(h / 24)}d ago`;
  if (h >= 1) return `${h}h ago`;
  if (m >= 1) return `${m}m ago`;
  return 'just now';
}

function PriceChange({ pct }: { pct: number | null }) {
  if (pct === null) return <span style={{ color: 'var(--text-muted)', ...MONO }} className="text-[11px]">—</span>;
  const up = pct >= 0;
  return (
    <span
      className="inline-flex items-center gap-0.5 text-[11px] tabular-nums font-semibold"
      style={{ color: up ? 'var(--green)' : 'var(--red)', ...MONO }}
    >
      {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {Math.abs(pct).toFixed(2)}%
    </span>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

function SectionHeader({ title, meta, accent = false }: { title: string; meta?: string; accent?: boolean }) {
  return (
    <div
      className="flex items-center gap-3 pb-3 mb-0"
      style={{ borderBottom: '1px solid var(--border)' }}
    >
      {accent && (
        <div className="h-3 w-[2px] shrink-0" style={{ backgroundColor: 'var(--accent)' }} />
      )}
      <h2
        className="text-[10px] font-bold uppercase tracking-widest"
        style={{ color: accent ? 'var(--text-primary)' : 'var(--text-secondary)', ...MONO }}
      >
        {title}
      </h2>
      {meta && (
        <span className="text-[9px] uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)', ...MONO }}>
          {meta}
        </span>
      )}
    </div>
  );
}

// ─── Ticker Tape ─────────────────────────────────────────────────────────────

function TickerTape() {
  const { data: trending } = useQuery({ queryKey: ['trending'], queryFn: getTrending });

  if (!trending || trending.length === 0) return null;

  // Triple the items for seamless infinite scroll
  const items = [...trending, ...trending, ...trending];

  return (
    <div
      className="ticker-tape overflow-hidden border-b"
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderColor: 'var(--border)',
      }}
    >
      <div
        className="flex items-center gap-0"
        style={{
          animation: 'ticker-scroll 40s linear infinite',
          width: 'max-content',
        }}
      >
        {items.map((stock: TrendingStock, i: number) => {
          const up = (stock.change_pct ?? 0) >= 0;
          const sentScore = stock.sentiment_score ?? 0;
          const hasBull = sentScore >= 0.05;
          const hasBear = sentScore <= -0.05;
          return (
            <span
              key={i}
              className="inline-flex items-center gap-2 px-5 py-1.5 text-[11px] border-r shrink-0"
              style={{ borderColor: 'var(--border)', ...MONO }}
            >
              {/* Sentiment dot */}
              {hasBull && (
                <span style={{ color: 'var(--accent)', fontSize: '7px', lineHeight: 1 }}>●</span>
              )}
              {hasBear && (
                <span style={{ color: 'var(--red)', fontSize: '7px', lineHeight: 1 }}>●</span>
              )}
              <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                {stock.symbol}
              </span>
              {stock.price != null && (
                <span style={{ color: 'var(--text-secondary)' }}>
                  ${stock.price.toFixed(2)}
                </span>
              )}
              <span
                className="font-bold"
                style={{ color: up ? 'var(--green)' : 'var(--red)' }}
              >
                {up ? '▲' : '▼'} {Math.abs(stock.change_pct ?? 0).toFixed(2)}%
              </span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

// ─── Article Thumbnail ────────────────────────────────────────────────────────

function ArticleThumbnail({ domain, size = 68 }: { domain: string; size?: number }) {
  const { bg, label } = getSourceColor(domain);
  return (
    <div
      className="shrink-0 flex items-center justify-center font-black relative overflow-hidden"
      style={{
        width: size,
        height: size,
        backgroundColor: bg,
        color: '#ffffff',
        fontSize: Math.round(size * 0.22),
        fontFamily: '"IBM Plex Mono", monospace',
        letterSpacing: '0.05em',
      }}
    >
      {label}
    </div>
  );
}

// ─── 5-level sentiment helpers ────────────────────────────────────────────────

interface SentLevel {
  label: string;
  short: string;
  icon: string;
  color: string;
  bg: string;
  borderColor: string;
}

function getSentLevel(score: number): SentLevel {
  if (score >= 0.35)  return { label: 'Strongly Bullish', short: 'Strong Bull', icon: '▲▲', color: '#16a34a', bg: 'rgba(22,163,74,0.12)',  borderColor: '#16a34a' };
  if (score >= 0.05)  return { label: 'Bullish',          short: 'Bullish',     icon: '▲',  color: 'var(--green)', bg: 'rgba(34,197,94,0.1)', borderColor: 'var(--green)' };
  if (score <= -0.35) return { label: 'Strongly Bearish', short: 'Strong Bear', icon: '▼▼', color: '#b91c1c', bg: 'rgba(185,28,28,0.12)',  borderColor: '#b91c1c' };
  if (score <= -0.05) return { label: 'Bearish',          short: 'Bearish',     icon: '▼',  color: 'var(--red)', bg: 'rgba(239,68,68,0.1)',  borderColor: 'var(--red)' };
  return { label: 'Neutral', short: 'Neutral', icon: '●', color: '#d97706', bg: 'rgba(217,119,6,0.1)', borderColor: '#d97706' };
}

// ─── Sentiment Pill ───────────────────────────────────────────────────────────

function SentimentPill({ score }: { score: number }) {
  const lvl = getSentLevel(score);
  return (
    <span
      className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5"
      style={{ color: lvl.color, backgroundColor: lvl.bg, ...MONO }}
    >
      {lvl.icon} {lvl.short}
    </span>
  );
}

// ─── Credibility Badge ────────────────────────────────────────────────────────

function CredBadge({ score }: { score: number }) {
  const high = score >= 80;
  const med = score >= 60;
  const color = high ? 'var(--accent)' : med ? '#d97706' : 'var(--text-muted)';
  const label = high ? 'High credibility' : med ? 'Med credibility' : 'Low credibility';
  const tooltip = high
    ? `Credibility ${score}/100 — major financial outlet with strong editorial standards`
    : med
    ? `Credibility ${score}/100 — known financial source`
    : `Credibility ${score}/100 — source credibility is lower or unknown`;
  return (
    <span
      className="text-[10px] font-black uppercase tracking-widest cursor-help"
      style={{ color, ...MONO }}
      title={tooltip}
    >
      {label}
    </span>
  );
}

// ─── Sentiment Bar ─────────────────────────────────────────────────────────────

function SentimentBar({ score }: { score: number | null }) {
  if (score === null) {
    return (
      <div className="flex items-center gap-2">
        <div className="flex-1 h-1 rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <span className="text-[9px] w-14 text-right" style={{ color: 'var(--text-muted)', ...MONO }}>—</span>
      </div>
    );
  }
  const lvl = getSentLevel(score);
  const pct = Math.round(((score + 1) / 2) * 100);
  return (
    <div className="flex items-center gap-2">
      <div
        className="flex-1 h-1 rounded-full overflow-hidden"
        style={{ backgroundColor: 'var(--bg-elevated)' }}
      >
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: lvl.color }}
        />
      </div>
      <span className="text-[9px] font-bold uppercase shrink-0 w-14 text-right" style={{ color: lvl.color, ...MONO }}>
        {lvl.short}
      </span>
    </div>
  );
}

// ─── Sentiment Gauge — SVG arc (used on HeroCard) ─────────────────────────────

function SentimentGauge({ score }: { score: number }) {
  const lvl = getSentLevel(score);
  const cx = 70, cy = 68, r = 50;

  // Map score [-1, 1] → angle [180°, 0°]
  const angleDeg = 180 - (score + 1) * 90;
  const angleRad = (angleDeg * Math.PI) / 180;
  const ex = cx + r * Math.cos(angleRad);
  const ey = cy - r * Math.sin(angleRad);

  // Filled arc from start (180°) to score endpoint
  const startX = cx - r;
  const startY = cy;
  // Swept angle = 180 - angleDeg; large arc flag only if swept > 180 (never in our range)
  const filledPath = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${ex.toFixed(2)} ${ey.toFixed(2)}`;
  const trackPath  = `M ${startX} ${startY} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;

  // Needle from center to a point slightly inside the arc
  const nr = r - 10;
  const nx = cx + nr * Math.cos(angleRad);
  const ny = cy - nr * Math.sin(angleRad);

  // Tick marks at the key thresholds
  const ticks = [-0.35, -0.05, 0, 0.05, 0.35].map(t => {
    const td = 180 - (t + 1) * 90;
    const tr = (td * Math.PI) / 180;
    return {
      x1: cx + (r + 4) * Math.cos(tr),
      y1: cy - (r + 4) * Math.sin(tr),
      x2: cx + (r + 10) * Math.cos(tr),
      y2: cy - (r + 10) * Math.sin(tr),
    };
  });

  return (
    <div style={{ width: 140, height: 84 }}>
      <svg viewBox="0 0 140 84" width={140} height={84}>
        {/* Track arc */}
        <path d={trackPath} fill="none" stroke="var(--bg-elevated)" strokeWidth="9" strokeLinecap="butt" />
        {/* Threshold ticks */}
        {ticks.map((t, i) => (
          <line key={i} x1={t.x1.toFixed(2)} y1={t.y1.toFixed(2)} x2={t.x2.toFixed(2)} y2={t.y2.toFixed(2)}
            stroke="var(--border)" strokeWidth="1.5" />
        ))}
        {/* Filled arc */}
        <motion.path
          d={filledPath}
          fill="none"
          stroke={lvl.color}
          strokeWidth="9"
          strokeLinecap="butt"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        {/* Needle */}
        <motion.line
          x1={cx} y1={cy}
          x2={cx} y2={cy - nr}   /* start pointing up, then rotate */
          stroke={lvl.color} strokeWidth="2" strokeLinecap="round"
          initial={{ rotate: 90 }}
          animate={{ rotate: 90 - angleDeg }}
          style={{ originX: `${cx}px`, originY: `${cy}px` }}
          transition={{ duration: 0.9, ease: 'easeOut' }}
        />
        {/* Center pivot */}
        <circle cx={cx} cy={cy} r={4} fill={lvl.color} />
        {/* Score value */}
        <text x={cx} y={cy - 17} textAnchor="middle" fontSize="13" fontWeight="900"
          fill="var(--text-primary)" fontFamily='"IBM Plex Mono", monospace'>
          {score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2)}
        </text>
        {/* Sentiment label */}
        <text x={cx} y={cy - 5} textAnchor="middle" fontSize="6.5" fontWeight="700"
          fill={lvl.color} fontFamily='"IBM Plex Mono", monospace'
          style={{ textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {lvl.short.toUpperCase()}
        </text>
        {/* End labels */}
        <text x={cx - r + 2} y={cy + 13} textAnchor="start" fontSize="7"
          fill="#b91c1c" fontFamily='"IBM Plex Mono", monospace' fontWeight="700">BEAR</text>
        <text x={cx + r - 2} y={cy + 13} textAnchor="end" fontSize="7"
          fill="#16a34a" fontFamily='"IBM Plex Mono", monospace' fontWeight="700">BULL</text>
      </svg>
    </div>
  );
}

// ─── Sentiment Overview Chart — recharts bar (used in MarketPulse) ─────────────

function SentimentChart({ stocks }: { stocks: TrendingStock[] }) {
  const data = stocks.slice(0, 8).map(s => ({
    symbol: s.symbol,
    score:  parseFloat((s.sentiment_score ?? 0).toFixed(3)),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-2 mt-5">
        <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
          Sentiment Scores
        </span>
        <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
          Bearish ← 0 → Bullish
        </span>
      </div>
      <div style={{ height: 110 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, left: -32, bottom: 0 }} barCategoryGap="28%">
            <XAxis
              dataKey="symbol"
              tick={{ fill: 'var(--text-muted)', fontSize: 9, fontFamily: '"IBM Plex Mono", monospace', fontWeight: 700 }}
              axisLine={{ stroke: 'var(--border)' }}
              tickLine={false}
            />
            <YAxis
              domain={[-1, 1]}
              tickCount={3}
              tickFormatter={v => v === 0 ? '0' : v > 0 ? `+${v}` : `${v}`}
              tick={{ fill: 'var(--text-muted)', fontSize: 8, fontFamily: '"IBM Plex Mono", monospace' }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={0} stroke="var(--border)" strokeDasharray="4 3" strokeWidth={1} />
            <Bar dataKey="score" radius={[2, 2, 0, 0]} maxBarSize={28}>
              {data.map(entry => (
                <Cell
                  key={entry.symbol}
                  fill={
                    entry.score >= 0.05  ? 'var(--green)' :
                    entry.score <= -0.05 ? 'var(--red)'    : '#d97706'
                  }
                  fillOpacity={0.8}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ─── Stock Tile — Bloomberg terminal card style ────────────────────────────────

function StockTile({ stock }: { stock: TrendingStock }) {
  const up = (stock.change_pct ?? 0) >= 0;
  const sentScore = stock.sentiment_score ?? 0;
  const lvl = getSentLevel(sentScore);
  const bgTint = sentScore >= 0.05
    ? 'rgba(22,163,74,0.03)'
    : sentScore <= -0.05
    ? 'rgba(185,28,28,0.03)'
    : 'rgba(217,119,6,0.03)';

  return (
    <motion.div
      variants={staggerItem}
      whileHover={{ y: -3, transition: { duration: 0.12 } }}
      whileTap={{ scale: 0.98 }}
    >
    <Link
      to={`/app/stock/${stock.symbol}`}
      className="block p-3 group"
      style={{
        borderLeft: `3px solid ${lvl.borderColor}`,
        backgroundColor: bgTint,
        borderTop: '1px solid var(--border)',
        borderRight: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
        transition: 'border-left-width 0.15s ease, background-color 0.15s ease',
      }}
      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderLeftWidth = '5px'; }}
      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderLeftWidth = '3px'; }}
    >
      {/* Ticker row */}
      <div className="flex items-start justify-between gap-2 mb-1">
        <span
          className="text-base font-black group-hover:text-[var(--accent)] transition-colors"
          style={{ color: 'var(--text-primary)', ...MONO }}
        >
          {stock.symbol}
        </span>
        {/* Price right-aligned */}
        <span
          className="text-xl font-black tabular-nums leading-none text-right"
          style={{ color: 'var(--text-primary)', ...MONO }}
        >
          {stock.price != null ? `$${stock.price.toFixed(2)}` : '—'}
        </span>
      </div>

      {/* Company name + change row */}
      <div className="flex items-start justify-between gap-2 mb-3">
        {stock.name ? (
          <span
            className="truncate max-w-[90px]"
            style={{ color: 'var(--text-muted)', ...MONO, fontSize: '10px' }}
          >
            {stock.name.split(' ').slice(0, 3).join(' ')}
          </span>
        ) : <span />}
        {/* Change arrow + pct below price */}
        <span
          className="text-[11px] font-bold tabular-nums flex items-center gap-0.5"
          style={{ color: up ? 'var(--green)' : 'var(--red)', ...MONO }}
        >
          {up ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
          {Math.abs(stock.change_pct ?? 0).toFixed(2)}%
        </span>
      </div>

      {/* Full-width sentiment bar — thicker */}
      <div className="mb-2">
        <SentimentBar score={stock.sentiment_score} />
      </div>

      {/* Sentiment label + score */}
      {stock.sentiment_score !== null && stock.sentiment_score !== undefined && (
        <div className="flex items-center justify-between mb-2">
          <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: lvl.color, ...MONO }}>
            {lvl.label}
          </span>
          <span className="text-[9px] tabular-nums" style={{ color: 'var(--text-muted)', ...MONO }}>
            {stock.sentiment_score > 0 ? '+' : ''}{stock.sentiment_score.toFixed(2)}
          </span>
        </div>
      )}

      {/* Event type tag if present */}
      {stock.top_event_type && stock.top_event_type !== 'other' && (() => {
        const eventColor: Record<string, string> = {
          earnings_beat: '#16a34a', earnings_miss: '#dc2626',
          guidance_up: '#16a34a',   guidance_down: '#dc2626',
          fda_approval: '#2563eb',  fda_rejection: '#dc2626',
          acquisition: '#7c3aed',   ceo_change: '#d97706',
          layoffs: '#dc2626',       partnership: '#0891b2',
          buyback: '#16a34a',       ipo: '#7c3aed',
        };
        const eventLabel: Record<string, string> = {
          earnings_beat: 'Earnings Beat', earnings_miss: 'Earnings Miss',
          guidance_up: 'Guidance Up',     guidance_down: 'Guidance Down',
          fda_approval: 'FDA Approval',   fda_rejection: 'FDA Rejection',
          acquisition: 'Acquisition',     ceo_change: 'CEO Change',
          layoffs: 'Layoffs',             partnership: 'Partnership',
          buyback: 'Buyback',             ipo: 'IPO',
        };
        const c = eventColor[stock.top_event_type] ?? '#888';
        const l = eventLabel[stock.top_event_type] ?? stock.top_event_type;
        return (
          <div className="mb-2">
            <span
              className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-0.5"
              style={{ color: c, backgroundColor: `${c}20`, border: `1px solid ${c}44`, ...MONO }}
            >
              {l}
            </span>
          </div>
        );
      })()}

      {/* Bottom row: articles left, scored right */}
      <div className="flex items-center justify-between">
        <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
          {stock.mention_count} {stock.mention_count === 1 ? 'article' : 'articles'}
        </span>
        {stock.sentiment_count > 0 && (
          <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
            {stock.sentiment_count} scored
          </span>
        )}
      </div>
    </Link>
    </motion.div>
  );
}

function MarketPulse() {
  const { data: trending, isLoading } = useQuery({ queryKey: ['trending'], queryFn: getTrending });

  return (
    <div className="border-b py-6" style={{ borderColor: 'var(--border)' }}>
      <div className="mb-4">
        <SectionHeader title="Market Pulse" meta="Top by mentions" />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="border p-3 space-y-2 animate-pulse"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="h-3 w-12 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              <div className="h-5 w-16 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              <div className="h-2 w-full rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
            </div>
          ))}
        </div>
      ) : (
        <>
          <motion.div
            className="grid grid-cols-2 sm:grid-cols-3 gap-3"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {trending?.slice(0, 6).map((stock: TrendingStock) => (
              <StockTile key={stock.symbol} stock={stock} />
            ))}
          </motion.div>
          {trending && trending.length > 0 && (
            <SentimentChart stocks={trending} />
          )}
        </>
      )}
    </div>
  );
}

// ─── Hero Article — dramatic redesign ─────────────────────────────────────────

function HeroCard({ mention }: { mention: Mention }) {
  const ticker = mention.ticker ?? '';
  const domain = mention.news_source ?? mention.author ?? '';
  const sourceLabel = getSourceLabel(domain);
  const { bg: sourceBg } = getSourceColor(domain);
  const sentScore = mention.sentiment_score ?? 0;
  const lvl = getSentLevel(sentScore);

  // Inline price (cached)
  const { data: trending } = useQuery({ queryKey: ['trending'], queryFn: getTrending, staleTime: 60_000 });
  const priceInfo = trending?.find((t: TrendingStock) => t.symbol === ticker);

  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className="border-b pb-8 mb-0"
      style={{ borderColor: 'var(--border)' }}
    >
      {/* Full-width accent line at top */}
      <div className="nav-stripe h-px w-full mb-6" style={{ backgroundColor: 'var(--accent)' }} />

      <div className="flex gap-4 sm:gap-6">
        <div className="flex-1 min-w-0">
          {/* Source badge + ticker + price */}
          <div className="flex items-center gap-2 mb-3 sm:mb-4 flex-wrap">
            {/* Large filled source badge */}
            <span
              className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest"
              style={{ backgroundColor: sourceBg, color: '#ffffff', ...MONO }}
            >
              {sourceLabel}
            </span>
            {ticker && (
              <Link
                to={`/app/stock/${ticker}`}
                className="text-[10px] font-bold px-2 py-0.5 border-2 transition-colors hover:bg-[var(--bg-elevated)]"
                style={{ borderColor: 'var(--accent)', color: 'var(--accent)', ...MONO }}
              >
                {ticker}
              </Link>
            )}
            {priceInfo?.price != null && (
              <span className="text-[11px] font-black tabular-nums" style={{ color: 'var(--text-secondary)', ...MONO }}>
                ${priceInfo.price.toFixed(2)}
                {priceInfo.change_pct != null && (
                  <span style={{ color: priceInfo.change_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {' '}{priceInfo.change_pct >= 0 ? '+' : ''}{priceInfo.change_pct.toFixed(2)}%
                  </span>
                )}
              </span>
            )}
            <span className="text-[11px] ml-auto" style={{ color: 'var(--text-muted)', ...MONO }}>
              {timeAgo(mention.published_at)}
            </span>
          </div>

          {/* Very large headline */}
          <a
            href={mention.url ?? '#'}
            target="_blank"
            rel="noopener noreferrer"
            className="group block"
          >
            <h2
              className="font-black leading-[1.1] group-hover:underline underline-offset-4 decoration-2"
              style={{ color: 'var(--text-primary)', fontSize: 'clamp(1.75rem, 4vw, 3rem)' }}
            >
              {mention.text}
            </h2>
          </a>

          {/* Sentiment pill + cred badge + time row */}
          <div className="mt-4 flex items-center gap-3 flex-wrap">
            {mention.sentiment_score !== null && mention.sentiment_score !== undefined && (
              <SentimentPill score={mention.sentiment_score} />
            )}
            <CredBadge score={mention.credibility_score} />
          </div>
        </div>

        {/* Sentiment gauge on right */}
        {mention.sentiment_score !== null && mention.sentiment_score !== undefined ? (
          <div className="hidden sm:flex shrink-0 flex-col items-center gap-1">
            <SentimentGauge score={mention.sentiment_score} />
            <div
              className="text-center px-2 py-0.5 text-[9px] font-black uppercase tracking-widest"
              style={{ backgroundColor: lvl.bg, color: lvl.color, ...MONO }}
            >
              {lvl.icon} {lvl.label}
            </div>
          </div>
        ) : (
          <div className="hidden sm:block shrink-0">
            <ArticleThumbnail domain={domain} size={140} />
          </div>
        )}
      </div>

      {/* Subtle full-width sentiment gradient bar at bottom */}
      <div className="mt-6 h-[2px] w-full" style={{ backgroundColor: lvl.color, opacity: 0.35 }} />
    </motion.article>
  );
}

// ─── Stream Article — editorial redesign ──────────────────────────────────────

function StreamCard({ mention }: { mention: Mention }) {
  const ticker = mention.ticker ?? '';
  const domain = mention.news_source ?? mention.author ?? '';
  const sourceLabel = getSourceLabel(domain);
  const { bg: sourceBg } = getSourceColor(domain);
  const isHighCred = mention.credibility_score >= 80;

  // Inline price — uses already-cached trending data (no extra network request)
  const { data: trending } = useQuery({ queryKey: ['trending'], queryFn: getTrending, staleTime: 60_000 });
  const priceInfo = trending?.find((t: TrendingStock) => t.symbol === ticker);

  return (
    <motion.article
      variants={itemVariants}
      whileHover={{ x: 3, transition: { duration: 0.12 } }}
      className="flex gap-3 sm:gap-4 border-b py-3 sm:py-4"
      style={{
        borderColor: 'var(--border)',
        borderLeft: isHighCred ? '2px solid var(--accent)' : undefined,
        paddingLeft: isHighCred ? '12px' : undefined,
      }}
    >
      {/* Thumbnail with source label overlaid */}
      <div className="shrink-0 relative" style={{ width: 64, height: 64 }}>
        <ArticleThumbnail domain={domain} size={64} />
        <span
          className="absolute bottom-0 left-0 right-0 text-center leading-none py-0.5"
          style={{
            backgroundColor: sourceBg,
            color: '#fff',
            fontSize: '7px',
            fontFamily: '"IBM Plex Mono", monospace',
            fontWeight: 900,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}
        >
          {getSourceColor(domain).label}
        </span>
      </div>

      <div className="flex-1 min-w-0">
        {/* Top row: SOURCE · TICKER · price · time */}
        <div className="flex items-center gap-2 mb-1.5 flex-wrap">
          <span
            className="text-[10px] font-bold uppercase tracking-[0.1em]"
            style={{ color: sourceBg, ...MONO }}
          >
            {sourceLabel}
          </span>
          {ticker && (
            <Link
              to={`/app/stock/${ticker}`}
              className="text-[10px] font-bold px-1.5 py-px border transition-colors hover:bg-[var(--bg-elevated)]"
              style={{ borderColor: 'var(--border-strong)', color: 'var(--text-secondary)', ...MONO }}
            >
              {ticker}
            </Link>
          )}
          {priceInfo?.price != null && (
            <span className="text-[10px] tabular-nums font-bold" style={{ color: 'var(--text-muted)', ...MONO }}>
              ${priceInfo.price.toFixed(2)}
              {priceInfo.change_pct != null && (
                <span style={{ color: priceInfo.change_pct >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {' '}{priceInfo.change_pct >= 0 ? '+' : ''}{priceInfo.change_pct.toFixed(2)}%
                </span>
              )}
            </span>
          )}
          <span className="ml-auto text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>
            {timeAgo(mention.published_at)}
          </span>
        </div>

        {/* Headline */}
        <a
          href={mention.url ?? '#'}
          target="_blank"
          rel="noopener noreferrer"
          className="group block"
        >
          <h3
            className="font-bold leading-snug group-hover:underline underline-offset-2 decoration-1"
            style={{ color: 'var(--text-primary)', fontSize: '0.95rem' }}
          >
            {mention.text}
          </h3>
        </a>

        {/* Bottom: sentiment pill + cred badge */}
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          {mention.sentiment_score !== null && mention.sentiment_score !== undefined && (
            <SentimentPill score={mention.sentiment_score} />
          )}
          <CredBadge score={mention.credibility_score} />
        </div>
      </div>
    </motion.article>
  );
}

// ─── Compact Card — with sentiment dot ────────────────────────────────────────

function CompactCard({ mention }: { mention: Mention }) {
  const domain = mention.news_source ?? mention.author ?? '';
  const sourceLabel = getSourceLabel(domain);
  const isHighCred = mention.credibility_score >= 80;
  const sentScore = mention.sentiment_score ?? 0;
  const dotColor = sentScore >= 0.05
    ? 'var(--green)'
    : sentScore <= -0.05
    ? 'var(--red)'
    : 'var(--text-muted)';

  return (
    <motion.div
      variants={itemVariants}
      whileHover={{ x: 2, transition: { duration: 0.12 } }}
      className="flex gap-3 py-3 border-b last:border-0"
      style={{
        borderColor: 'var(--border)',
        borderLeft: isHighCred ? '2px solid var(--accent)' : undefined,
        paddingLeft: isHighCred ? '12px' : undefined,
        marginLeft: isHighCred ? '-12px' : undefined,
      }}
    >
      <ArticleThumbnail domain={domain} size={52} />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.1em]" style={{ color: 'var(--text-muted)', ...MONO }}>
            {sourceLabel}
          </span>
          <span className="ml-auto text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
            {timeAgo(mention.published_at)}
          </span>
        </div>
        <a href={mention.url ?? '#'} target="_blank" rel="noopener noreferrer" className="group block">
          <p className="text-sm font-semibold leading-snug group-hover:underline underline-offset-2 decoration-1"
             style={{ color: 'var(--text-primary)' }}>
            {/* Sentiment dot before text */}
            <span style={{ color: dotColor, fontSize: '8px', marginRight: '4px', verticalAlign: 'middle' }}>●</span>
            {mention.text}
          </p>
        </a>
        {isHighCred && (
          <div className="mt-1">
            <CredBadge score={mention.credibility_score} />
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Ticker Groups — editorial grid layout ────────────────────────────────────

const MAX_PER_GROUP = 3;

function TickerGroups({ mentions }: { mentions: Mention[] }) {
  const grouped = new Map<string, Mention[]>();
  for (const m of mentions) {
    const key = m.ticker ?? 'OTHER';
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(m);
  }
  const sorted = [...grouped.entries()].sort((a, b) => b[1].length - a[1].length);

  return (
    <motion.div variants={feedVariants} initial="hidden" animate="show">
      {sorted.map(([ticker, items]) => {
        const firstCred = items[0]?.credibility_score ?? 0;
        const groupBorderColor = firstCred >= 80
          ? 'var(--accent)'
          : firstCred >= 60
          ? '#d97706'
          : 'var(--border-strong)';

        return (
          <motion.div
            key={ticker}
            variants={itemVariants}
            className="border-b py-5"
            style={{
              borderColor: 'var(--border)',
              borderLeft: `3px solid ${groupBorderColor}`,
              paddingLeft: '12px',
            }}
          >
            {/* Group header — prominent bordered ticker label + article count badge */}
            <div className="flex items-center gap-3 mb-4">
              {ticker !== 'OTHER' ? (
                <Link
                  to={`/app/stock/${ticker}`}
                  className="text-sm font-black uppercase tracking-widest px-3 py-1 border-2 transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ borderColor: 'var(--accent)', color: 'var(--accent)', ...MONO }}
                >
                  {ticker}
                </Link>
              ) : (
                <span className="text-sm font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
                  Other
                </span>
              )}
              {/* Article count badge */}
              <span
                className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-secondary)', ...MONO }}
              >
                {items.length} {items.length === 1 ? 'article' : 'articles'}
              </span>
              {items.length > MAX_PER_GROUP && ticker !== 'OTHER' && (
                <Link
                  to={`/app/stock/${ticker}`}
                  className="ml-auto text-[9px] font-bold uppercase tracking-widest transition-colors hover:underline"
                  style={{ color: 'var(--accent)', ...MONO }}
                >
                  See all →
                </Link>
              )}
            </div>

            {/* First article as StreamCard, rest as CompactCard */}
            <div className="space-y-0">
              {items.slice(0, MAX_PER_GROUP).map((mention, i) =>
                i === 0
                  ? <StreamCard key={mention.id ?? i} mention={mention} />
                  : <CompactCard key={mention.id ?? i} mention={mention} />
              )}
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
}

// ─── Market Summary Bar ───────────────────────────────────────────────────────

function MarketSummaryBar() {
  const { data } = useQuery<MarketSummary>({
    queryKey: ['market-summary'],
    queryFn: getMarketSummary,
    staleTime: 5 * 60_000,
  });

  if (!data || data.total === 0) return null;

  const bullPct = Math.round((data.bullish / data.total) * 100);
  const bearPct = Math.round((data.bearish / data.total) * 100);
  const neutPct = 100 - bullPct - bearPct;
  const dominant = bullPct > bearPct ? 'bullish' : bearPct > bullPct ? 'bearish' : 'mixed';
  const domColor = dominant === 'bullish' ? '#16a34a' : dominant === 'bearish' ? '#dc2626' : '#d97706';

  return (
    <div
      className="border-b py-3 mb-0"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
    >
      <div className="flex items-center gap-4 flex-wrap">
        {/* Label */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: domColor }} />
          <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
            Market Mood
          </span>
        </div>

        {/* Distribution bar */}
        <div className="flex h-1.5 flex-1 min-w-[80px] max-w-[200px] overflow-hidden gap-px">
          <div className="h-full" style={{ width: `${bullPct}%`, backgroundColor: '#16a34a' }} />
          <div className="h-full" style={{ width: `${neutPct}%`, backgroundColor: '#d97706' }} />
          <div className="h-full" style={{ width: `${bearPct}%`, backgroundColor: '#dc2626' }} />
        </div>

        {/* Stats */}
        <div className="flex items-center gap-3 text-[9px] flex-wrap" style={MONO}>
          <span style={{ color: '#16a34a' }}>▲ {bullPct}% Bull</span>
          <span style={{ color: '#d97706' }}>{neutPct}% Neutral</span>
          <span style={{ color: '#dc2626' }}>▼ {bearPct}% Bear</span>
          <span style={{ color: 'var(--text-muted)' }}>{data.total} stocks</span>
        </div>

        {/* Top movers */}
        {(data.top_bullish.length > 0 || data.top_bearish.length > 0) && (
          <div className="flex items-center gap-2 ml-auto text-[9px] flex-wrap" style={MONO}>
            {data.top_bullish.slice(0, 3).map(t => (
              <span key={t} style={{ color: '#16a34a' }}>↑{t}</span>
            ))}
            {data.top_bearish.slice(0, 3).map(t => (
              <span key={t} style={{ color: '#dc2626' }}>↓{t}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Feed Skeleton ────────────────────────────────────────────────────────────

function FeedSkeleton() {
  return (
    <>
      <div className="border-b pb-8 space-y-4 animate-pulse" style={{ borderColor: 'var(--border)' }}>
        <div className="h-[3px] w-full" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-3 w-20 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-8 w-full rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        <div className="h-8 w-4/5 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      </div>
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="flex gap-4 border-b py-4 animate-pulse" style={{ borderColor: 'var(--border)' }}>
          <div className="h-[80px] w-[80px] shrink-0 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          <div className="flex-1 space-y-2.5 py-1">
            <div className="h-2.5 w-24 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
            <div className="h-4 w-full rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
            <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Earnings Widget ──────────────────────────────────────────────────────────

function EarningsWidget() {
  const { data: trending } = useQuery({ queryKey: ['trending'], queryFn: getTrending, staleTime: 300_000 });
  const tickers = trending?.slice(0, 10).map((t: TrendingStock) => t.symbol) ?? [];

  const { data: entries } = useQuery({
    queryKey: ['earnings', tickers.join(',')],
    queryFn:  () => getEarnings(tickers),
    enabled:  tickers.length > 0,
    staleTime: 3_600_000,
  });

  const upcoming = entries
    ?.filter(e => e.date)
    .slice(0, 5) ?? [];

  if (!upcoming.length) return null;

  return (
    <div className="border-b py-6" style={{ borderColor: 'var(--border)' }}>
      <div className="mb-4 flex items-center gap-2">
        <Calendar className="h-3.5 w-3.5" style={{ color: 'var(--accent)' }} />
        <SectionHeader title="Earnings Calendar" meta="Upcoming" />
      </div>
      <motion.div variants={staggerContainer} initial="hidden" animate="show" className="space-y-2">
        {upcoming.map(e => {
          const date      = new Date(e.date + 'T00:00:00Z');
          const nowUtc    = new Date();
          const daysUntil = Math.ceil((date.getTime() - nowUtc.setUTCHours(0,0,0,0)) / 86_400_000);
          const isToday   = daysUntil === 0;
          const isTomorrow = daysUntil === 1;
          const urgentColor = isToday ? 'var(--red)' : isTomorrow ? '#d97706' : daysUntil <= 7 ? 'var(--accent)' : 'var(--text-muted)';
          const label = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : `${daysUntil}d`;
          // Progress bar: how far into a 30-day window
          const barPct = Math.max(0, Math.min(100, 100 - (daysUntil / 30) * 100));

          return (
            <motion.div
              key={e.ticker}
              variants={staggerItem}
              whileHover={{ x: 2, transition: { duration: 0.1 } }}
            >
              <Link
                to={`/app/stock/${e.ticker}`}
                className="flex items-center gap-3 px-3 py-2.5 group transition-colors"
                style={{
                  borderLeft: `3px solid ${urgentColor}`,
                  backgroundColor: `${urgentColor}08`,
                  border: `1px solid var(--border)`,
                  borderLeftWidth: '3px',
                  borderLeftColor: urgentColor,
                }}
              >
                {/* Ticker */}
                <span
                  className="text-sm font-black w-14 shrink-0 group-hover:text-[var(--accent)] transition-colors"
                  style={{ color: 'var(--text-primary)', ...MONO }}
                >
                  {e.ticker}
                </span>

                {/* Date */}
                <span className="text-[11px] flex-1" style={{ color: 'var(--text-secondary)', ...MONO }}>
                  {date.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' })}
                </span>

                {/* Proximity bar */}
                <div className="hidden sm:flex items-center gap-2 w-20">
                  <div className="flex-1 h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${barPct}%`, backgroundColor: urgentColor, opacity: 0.7 }}
                    />
                  </div>
                </div>

                {/* Label */}
                <span
                  className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 shrink-0"
                  style={{ color: urgentColor, backgroundColor: `${urgentColor}18`, ...MONO }}
                >
                  {label}
                </span>
              </Link>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}

// ─── News Feed ────────────────────────────────────────────────────────────────

/**
 * Deduplicate mentions that represent the same article stored under different
 * URLs (e.g. one with query-params from Finnhub, one without from RSS).
 * Primary key: URL with query-string stripped.
 * Fallback (no URL): title + author.
 */
function dedupMentions(mentions: Mention[]): Mention[] {
  const seen = new Set<string>();
  return mentions.filter((m) => {
    let key: string;
    if (m.url) {
      try {
        const u = new URL(m.url);
        key = `${u.hostname}${u.pathname}`.toLowerCase();
      } catch {
        key = m.url.toLowerCase();
      }
    } else {
      key = `${(m.text ?? '').toLowerCase().trim()}|||${(m.author ?? '').toLowerCase()}`;
    }
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

const SINCE_OPTIONS: { label: string; value: FeedSince }[] = [
  { label: '1H',  value: '1h'  },
  { label: '6H',  value: '6h'  },
  { label: '24H', value: '24h' },
  { label: '7D',  value: '7d'  },
];

type FeedView = 'grouped' | 'latest';

function NewsFeed({ minCredibility = 0, personalized = false }: { minCredibility?: number; personalized?: boolean }) {
  const [since, setSince]           = useState<FeedSince>('7d');
  const [viewMode, setViewMode]     = useState<FeedView>('grouped');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const qc = useQueryClient();

  const regularFeed = useQuery({
    queryKey: ['feed', since],
    queryFn:  () => getFeed(since),
  });
  const personalFeed = useQuery({
    queryKey: ['personalized-feed', minCredibility],
    queryFn:  () => getPersonalizedFeed(minCredibility),
    enabled:  personalized,
  });

  const query = personalized ? personalFeed : regularFeed;
  const { data, isLoading, isError, isFetching } = query;

  // Track when data was last successfully received
  useEffect(() => {
    if (data) setLastUpdated(new Date());
  }, [data]);

  function handleRefresh() {
    if (personalized) {
      qc.invalidateQueries({ queryKey: ['personalized-feed'] });
    } else {
      qc.invalidateQueries({ queryKey: ['feed', since] });
    }
  }

  // For non-personalized feed, apply credibility filter client-side, then deduplicate
  const filtered = data
    ? dedupMentions(personalized ? data : data.filter((m: Mention) => (m.credibility_score ?? 0) >= minCredibility))
    : undefined;

  // Human-readable "updated X ago"
  const updatedLabel = lastUpdated
    ? timeAgo(lastUpdated.toISOString())
    : null;

  return (
    <div>
      {/* Market summary bar */}
      {!personalized && <MarketSummaryBar />}

      {/* Section header row */}
      <div className="mb-0 mt-4">
        <SectionHeader
          title={personalized ? 'Your Feed' : 'Latest Intelligence'}
          meta={undefined}
          accent={true}
        />
        <div className="flex items-center gap-3 mt-2 mb-0 flex-wrap">
          {/* Time filter — not shown for personalized feed */}
          {!personalized && (
            <div className="flex gap-1">
              {SINCE_OPTIONS.map(({ label, value }) => (
                <button
                  key={value}
                  onClick={() => setSince(value)}
                  className="px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest border transition-all"
                  style={{
                    borderColor:     since === value ? 'var(--accent)' : 'var(--border)',
                    color:           since === value ? 'var(--accent)' : 'var(--text-muted)',
                    backgroundColor: since === value ? 'var(--accent-dim)' : 'transparent',
                    ...MONO,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* View mode toggle */}
          {!personalized && (
            <div className="flex border" style={{ borderColor: 'var(--border)' }}>
              {(['grouped', 'latest'] as FeedView[]).map((mode) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className="px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-widest transition-colors"
                  style={{
                    ...MONO,
                    backgroundColor: viewMode === mode ? 'var(--accent)' : 'transparent',
                    color:           viewMode === mode ? '#fff' : 'var(--text-muted)',
                    borderRight:     mode === 'grouped' ? '1px solid var(--border)' : 'none',
                  }}
                >
                  {mode === 'grouped' ? 'By Stock' : 'Latest'}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-2 ml-auto">
            {/* Last updated label */}
            {updatedLabel && !isFetching && (
              <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
                updated {updatedLabel}
              </span>
            )}
            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={isFetching}
              title="Refresh feed"
              className="p-1 transition-colors hover:text-[var(--accent)] disabled:opacity-40"
              style={{ color: 'var(--text-muted)' }}
            >
              <RefreshCw
                className="h-3.5 w-3.5"
                style={{ animation: isFetching ? 'spin 1s linear infinite' : 'none' }}
              />
            </button>
            {/* Live / Personalized badge */}
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent)' }} />
              <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--accent)', ...MONO }}>
                {personalized ? 'Personalized' : 'Live'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {isLoading && <FeedSkeleton />}

      {isError && (
        <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          Could not load feed — is the backend running?
        </p>
      )}

      {filtered && filtered.length === 0 && (
        <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
          {minCredibility > 0
            ? `No articles match credibility ≥ ${minCredibility}. Try lowering the threshold in Preferences.`
            : since !== '7d'
            ? `No articles in the last ${since}. Try a wider window.`
            : 'No articles yet — run the seed script to ingest news.'}
        </p>
      )}

      {filtered && filtered.length > 0 && (
        <>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: 'easeOut' }}
          >
            <HeroCard mention={filtered[0]} />
          </motion.div>
          <MarketPulse />
          <EarningsWidget />
          {viewMode === 'grouped' ? (
            <>
              {/* Top Stories divider */}
              <div className="pt-6 mb-0">
                <SectionHeader
                  title="Top Stories"
                  meta={`${filtered.length - 1} articles`}
                />
              </div>
              <TickerGroups mentions={filtered.slice(1)} />
            </>
          ) : (
            <>
              <div className="pt-6 mb-0">
                <SectionHeader
                  title="Latest"
                  meta={`${filtered.length - 1} articles`}
                />
              </div>
              <motion.div
                variants={feedVariants}
                initial="hidden"
                animate="show"
              >
                {filtered.slice(1).map((mention, i) => (
                  <StreamCard key={mention.id ?? i} mention={mention} />
                ))}
              </motion.div>
            </>
          )}
        </>
      )}
    </div>
  );
}

// ─── Sidebar Skeleton ─────────────────────────────────────────────────────────

function SidebarSkeleton() {
  return (
    <>
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 py-3 border-b animate-pulse"
          style={{ borderColor: 'rgba(0,0,0,0.15)' }}
        >
          <div className="h-6 w-6 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.12)' }} />
          <div className="flex-1 space-y-1.5">
            <div className="h-2.5 w-16 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.12)' }} />
            <div className="h-2 w-24 rounded" style={{ backgroundColor: 'rgba(0,0,0,0.08)' }} />
          </div>
        </div>
      ))}
    </>
  );
}

// ─── Most Active Sidebar — with sentiment dots ────────────────────────────────

function MostActiveSidebar() {
  const { data: trending, isLoading } = useQuery({ queryKey: ['trending'], queryFn: getTrending });

  return (
    <div
      className="p-5"
      style={{ backgroundColor: 'var(--bg-surface)', borderTop: '2px solid var(--accent)' }}
    >
      {/* Header */}
      <div className="mb-4 pb-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <p
          className="text-[9px] font-black uppercase tracking-widest mb-1"
          style={{ color: 'var(--accent)', ...MONO }}
        >
          Right now
        </p>
        <h3
          className="text-sm font-black uppercase tracking-widest leading-none"
          style={{ color: 'var(--text-primary)', ...MONO }}
        >
          Most Active
        </h3>
      </div>

      {isLoading ? (
        <SidebarSkeleton />
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show">
        {trending?.slice(0, 8).map((stock: TrendingStock, i: number) => {
          const sentScore = stock.sentiment_score ?? 0;
          const dotColor = sentScore >= 0.05
            ? '#4ade80'
            : sentScore <= -0.05
            ? '#f87171'
            : '#fbbf24';

          return (
            <motion.div key={stock.symbol} variants={staggerItem}>
            <Link
              to={`/app/stock/${stock.symbol}`}
              className="flex items-center gap-3 py-3 border-b group transition-all hover:opacity-90 hover:pl-1"
              style={{ borderColor: 'var(--border)' }}
            >
              {/* Big rank number with sentiment dot top-right */}
              <div className="relative w-8 shrink-0">
                <span
                  className="text-3xl font-black leading-none tabular-nums"
                  style={{ color: 'var(--border-strong)', ...MONO }}
                >
                  {i + 1}
                </span>
                {/* Sentiment dot — top-right of rank */}
                <span
                  style={{
                    position: 'absolute',
                    top: 0,
                    right: 0,
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: dotColor,
                    display: 'block',
                  }}
                />
              </div>

              {/* Symbol + price */}
              <div className="flex-1 min-w-0">
                <div
                  className="text-sm font-black uppercase"
                  style={{ color: 'var(--text-primary)', ...MONO }}
                >
                  {stock.symbol}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {stock.price != null && (
                    <span
                      className="text-[11px] tabular-nums"
                      style={{ color: 'var(--text-secondary)', ...MONO }}
                    >
                      ${stock.price.toFixed(2)}
                    </span>
                  )}
                  {stock.change_pct != null && (
                    <span
                      className="text-[11px] font-bold tabular-nums"
                      style={{
                        color: stock.change_pct >= 0 ? 'var(--green)' : 'var(--red)',
                        ...MONO,
                      }}
                    >
                      {stock.change_pct >= 0 ? '▲' : '▼'} {Math.abs(stock.change_pct).toFixed(2)}%
                    </span>
                  )}
                </div>
              </div>
            </Link>
            </motion.div>
          );
        })}
        </motion.div>
      )}
    </div>
  );
}

// ─── Movers Sidebar — with mini momentum bar ──────────────────────────────────

function MoversSidebar() {
  const { data: shifters, isLoading } = useQuery({ queryKey: ['shifters'], queryFn: getShifters });

  return (
    <div className="pt-6">
      <div className="mb-2">
        <SectionHeader title="Sentiment Movers" meta="24h" />
      </div>

      {isLoading ? (
        Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center justify-between py-2.5 border-b animate-pulse"
            style={{ borderColor: 'var(--border)' }}
          >
            <div className="h-2.5 w-10 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
            <div className="h-2.5 w-16 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          </div>
        ))
      ) : (
        <motion.div variants={staggerContainer} initial="hidden" animate="show">
        {shifters?.slice(0, 6).map((stock: ShifterStock) => {
          const delta = stock.sentiment_delta_24h ?? 0;
          const up = delta >= 0;
          const barWidth = Math.min(Math.abs(delta) * 200, 100);

          return (
            <motion.div key={stock.symbol} variants={staggerItemFast}>
            <Link
              to={`/app/stock/${stock.symbol}`}
              className="py-2.5 border-b -mx-1 px-1 transition-colors hover:bg-[var(--bg-surface)] block"
              style={{ borderColor: 'var(--border)' }}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold" style={{ color: 'var(--text-primary)', ...MONO }}>
                  {stock.symbol}
                </span>
                <div className="flex items-center gap-2">
                  {stock.price != null && (
                    <span className="text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)', ...MONO }}>
                      ${stock.price.toFixed(0)}
                    </span>
                  )}
                  <span
                    className="text-[11px] font-bold tabular-nums"
                    style={{ color: up ? 'var(--green)' : 'var(--red)', ...MONO }}
                  >
                    {up ? '▲' : '▼'} {Math.abs(delta * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
              {/* Animated momentum bar */}
              <div className="mt-1.5 h-[2px] w-full" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                <motion.div
                  className="h-full"
                  style={{ backgroundColor: up ? 'var(--green)' : 'var(--red)' }}
                  initial={{ width: 0 }}
                  animate={{ width: `${barWidth}%` }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.1 }}
                />
              </div>
            </Link>
            </motion.div>
          );
        })}
        </motion.div>
      )}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────

export function Dashboard() {
  const prefs          = usePreferences();
  const { isLoggedIn } = useAuth();
  const hidden         = prefs.hidden_sections;

  return (
    <div>
      {/* Ticker tape */}
      {!hidden.includes('tickertape') && (
        <div className="-mx-3 sm:-mx-5 mb-6 sm:mb-8">
          <TickerTape />
        </div>
      )}

      <div className="flex gap-8">
        {/* Vertical SIGNAL text — decorative, xl only */}
        <div
          className="hidden xl:flex items-start pt-2 shrink-0 select-none"
          style={{
            writingMode: 'vertical-rl',
            transform: 'rotate(180deg)',
            color: 'var(--border-strong)',
            fontFamily: '"IBM Plex Mono", monospace',
            fontSize: '9px',
            fontWeight: 900,
            letterSpacing: '0.35em',
            textTransform: 'uppercase',
          }}
        >
          Signal
        </div>

        {/* Main feed */}
        <div className="min-w-0 flex-1">
          <NewsFeed
            minCredibility={prefs.min_credibility}
            personalized={isLoggedIn()}
          />

          {/* Sidebar shown below feed on mobile/tablet */}
          <div className="lg:hidden mt-8 border-t pt-6" style={{ borderColor: 'var(--border)' }}>
            {!hidden.includes('mostactive') && <MostActiveSidebar />}
            {!hidden.includes('movers')     && <MoversSidebar />}
          </div>
        </div>

        {/* Sidebar — desktop only, sticky */}
        <div className="hidden lg:block w-56 xl:w-64 shrink-0">
          <div className="sticky top-20 space-y-0">
            {!hidden.includes('mostactive') && <MostActiveSidebar />}
            {!hidden.includes('movers')     && <MoversSidebar />}
          </div>
        </div>
      </div>
    </div>
  );
}
