import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { ArrowLeft, ArrowUpRight, ArrowDownRight, ExternalLink, Bookmark, BookmarkCheck, MessageSquare } from 'lucide-react';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '../api/watchlist';
import { useAuth } from '../store/useAuth';
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area, ReferenceLine, ComposedChart, Bar, Legend,
} from 'recharts';
import { getStockDetail, getStockMentions, getStockChart, getSentimentHistory, getSentimentTrend, getSentimentSummary, getRedditPulse, searchStocks, getSentimentPriceOverlay, getSourceBreakdown, getAISummary, getRelatedStocks, type Mention, type ChartPoint, type Fundamentals, type SearchResult, type SentimentSnapshotPoint, type SentimentPoint, type SentimentSummary, type RedditPulse, type OverlayPoint, type SourceBreakdown, type RelatedStock } from '../api/stocks';
import { getThreads, type Thread } from '../api/discuss';
import { trackClick } from '../api/preferences';
import { usePreferences } from '../store/usePreferences';
import { staggerContainer, staggerItem } from '../components/PageEnter';

const cardStyle = { borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' };
const cardHover = 'hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)]';

function sentimentColor(score: number | null) {
  if (score === null) return 'var(--text-muted)';
  if (score >= 0.35)  return '#16a34a';
  if (score >= 0.05)  return '#22c55e';
  if (score <= -0.35) return '#b91c1c';
  if (score <= -0.05) return '#ef4444';
  return '#d97706';
}

function sentimentLabel(score: number | null) {
  if (score === null) return '—';
  if (score >= 0.35)  return 'Strongly Bullish';
  if (score >= 0.05)  return 'Bullish';
  if (score <= -0.35) return 'Strongly Bearish';
  if (score <= -0.05) return 'Bearish';
  return 'Neutral';
}

function SentimentBar({ score }: { score: number | null }) {
  const pct   = score !== null ? Math.round((score + 1) * 50) : null;
  const color = sentimentColor(score);
  return (
    <div className="flex items-center gap-3">
      <div className="h-1.5 flex-1 rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        {pct !== null && (
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
          />
        )}
      </div>
      <span className="text-xs tabular-nums font-medium w-16 text-right" style={{ color }}>
        {score !== null ? (score > 0 ? '+' : '') + score.toFixed(3) : '—'}
      </span>
    </div>
  );
}

function fmtVolume(v: number | null) {
  if (v == null) return '—';
  if (v >= 1e9) return `${(v / 1e9).toFixed(2)}B`;
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return v.toString();
}

function fmtMarketCap(v: number | null) {
  if (v == null) return '—';
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`;
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${(v / 1e6).toFixed(0)}M`;
  return `$${v}`;
}

function FundamentalsGrid({ f }: { f: Fundamentals }) {
  const rows = [
    ['Open',    f.open != null ? `$${f.open.toFixed(2)}` : '—'],
    ['High',    f.day_high != null ? `$${f.day_high.toFixed(2)}` : '—'],
    ['Low',     f.day_low != null ? `$${f.day_low.toFixed(2)}` : '—'],
    ['Vol',     fmtVolume(f.volume)],
    ['Avg Vol', fmtVolume(f.avg_volume)],
    ['Mkt Cap', fmtMarketCap(f.market_cap)],
    ['P/E',     f.pe_ratio != null ? f.pe_ratio.toFixed(2) : '—'],
    ['EPS',     f.eps != null ? `$${f.eps.toFixed(2)}` : '—'],
    ['Beta',    f.beta != null ? f.beta.toFixed(2) : '—'],
    ['Yield',   f.dividend_yield != null && f.dividend_yield > 0 ? `${f.dividend_yield.toFixed(2)}%` : '—'],
    ['52W H',   f.fifty_two_week_high != null ? `$${f.fifty_two_week_high.toFixed(2)}` : '—'],
    ['52W L',   f.fifty_two_week_low != null ? `$${f.fifty_two_week_low.toFixed(2)}` : '—'],
  ];

  return (
    <div className="rounded-lg border p-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="grid grid-cols-2 md:grid-cols-3 divide-x divide-y" style={{ borderColor: 'var(--border)' }}>
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-center justify-between px-3 py-2 gap-2">
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span className="text-xs font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>{value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

const CHART_PERIODS = ['6H', '1D', '1W', '1M', '3M', '1Y'] as const;
type ChartPeriod = typeof CHART_PERIODS[number];

function formatChartTime(isoTime: string, period: ChartPeriod) {
  const d = new Date(isoTime);
  if (period === '6H' || period === '1D') return d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (period === '1Y') return d.toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function PriceChart({ symbol, isUp, defaultPeriod = '6H' }: { symbol: string; isUp: boolean; defaultPeriod?: ChartPeriod }) {
  const [period, setPeriod] = useState<ChartPeriod>(defaultPeriod);
  const color = isUp ? '#22c55e' : '#ef4444';

  const { data, isLoading } = useQuery({
    queryKey: ['chart', symbol, period],
    queryFn: () => getStockChart(symbol, period.toLowerCase()),
    staleTime: 5 * 60_000,
  });

  const chartData = (data ?? []).map((p: ChartPoint) => ({
    time: formatChartTime(p.time, period),
    price: p.close,
  }));

  const minPrice = chartData.length ? Math.min(...chartData.map(d => d.price)) * 0.999 : 0;
  const maxPrice = chartData.length ? Math.max(...chartData.map(d => d.price)) * 1.001 : 0;

  return (
    <div className="rounded-lg border p-5 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Price Chart</h2>
        <div className="flex gap-1 flex-wrap">
          {CHART_PERIODS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
              style={{
                backgroundColor: period === p ? 'var(--bg-elevated)' : 'transparent',
                color: period === p ? 'var(--text-primary)' : 'var(--text-muted)',
                border: '1px solid',
                borderColor: period === p ? 'var(--border-hover)' : 'transparent',
              }}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {isLoading && (
        <div className="h-48 animate-pulse rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
      )}

      {!isLoading && chartData.length > 0 && (
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
            <defs>
              <linearGradient id={`grad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.2} />
                <stop offset="95%" stopColor={color} stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="time"
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              domain={[minPrice, maxPrice]}
              tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `$${v.toFixed(0)}`}
            />
            <Tooltip
              contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
              labelStyle={{ color: 'var(--text-muted)' }}
              formatter={(v: number | undefined) => v !== undefined ? [`$${v.toFixed(2)}`, 'Price'] : ['—', 'Price']}
            />
            <Area
              type="monotone"
              dataKey="price"
              stroke={color}
              strokeWidth={1.5}
              fill={`url(#grad-${symbol})`}
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}

      {!isLoading && chartData.length === 0 && (
        <p className="py-12 text-center text-sm" style={{ color: 'var(--text-muted)' }}>No price data available.</p>
      )}
    </div>
  );
}

const SOURCE_TABS = ['all', 'reddit', 'news'] as const;
type SourceTab = typeof SOURCE_TABS[number];

function SourceBadge({ source }: { source: string }) {
  const colors: Record<string, string> = {
    reddit: '#ff4500',
    twitter: '#1d9bf0',
    news: '#8b5cf6',
  };
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
      style={{ backgroundColor: `${colors[source] ?? '#888'}22`, color: colors[source] ?? '#888' }}
    >
      {source}
    </span>
  );
}

const EVENT_LABELS: Record<string, { label: string; color: string }> = {
  earnings_beat:  { label: 'Earnings Beat',  color: '#16a34a' },
  earnings_miss:  { label: 'Earnings Miss',  color: '#dc2626' },
  guidance_up:    { label: 'Guidance Up',    color: '#16a34a' },
  guidance_down:  { label: 'Guidance Down',  color: '#dc2626' },
  fda_approval:   { label: 'FDA Approval',   color: '#2563eb' },
  fda_rejection:  { label: 'FDA Rejection',  color: '#dc2626' },
  acquisition:    { label: 'Acquisition',    color: '#7c3aed' },
  ceo_change:     { label: 'CEO Change',     color: '#d97706' },
  layoffs:        { label: 'Layoffs',        color: '#dc2626' },
  partnership:    { label: 'Partnership',    color: '#0891b2' },
  buyback:        { label: 'Buyback',        color: '#16a34a' },
  ipo:            { label: 'IPO',            color: '#7c3aed' },
};

function EventBadge({ eventType, confidence }: { eventType: string; confidence: number | null }) {
  const meta = EVENT_LABELS[eventType];
  if (!meta) return null;
  const opacity = confidence !== null ? Math.round(confidence * 100) : 80;
  return (
    <span
      className="rounded px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider"
      style={{
        backgroundColor: `${meta.color}22`,
        color: meta.color,
        border: `1px solid ${meta.color}44`,
        opacity: opacity / 100,
      }}
      title={confidence !== null ? `Confidence: ${(confidence * 100).toFixed(0)}%` : undefined}
    >
      {meta.label}
    </span>
  );
}

const EVENT_COLORS: Record<string, string> = {
  earnings_beat: '#16a34a', earnings_miss: '#dc2626',
  guidance_up: '#16a34a',   guidance_down: '#dc2626',
  fda_approval: '#2563eb',  fda_rejection: '#dc2626',
  acquisition: '#7c3aed',   ceo_change: '#d97706',
  layoffs: '#dc2626',       partnership: '#0891b2',
  buyback: '#16a34a',       ipo: '#7c3aed',
};
const EVENT_HUMAN: Record<string, string> = {
  earnings_beat: 'Earnings Beat', earnings_miss: 'Earnings Miss',
  guidance_up: 'Guidance Up',     guidance_down: 'Guidance Down',
  fda_approval: 'FDA Approval',   fda_rejection: 'FDA Rejection',
  acquisition: 'Acquisition',     ceo_change: 'CEO Change',
  layoffs: 'Layoffs',             partnership: 'Partnership',
  buyback: 'Share Buyback',       ipo: 'IPO',
};
const MONO_CSS: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

function SentimentSummaryCard({ data }: { data: SentimentSummary }) {
  const scoreColor = sentimentColor(data.overall_score);
  const isLoaded = data.mention_count > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className="rounded-lg border p-5 space-y-4"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)', borderLeftWidth: 3, borderLeftColor: scoreColor }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: scoreColor }} />
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO_CSS }}>
            Market Sentiment
          </span>
        </div>
        <div className="flex items-center gap-2">
          {data.overall_score !== null && (
            <span className="text-xs font-black tabular-nums" style={{ color: scoreColor, ...MONO_CSS }}>
              {data.overall_score > 0 ? '+' : ''}{data.overall_score.toFixed(3)}
            </span>
          )}
          <span
            className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
            style={{ backgroundColor: `${scoreColor}22`, color: scoreColor, ...MONO_CSS }}
          >
            {data.label}
          </span>
        </div>
      </div>

      {/* Summary text */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {data.summary}
      </p>

      {/* Distribution bar + stats */}
      {isLoaded && (
        <div className="space-y-2">
          {/* Bullish / Neutral / Bearish bar */}
          <div className="flex h-1.5 w-full overflow-hidden rounded-full gap-px">
            <motion.div
              className="h-full rounded-l-full"
              style={{ backgroundColor: '#16a34a' }}
              initial={{ width: 0 }}
              animate={{ width: `${data.bullish_pct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.1 }}
            />
            <motion.div
              className="h-full"
              style={{ backgroundColor: '#d97706' }}
              initial={{ width: 0 }}
              animate={{ width: `${data.neutral_pct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.2 }}
            />
            <motion.div
              className="h-full rounded-r-full"
              style={{ backgroundColor: '#ef4444' }}
              initial={{ width: 0 }}
              animate={{ width: `${data.bearish_pct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.3 }}
            />
          </div>

          {/* Legend */}
          <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-muted)', ...MONO_CSS }}>
            <span style={{ color: '#16a34a' }}>▲ {data.bullish_pct}% bullish</span>
            <span style={{ color: 'var(--text-muted)' }}>{data.neutral_pct}% neutral</span>
            <span style={{ color: '#ef4444' }}>▼ {data.bearish_pct}% bearish</span>
          </div>
        </div>
      )}

      {/* Event badges */}
      {data.top_events.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {data.top_events.map((ev) => (
            <span
              key={ev.type}
              className="inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider"
              style={{
                backgroundColor: `${EVENT_COLORS[ev.type] ?? '#888'}22`,
                color: EVENT_COLORS[ev.type] ?? '#888',
                border: `1px solid ${EVENT_COLORS[ev.type] ?? '#888'}44`,
              }}
            >
              {EVENT_HUMAN[ev.type] ?? ev.type}
              <span className="opacity-70">×{ev.count}</span>
            </span>
          ))}
        </div>
      )}

      {/* Source + mention count */}
      <div className="flex items-center gap-4 text-[10px]" style={{ color: 'var(--text-muted)', ...MONO_CSS }}>
        <span>{data.scored_count} sources scored</span>
        {data.sources.reddit > 0 && <span>Reddit ×{data.sources.reddit}</span>}
        {data.sources.news > 0 && <span>News ×{data.sources.news}</span>}
      </div>
    </motion.div>
  );
}

const REDDIT_RED = '#ff4500';

function RedditPulseCard({ data }: { data: RedditPulse }) {
  const hasData = data.post_count > 0;
  const scoreColor = hasData ? sentimentColor(data.overall_score) : 'var(--text-muted)';
  const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className="rounded-lg border p-5 space-y-4"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)', borderLeftWidth: 3, borderLeftColor: REDDIT_RED }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
            Reddit Pulse
          </span>
          <span className="text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>
            {data.post_count} posts
          </span>
        </div>
        {hasData && (
          <div className="flex items-center gap-2">
            {data.overall_score !== null && (
              <span className="text-xs font-black tabular-nums" style={{ color: scoreColor, ...MONO }}>
                {data.overall_score > 0 ? '+' : ''}{data.overall_score.toFixed(3)}
              </span>
            )}
            <span
              className="rounded px-2 py-0.5 text-[10px] font-black uppercase tracking-wider"
              style={{ backgroundColor: `${scoreColor}22`, color: scoreColor, ...MONO }}
            >
              {data.label}
            </span>
          </div>
        )}
      </div>

      {/* Summary */}
      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
        {data.summary}
      </p>

      {/* Distribution bar */}
      {hasData && (
        <div className="space-y-2">
          <div className="flex h-1.5 w-full overflow-hidden rounded-full gap-px">
            <motion.div className="h-full rounded-l-full" style={{ backgroundColor: '#16a34a' }}
              initial={{ width: 0 }} animate={{ width: `${data.bullish_pct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.1 }} />
            <motion.div className="h-full" style={{ backgroundColor: '#d97706' }}
              initial={{ width: 0 }} animate={{ width: `${data.neutral_pct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.2 }} />
            <motion.div className="h-full rounded-r-full" style={{ backgroundColor: '#ef4444' }}
              initial={{ width: 0 }} animate={{ width: `${data.bearish_pct}%` }}
              transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] as [number, number, number, number], delay: 0.3 }} />
          </div>
          <div className="flex items-center justify-between text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>
            <span style={{ color: '#16a34a' }}>▲ {data.bullish_pct}% bullish</span>
            <span>{data.neutral_pct}% neutral</span>
            <span style={{ color: '#ef4444' }}>▼ {data.bearish_pct}% bearish</span>
          </div>
        </div>
      )}

      {/* Top posts */}
      {data.top_posts.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>Top Posts</p>
          {data.top_posts.map((post, i) => (
            <motion.a
              key={i}
              href={post.url}
              target="_blank"
              rel="noopener noreferrer"
              whileHover={{ x: 3 }}
              className="flex items-start gap-2 group"
            >
              <span className="text-[10px] shrink-0 mt-0.5 font-bold" style={{ color: REDDIT_RED, ...MONO }}>
                r/{post.subreddit}
              </span>
              {post.upvotes > 0 && (
                <span className="text-[10px] shrink-0 mt-0.5 tabular-nums" style={{ color: 'var(--text-muted)', ...MONO }}>
                  ↑{post.upvotes >= 1000 ? `${(post.upvotes / 1000).toFixed(1)}k` : post.upvotes}
                </span>
              )}
              <span className="text-xs flex-1 leading-snug group-hover:text-[var(--accent)] transition-colors line-clamp-2"
                style={{ color: 'var(--text-secondary)' }}>
                {post.title}
              </span>
              {post.sentiment_score !== null && (
                <span className="text-[10px] font-bold tabular-nums shrink-0" style={{ color: sentimentColor(post.sentiment_score), ...MONO }}>
                  {post.sentiment_score > 0 ? '+' : ''}{post.sentiment_score.toFixed(2)}
                </span>
              )}
            </motion.a>
          ))}
        </div>
      )}

      {/* Subreddit breakdown */}
      {Object.keys(data.subreddit_breakdown).length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {Object.entries(data.subreddit_breakdown).map(([sub, count]) => (
            <span key={sub} className="text-[10px] px-2 py-0.5 rounded border"
              style={{ borderColor: `${REDDIT_RED}44`, color: REDDIT_RED, backgroundColor: `${REDDIT_RED}11`, ...MONO }}>
              r/{sub} ×{count}
            </span>
          ))}
        </div>
      )}
    </motion.div>
  );
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1)  return 'just now';
  if (mins  < 60)  return `${mins}m ago`;
  if (hours < 24)  return `${hours}h ago`;
  if (days  <  7)  return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function credibilityTier(score: number): { label: string; color: string } {
  if (score >= 80) return { label: 'High',   color: '#16a34a' };
  if (score >= 50) return { label: 'Medium', color: '#d97706' };
  return               { label: 'Low',    color: '#ef4444' };
}

function MentionCard({ mention, featured = false }: { mention: Mention; featured?: boolean }) {
  const accentColor = mention.sentiment_score !== null
    ? sentimentColor(mention.sentiment_score)
    : 'var(--border)';
  const { label: credLabel, color: credColor } = credibilityTier(mention.credibility_score);
  const sourceLabel = mention.news_source || (mention.subreddit ? `r/${mention.subreddit}` : mention.source);

  const content = (
    <motion.a
      variants={staggerItem}
      href={mention.url ?? '#'}
      target="_blank"
      rel="noopener noreferrer"
      className={`group block rounded-lg border overflow-hidden transition-all duration-200 hover:shadow-md ${featured ? 'p-5' : 'p-4'}`}
      style={{
        borderColor: 'var(--border)',
        backgroundColor: 'var(--bg-surface)',
        borderLeftWidth: 3,
        borderLeftColor: accentColor,
        textDecoration: 'none',
      }}
    >
      {/* Top row: source + time */}
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 flex-wrap">
          <SourceBadge source={mention.source} />
          {mention.event_type && (
            <EventBadge eventType={mention.event_type} confidence={mention.event_confidence} />
          )}
          <span className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{sourceLabel}</span>
        </div>
        <span
          className="text-[10px] tabular-nums shrink-0"
          style={{ color: 'var(--text-muted)', fontFamily: '"IBM Plex Mono", monospace' }}
        >
          {timeAgo(mention.published_at)}
        </span>
      </div>

      {/* Headline */}
      <p
        className={`font-semibold leading-snug mb-2 group-hover:opacity-80 transition-opacity ${featured ? 'text-base line-clamp-3' : 'text-sm line-clamp-2'}`}
        style={{ color: 'var(--text-primary)' }}
      >
        {mention.text}
      </p>

      {/* Summary if present and featured */}
      {featured && mention.summary && (
        <p className="text-sm line-clamp-3 mb-3" style={{ color: 'var(--text-secondary)' }}>
          {mention.summary}
        </p>
      )}

      {/* Bottom row: sentiment + credibility + upvotes */}
      <div className="flex items-center justify-between gap-2 mt-auto pt-1">
        <div className="flex items-center gap-2 flex-wrap">
          {mention.sentiment_score !== null && mention.sentiment_score !== undefined && (
            <span
              className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{
                color: accentColor,
                backgroundColor: `${accentColor}18`,
              }}
            >
              {sentimentLabel(mention.sentiment_score)}
            </span>
          )}
          <span
            className="text-[10px] px-1.5 py-0.5 rounded"
            style={{ color: credColor, backgroundColor: `${credColor}18` }}
          >
            {credLabel} Cred
          </span>
          {mention.upvotes > 0 && (
            <span className="text-[10px]" style={{ color: 'var(--text-muted)', fontFamily: '"IBM Plex Mono", monospace' }}>
              ↑ {mention.upvotes >= 1000 ? `${(mention.upvotes / 1000).toFixed(1)}k` : mention.upvotes}
            </span>
          )}
        </div>
        <ExternalLink
          className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity shrink-0"
          style={{ color: 'var(--text-muted)' }}
        />
      </div>
    </motion.a>
  );

  return content;
}

// ── Related Stocks ────────────────────────────────────────────────────────────

function RelatedStocksSection({ symbol }: { symbol: string }) {
  const MONO_R: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

  const { data, isLoading } = useQuery<RelatedStock[]>({
    queryKey: ['related', symbol],
    queryFn: () => getRelatedStocks(symbol),
    staleTime: 60 * 60_000,
  });

  if (isLoading) return (
    <div className="space-y-2">
      <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Related Stocks</h2>
      <div className="flex gap-2 flex-wrap">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-20 w-28 animate-pulse rounded border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }} />
        ))}
      </div>
    </div>
  );

  if (!data || data.length === 0) return null;

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        Also Mentioned With {symbol}
      </h2>
      <div className="flex gap-2 flex-wrap">
        {data.map((s: RelatedStock) => {
          const up = (s.change_pct ?? 0) >= 0;
          const sentScore = s.sentiment_score ?? 0;
          const sentColor = sentScore >= 0.05 ? '#22c55e' : sentScore <= -0.05 ? '#ef4444' : '#d97706';
          return (
            <Link
              key={s.ticker}
              to={`/app/stock/${s.ticker}`}
              className="block border p-3 transition-colors hover:border-[var(--border-hover)]"
              style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)', minWidth: 100 }}
            >
              <div className="font-black text-sm mb-0.5" style={{ color: 'var(--text-primary)', ...MONO_R }}>
                {s.ticker}
              </div>
              {s.name && (
                <div className="text-[10px] truncate max-w-[100px] mb-1" style={{ color: 'var(--text-muted)', ...MONO_R }}>
                  {s.name.split(' ').slice(0, 2).join(' ')}
                </div>
              )}
              {s.price != null && (
                <div className="text-[11px] tabular-nums" style={{ color: 'var(--text-secondary)', ...MONO_R }}>
                  ${s.price.toFixed(2)}
                  {s.change_pct != null && (
                    <span style={{ color: up ? '#22c55e' : '#ef4444' }}>
                      {' '}{up ? '+' : ''}{s.change_pct.toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
              {s.sentiment_label && (
                <div className="mt-1 text-[9px] font-bold uppercase tracking-widest" style={{ color: sentColor, ...MONO_R }}>
                  {s.sentiment_label}
                </div>
              )}
              <div className="mt-1 text-[9px]" style={{ color: 'var(--text-muted)', ...MONO_R }}>
                co-mentioned {s.co_count}×
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

// ── Ticker Not Found ──────────────────────────────────────────────────────────

function TickerNotFound({ symbol }: { symbol: string }) {
  const MONO_S: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };
  const navigate = useNavigate();

  const { data: suggestions, isLoading } = useQuery({
    queryKey: ['search', symbol],
    queryFn: () => searchStocks(symbol),
    staleTime: 60_000,
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="flex flex-col items-center justify-center py-24 space-y-8 text-center"
    >
      {/* Animated radar */}
      <div className="relative" style={{ width: 64, height: 64 }}>
        {[1.4, 2, 2.6].map((scale, i) => (
          <motion.div
            key={i}
            className="absolute inset-0 rounded-full border-2"
            style={{ borderColor: 'var(--red)', opacity: 0.35 }}
            animate={{ scale: [1, scale], opacity: [0.4, 0] }}
            transition={{ duration: 2, repeat: Infinity, delay: i * 0.5, ease: 'easeOut' }}
          />
        ))}
        <div
          className="absolute inset-0 rounded-full border-2 flex items-center justify-center"
          style={{ borderColor: 'var(--red)' }}
        >
          <motion.div
            className="absolute inset-0"
            animate={{ rotate: 360 }}
            transition={{ duration: 2.5, repeat: Infinity, ease: 'linear' }}
          >
            <div
              className="absolute left-1/2 top-0 bottom-1/2 w-0.5 origin-bottom"
              style={{ backgroundColor: 'var(--red)', opacity: 0.8, marginLeft: '-1px' }}
            />
          </motion.div>
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: 'var(--red)' }} />
        </div>
      </div>

      {/* Message */}
      <div className="space-y-2">
        <motion.p
          initial={{ opacity: 0, x: -6 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-xl font-black uppercase tracking-widest"
          style={{ color: 'var(--red)', ...MONO_S }}
        >
          No Signal
        </motion.p>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="text-sm"
          style={{ color: 'var(--text-muted)' }}
        >
          <span className="font-bold" style={{ color: 'var(--text-primary)' }}>{symbol}</span>
          {' '}isn't a stock we recognise.
        </motion.p>
      </div>

      {/* Suggestions */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="w-full max-w-sm space-y-2"
      >
        {isLoading && (
          <p className="text-xs uppercase tracking-widest animate-pulse" style={{ color: 'var(--text-muted)', ...MONO_S }}>
            Searching…
          </p>
        )}

        {!isLoading && suggestions && suggestions.length > 0 && (
          <>
            <p className="text-[10px] font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--text-muted)', ...MONO_S }}>
              Did you mean?
            </p>
            <div className="space-y-2">
              {suggestions.map((s: SearchResult) => (
                <motion.button
                  key={s.symbol}
                  whileHover={{ x: 4 }}
                  onClick={() => navigate(`/app/stock/${s.symbol}`)}
                  className="w-full flex items-center gap-3 border px-4 py-3 text-left transition-colors hover:border-[var(--accent)] group"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
                >
                  <span
                    className="font-black text-sm w-16 shrink-0 group-hover:text-[var(--accent)] transition-colors"
                    style={{ color: 'var(--text-primary)', ...MONO_S }}
                  >
                    {s.symbol}
                  </span>
                  {s.name && (
                    <span className="truncate text-sm flex-1" style={{ color: 'var(--text-secondary)' }}>
                      {s.name}
                    </span>
                  )}
                  <ArrowUpRight className="h-4 w-4 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--accent)' }} />
                </motion.button>
              ))}
            </div>
          </>
        )}

        {!isLoading && suggestions?.length === 0 && (
          <p className="text-xs" style={{ color: 'var(--text-muted)', ...MONO_S }}>
            No similar tickers found.
          </p>
        )}
      </motion.div>

      {/* Back */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <Link
          to="/app"
          className="group inline-flex items-center gap-2 text-sm transition-colors"
          style={{ color: 'var(--text-muted)' }}
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-0.5" strokeWidth={1.5} />
          Back to feed
        </Link>
      </motion.div>
    </motion.div>
  );
}

// ── Stock Detail ──────────────────────────────────────────────────────────────

export function StockDetail() {
  const { symbol } = useParams<{ symbol: string }>();
  const [sourceTab, setSourceTab] = useState<SourceTab>('all');
  const [sentimentDays, setSentimentDays] = useState(30);
  const { isLoggedIn } = useAuth();
  const queryClient = useQueryClient();
  const prefs = usePreferences();

  // Track click for personalized feed (fire-and-forget)
  useEffect(() => {
    if (symbol && isLoggedIn()) {
      trackClick(symbol.toUpperCase()).catch(() => {});
    }
  }, [symbol]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: stock, isLoading: stockLoading, isError: stockError } = useQuery({
    queryKey: ['stock', symbol],
    queryFn: () => getStockDetail(symbol!),
    enabled: !!symbol,
    refetchInterval: 30_000,
    staleTime: 25_000,
  });

  const { data: mentions, isLoading: mentionsLoading } = useQuery({
    queryKey: ['mentions', symbol, sourceTab],
    queryFn: () => getStockMentions(symbol!, sourceTab === 'all' ? undefined : sourceTab),
    enabled: !!symbol,
  });

  const { data: sentimentHistory } = useQuery({
    queryKey: ['sentiment-history', symbol],
    queryFn: () => getSentimentHistory(symbol!, 7),
    enabled: !!symbol,
    staleTime: 10 * 60_000,
  });

  const { data: sentimentSummaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ['sentiment-summary', symbol],
    queryFn: () => getSentimentSummary(symbol!, 7),
    enabled: !!symbol && !stockLoading && !stockError,
    staleTime: 5 * 60_000,
  });

  const { data: redditPulseData, isLoading: redditLoading } = useQuery({
    queryKey: ['reddit-pulse', symbol],
    queryFn: () => getRedditPulse(symbol!),
    enabled: !!symbol && !stockLoading && !stockError,
    staleTime: 5 * 60_000,
  });

  const { data: sentimentTrend } = useQuery({
    queryKey: ['sentiment-history', symbol, sentimentDays],
    queryFn: () => getSentimentTrend(symbol!, sentimentDays),
    enabled: !!symbol,
    staleTime: 10 * 60_000,
  });

  const [overlayDays, setOverlayDays] = useState(30);
  const { data: overlayData } = useQuery({
    queryKey: ['sentiment-price-overlay', symbol, overlayDays],
    queryFn: () => getSentimentPriceOverlay(symbol!, overlayDays),
    enabled: !!symbol,
    staleTime: 10 * 60_000,
  });

  const { data: sourcesData } = useQuery({
    queryKey: ['source-breakdown', symbol],
    queryFn: () => getSourceBreakdown(symbol!, 7),
    enabled: !!symbol,
    staleTime: 10 * 60_000,
  });

  const { data: aiSummary } = useQuery({
    queryKey: ['ai-summary', symbol],
    queryFn: () => getAISummary(symbol!),
    enabled: !!symbol,
    staleTime: 10 * 60 * 1000, // 10 minutes - expensive to regenerate
  });


  // Compute delta: today's score vs yesterday's score
  const sentimentDelta = (() => {
    if (!sentimentHistory || sentimentHistory.length < 2) return null;
    const last = sentimentHistory[sentimentHistory.length - 1];
    const prev = sentimentHistory[sentimentHistory.length - 2];
    if (last.score === null || prev.score === null) return null;
    return round4(last.score - prev.score);
  })();

  function round4(n: number) { return Math.round(n * 10000) / 10000; }

  const { data: watchlist } = useQuery({
    queryKey: ['watchlist'],
    queryFn: getWatchlist,
    enabled: isLoggedIn(),
  });
  const isWatched = watchlist?.some((w) => w.ticker === symbol?.toUpperCase()) ?? false;

  const { mutate: toggleWatch, isPending: watchPending } = useMutation<unknown, Error, void>({
    mutationFn: () => isWatched ? removeFromWatchlist(symbol!) : addToWatchlist(symbol!),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['watchlist'] }),
  });

  // Treat as not-found when: API 404 error OR loaded successfully but has no price + no mentions
  const isNotFound = stockError || (!!stock && stock.price === null && stock.mention_count === 0);

  const chartData = stock?.history.map((h) => ({
    date: new Date(h.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }),
    overall: h.overall !== null ? Math.round((h.overall + 1) * 50) : null,
    news: h.news !== null ? Math.round((h.news + 1) * 50) : null,
  })) ?? [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className="space-y-8"
    >
      <Link
        to="/app"
        className="group inline-flex items-center gap-2 text-sm transition-colors duration-200"
        style={{ color: 'var(--text-secondary)' }}
      >
        <ArrowLeft className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5" strokeWidth={1.5} />
        Back
      </Link>

      {/* Header */}
      {stockLoading && (
        <div className="space-y-2 animate-pulse">
          <div className="h-7 w-32 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
          <div className="h-4 w-48 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
        </div>
      )}

      {isNotFound && <TickerNotFound symbol={symbol!} />}

      {stock && !isNotFound && (
        <>
          {/* Title + price */}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-semibold tracking-tight" style={{ color: 'var(--text-primary)' }}>
                {stock.symbol}
              </h1>
              {stock.name && (
                <p className="mt-0.5 text-sm" style={{ color: 'var(--text-muted)' }}>{stock.name}</p>
              )}
              {stock.reddit_mentions_7d > 0 && (
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px]" style={{ color: 'var(--text-muted)', fontFamily: '"IBM Plex Mono", monospace' }}>
                  <MessageSquare className="h-3 w-3" />
                  <span>{stock.reddit_mentions_7d} Reddit mentions (7d)</span>
                </div>
              )}
            </div>
            <div className="flex items-start gap-3">
              {isLoggedIn() && (
                <button
                  onClick={() => toggleWatch()}
                  disabled={watchPending}
                  className="flex items-center gap-1.5 px-3 py-1.5 border text-[10px] font-bold uppercase tracking-widest transition-colors disabled:opacity-50"
                  style={{
                    fontFamily: '"IBM Plex Mono", monospace',
                    borderColor: isWatched ? 'var(--accent)' : 'var(--border)',
                    color: isWatched ? 'var(--accent)' : 'var(--text-muted)',
                    backgroundColor: isWatched ? 'var(--accent-dim)' : 'transparent',
                  }}
                  title={isWatched ? 'Remove from watchlist' : 'Add to watchlist'}
                >
                  {isWatched
                    ? <BookmarkCheck className="h-3.5 w-3.5" />
                    : <Bookmark className="h-3.5 w-3.5" />
                  }
                  {isWatched ? 'Watching' : 'Watch'}
                </button>
              )}
              {stock.price != null && (
                <div className="text-right">
                  <div className="text-xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
                    ${stock.price.toFixed(2)}
                  </div>
                  {stock.change_pct != null && (
                    <div className="flex items-center justify-end gap-0.5 text-sm font-medium" style={{ color: stock.change_pct >= 0 ? '#22c55e' : '#ef4444' }}>
                      {stock.change_pct >= 0 ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                      {Math.abs(stock.change_pct).toFixed(2)}%
                    </div>
                  )}
                  <span className="inline-flex items-center gap-1.5 text-[9px] uppercase tracking-widest justify-end mt-0.5" style={{ color: 'var(--accent)', fontFamily: '"IBM Plex Mono", monospace' }}>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-current animate-pulse" />
                    Live
                  </span>
                  {/* After-hours / pre-market price */}
                  {(stock.post_market_price != null || stock.pre_market_price != null) && (
                    <div className="mt-1.5 flex items-center justify-end gap-1.5 text-[10px]" style={{ fontFamily: '"IBM Plex Mono", monospace' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        {stock.post_market_price != null ? 'After Hours' : 'Pre-Market'}
                      </span>
                      <span style={{ color: 'var(--text-secondary)' }}>
                        ${(stock.post_market_price ?? stock.pre_market_price!).toFixed(2)}
                      </span>
                      {stock.ext_change_pct != null && (
                        <span style={{ color: stock.ext_change_pct >= 0 ? '#22c55e' : '#ef4444' }}>
                          {stock.ext_change_pct >= 0 ? '+' : ''}{stock.ext_change_pct.toFixed(2)}%
                        </span>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Price chart */}
          <PriceChart symbol={stock.symbol} isUp={(stock.change_pct ?? 0) >= 0} defaultPeriod={prefs.default_timeframe as ChartPeriod} />

          {/* AI Summary */}
          {aiSummary?.available && aiSummary?.summary && (
            <section>
              <div className="border p-4" style={{ borderColor: 'var(--accent)', borderLeftWidth: 3, backgroundColor: 'var(--bg-surface)' }}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--accent)', fontFamily: '"IBM Plex Mono", monospace' }}>
                    ✦ AI Summary
                  </span>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)', fontFamily: '"IBM Plex Mono", monospace' }}>
                    · {aiSummary.article_count} articles · powered by Claude
                  </span>
                </div>
                <p className="text-[13px] leading-relaxed" style={{ color: 'var(--text-secondary)', fontFamily: '"IBM Plex Mono", monospace' }}>
                  {aiSummary.summary}
                </p>
              </div>
            </section>
          )}

          {/* Sentiment Trend Chart */}
          {(() => {
            const MONO_T: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };
            const trendData = (sentimentTrend ?? []) as SentimentPoint[];
            const totalArticles = trendData.reduce((s, p) => s + p.count, 0);
            // Article count context: compare recent 7 days vs whole period average
            const recentDays = trendData.slice(-7);
            const recentTotal = recentDays.reduce((s, p) => s + p.count, 0);
            const avgPerDay = trendData.length > 0 ? totalArticles / trendData.length : 0;
            const recentAvgPerDay = recentDays.length > 0 ? recentTotal / recentDays.length : 0;
            const articleContext = avgPerDay > 0 && trendData.length >= 14
              ? recentAvgPerDay > avgPerDay * 1.3
                ? { label: 'Above avg activity', color: '#16a34a' }
                : recentAvgPerDay < avgPerDay * 0.7
                ? { label: 'Below avg activity', color: '#d97706' }
                : null
              : null;
            return (
              <div className="rounded-lg border p-5 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                      Sentiment Trend
                    </h2>
                    {trendData.length > 0 && (
                      <span className="text-[10px] tabular-nums" style={{ color: 'var(--text-muted)', ...MONO_T }}>
                        {totalArticles} articles
                      </span>
                    )}
                    {articleContext && (
                      <span
                        className="text-[9px] font-bold uppercase tracking-widest px-1.5 py-px"
                        style={{ color: articleContext.color, backgroundColor: `${articleContext.color}20`, ...MONO_T }}
                      >
                        {articleContext.label}
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {([7, 30, 90] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setSentimentDays(d)}
                        className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: sentimentDays === d ? 'var(--bg-elevated)' : 'transparent',
                          color: sentimentDays === d ? 'var(--text-primary)' : 'var(--text-muted)',
                          border: '1px solid',
                          borderColor: sentimentDays === d ? 'var(--border-hover)' : 'transparent',
                          ...MONO_T,
                        }}
                      >
                        {d === 7 ? '7D' : d === 30 ? '30D' : '90D'}
                      </button>
                    ))}
                  </div>
                </div>

                {trendData.length === 0 ? (
                  <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    No sentiment data for this period
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={trendData} margin={{ top: 8, right: 4, bottom: 0, left: -28 }}>
                      <defs>
                        <linearGradient id={`sent-grad-${stock.symbol}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#22c55e" stopOpacity={0.25} />
                          <stop offset="50%" stopColor="#22c55e" stopOpacity={0.05} />
                          <stop offset="95%" stopColor="#ef4444" stopOpacity={0.15} />
                        </linearGradient>
                      </defs>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        tickFormatter={(v: string) => {
                          const d = new Date(v);
                          return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                        }}
                      />
                      <YAxis
                        domain={[-1, 1]}
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => v.toFixed(1)}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                        labelStyle={{ color: 'var(--text-muted)' }}
                        formatter={(v: number | undefined, _name: string | undefined, props: { payload?: SentimentPoint }) => [
                          v != null ? `${v > 0 ? '+' : ''}${v.toFixed(3)}` : '—',
                          `Sentiment (${props.payload?.count ?? 0} articles)`,
                        ]}
                      />
                      <ReferenceLine y={0} stroke="var(--border-hover)" strokeDasharray="3 3" />
                      <Area
                        type="monotone"
                        dataKey="score"
                        stroke="#22c55e"
                        strokeWidth={1.5}
                        fill={`url(#sent-grad-${stock.symbol})`}
                        dot={false}
                        connectNulls
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            );
          })()}

          {/* Sentiment vs Price Overlay */}
          {(() => {
            const MONO_O: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };
            const points = (overlayData ?? []) as OverlayPoint[];
            const hasEnough = points.filter(p => p.sentiment !== null && p.price !== null).length >= 3;
            return (
              <div className="rounded-lg border p-5 space-y-4" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Sentiment vs Price
                  </h2>
                  <div className="flex gap-1 flex-wrap">
                    {([7, 30, 90] as const).map((d) => (
                      <button
                        key={d}
                        onClick={() => setOverlayDays(d)}
                        className="rounded px-2 py-0.5 text-xs font-medium transition-colors"
                        style={{
                          backgroundColor: overlayDays === d ? 'var(--bg-elevated)' : 'transparent',
                          color: overlayDays === d ? 'var(--text-primary)' : 'var(--text-muted)',
                          border: '1px solid',
                          borderColor: overlayDays === d ? 'var(--border-hover)' : 'transparent',
                          ...MONO_O,
                        }}
                      >
                        {d === 7 ? '7D' : d === 30 ? '30D' : '90D'}
                      </button>
                    ))}
                  </div>
                </div>

                {!hasEnough ? (
                  <p className="py-10 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                    Not enough data for overlay
                  </p>
                ) : (
                  <ResponsiveContainer width="100%" height={220}>
                    <ComposedChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: -20 }}>
                      <XAxis
                        dataKey="date"
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        interval="preserveStartEnd"
                        tickFormatter={(v: string) => {
                          const d = new Date(v);
                          return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
                        }}
                      />
                      <YAxis
                        yAxisId="price"
                        orientation="left"
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => `$${v.toFixed(0)}`}
                      />
                      <YAxis
                        yAxisId="sentiment"
                        orientation="right"
                        domain={[-1, 1]}
                        tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v: number) => v.toFixed(1)}
                      />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                        labelStyle={{ color: 'var(--text-muted)' }}
                        formatter={(value, name) => {
                          const v = value as number | null | undefined;
                          const n = (name ?? '') as string;
                          if (v === null || v === undefined) return ['—', n];
                          if (n === 'Price') return [`$${v.toFixed(2)}`, n];
                          return [`${v > 0 ? '+' : ''}${v.toFixed(3)}`, n];
                        }}
                      />
                      <Legend
                        wrapperStyle={{ fontSize: 10, paddingTop: 4 }}
                        formatter={(value) => <span style={{ color: 'var(--text-muted)', fontFamily: '"IBM Plex Mono", monospace' }}>{value}</span>}
                      />
                      <ReferenceLine yAxisId="sentiment" y={0} stroke="var(--border-hover)" strokeDasharray="3 3" />
                      <Line
                        yAxisId="price"
                        type="monotone"
                        dataKey="price"
                        name="Price"
                        stroke="var(--accent)"
                        strokeWidth={1.5}
                        dot={false}
                        connectNulls
                      />
                      <Bar
                        yAxisId="sentiment"
                        dataKey="sentiment"
                        name="Sentiment"
                        fill="#22c55e"
                        opacity={0.5}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                )}
              </div>
            );
          })()}

          {/* Fundamentals */}
          {stock.fundamentals && <FundamentalsGrid f={stock.fundamentals} />}

          {/* Coverage Sources */}
          {sourcesData && sourcesData.length > 0 && (() => {
            const MONO_S: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };
            return (
              <div className="rounded-lg border p-5 space-y-3" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
                <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                  Coverage Sources
                </h2>
                <div className="space-y-1.5">
                  {(sourcesData as SourceBreakdown[]).map(s => (
                    <div key={s.source} className="flex items-center gap-2">
                      <span className="text-[10px] w-32 truncate" style={{ color: 'var(--text-muted)', ...MONO_S }}>{s.source}</span>
                      <div className="flex-1 h-1.5 rounded-full" style={{ background: 'var(--border)' }}>
                        <div className="h-full rounded-full" style={{ width: `${s.pct}%`, background: 'var(--green)' }} />
                      </div>
                      <span className="text-[10px] w-8 text-right" style={{ color: 'var(--text-muted)', ...MONO_S }}>{s.pct}%</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* Sentiment Summary */}
          {summaryLoading && (
            <div className="rounded-lg border p-5 space-y-3 animate-pulse" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
              <div className="h-3 w-32 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              <div className="h-4 w-full rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              <div className="h-4 w-4/5 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              <div className="h-1.5 w-full rounded-full" style={{ backgroundColor: 'var(--bg-elevated)' }} />
            </div>
          )}
          {sentimentSummaryData && !summaryLoading && (
            <SentimentSummaryCard data={sentimentSummaryData} />
          )}

          {/* Reddit Pulse */}
          {redditLoading && (
            <div className="rounded-lg border p-5 space-y-3 animate-pulse" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}>
              <div className="h-3 w-28 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              <div className="h-4 w-full rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
              <div className="h-4 w-3/4 rounded" style={{ backgroundColor: 'var(--bg-elevated)' }} />
            </div>
          )}
          {redditPulseData && !redditLoading && (
            <RedditPulseCard data={redditPulseData} />
          )}

          {/* 7-day sentiment trend chart */}
          {chartData.length > 0 && (
            <div className={`rounded-lg border p-5 transition-colors ${cardHover}`} style={cardStyle}>
              <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
                <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>7-Day Sentiment Trend</h2>
                {sentimentDelta !== null && (
                  <div className="flex items-center gap-1 sm:gap-1.5 text-xs flex-wrap">
                    <span style={{ color: 'var(--text-muted)' }}>vs yesterday:</span>
                    <span className="font-semibold tabular-nums" style={{ color: sentimentDelta >= 0 ? '#22c55e' : '#ef4444' }}>
                      {sentimentDelta > 0 ? '+' : ''}{sentimentDelta.toFixed(3)}
                    </span>
                    <span className="hidden sm:inline" style={{ color: 'var(--text-muted)' }}>({sentimentDelta >= 0 ? 'improving' : 'declining'})</span>
                  </div>
                )}
              </div>
              <ResponsiveContainer width="100%" height={160}>
                <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 0, left: -24 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: 'var(--text-muted)' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 12 }}
                    labelStyle={{ color: 'var(--text-muted)' }}
                  />
                  <Line type="monotone" dataKey="overall" stroke="#8b5cf6" strokeWidth={2} dot={false} name="Overall" connectNulls />
                  <Line type="monotone" dataKey="news" stroke="#06b6d4" strokeWidth={1.5} dot={false} name="News" connectNulls strokeDasharray="4 2" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Mentions */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>News &amp; Mentions</h2>
              <div className="flex gap-1 flex-wrap">
                {SOURCE_TABS.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setSourceTab(tab)}
                    className="rounded px-2.5 py-1 text-xs font-medium capitalize transition-colors"
                    style={{
                      backgroundColor: sourceTab === tab ? 'var(--bg-elevated)' : 'transparent',
                      color: sourceTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                      border: '1px solid',
                      borderColor: sourceTab === tab ? 'var(--border-hover)' : 'transparent',
                    }}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            {mentionsLoading && (
              <div className="space-y-3 animate-pulse">
                <div className="h-36 rounded-lg" style={{ backgroundColor: 'var(--bg-surface)' }} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="h-28 rounded-lg" style={{ backgroundColor: 'var(--bg-surface)' }} />
                  ))}
                </div>
              </div>
            )}

            {mentions && mentions.length === 0 && (
              <p className="py-8 text-center text-sm" style={{ color: 'var(--text-muted)' }}>
                No high-quality mentions found in the last 7 days.
              </p>
            )}

            {mentions && mentions.length > 0 && (
              <motion.div
                className="space-y-3"
                variants={staggerContainer}
                initial="hidden"
                animate="show"
              >
                {/* Featured article — first item, full width */}
                <MentionCard key={mentions[0].id} mention={mentions[0]} featured />

                {/* Rest — 2-col grid */}
                {mentions.length > 1 && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {mentions.slice(1).map((m: Mention) => (
                      <MentionCard key={m.id} mention={m} />
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </div>

          {/* Related Stocks */}
          <RelatedStocksSection symbol={stock.symbol} />

          {/* Discussion */}
          <TickerDiscussion symbol={stock.symbol} />
        </>
      )}
    </motion.div>
  );
}

// ── Ticker Discussion Panel ───────────────────────────────────────────────────

function TickerDiscussion({ symbol }: { symbol: string }) {
  const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

  const { data: threads, isLoading } = useQuery({
    queryKey: ['threads', symbol, 'new'],
    queryFn:  () => getThreads(symbol, 'new'),
    staleTime: 60_000,
  });

  function timeAgo(iso: string) {
    const diff = Date.now() - new Date(iso).getTime();
    const h = Math.floor(diff / 3_600_000);
    const d = Math.floor(diff / 86_400_000);
    if (d >= 1) return `${d}d ago`;
    if (h >= 1) return `${h}h ago`;
    return `${Math.floor(diff / 60_000)}m ago`;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-medium uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Discussion
        </h2>
        <Link
          to={`/app/discuss?ticker=${symbol}`}
          className="text-[10px] font-bold uppercase tracking-widest transition-colors hover:text-[var(--accent)]"
          style={{ color: 'var(--text-muted)', ...MONO }}
        >
          View all →
        </Link>
      </div>

      {isLoading && (
        <div className="space-y-2 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 rounded border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }} />
          ))}
        </div>
      )}

      {!isLoading && (!threads || threads.length === 0) && (
        <div className="border py-8 text-center space-y-2" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            No threads about {symbol} yet.
          </p>
          <Link
            to={`/app/discuss?ticker=${symbol}`}
            className="inline-block px-3 py-1 text-[10px] font-black uppercase tracking-widest"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
          >
            Start a Thread
          </Link>
        </div>
      )}

      {threads && threads.slice(0, 3).map((t: Thread) => (
        <Link
          key={t.id}
          to={`/app/discuss/${t.id}`}
          className="flex items-start gap-3 border p-3 transition-colors hover:border-[var(--border-hover)] hover:bg-[var(--bg-elevated)] group"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
        >
          <div className="flex flex-col items-center gap-0.5 shrink-0 pt-0.5">
            <span className="text-sm font-black tabular-nums" style={{ color: 'var(--accent)', ...MONO }}>
              {t.score}
            </span>
            <span className="text-[8px] uppercase" style={{ color: 'var(--text-muted)', ...MONO }}>up</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold group-hover:underline underline-offset-2 leading-snug"
               style={{ color: 'var(--text-primary)' }}>
              {t.title}
            </p>
            <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)', ...MONO }}>
              {t.author} · {timeAgo(t.created_at)} · {t.comment_count} {t.comment_count === 1 ? 'reply' : 'replies'}
            </p>
          </div>
        </Link>
      ))}

      {threads && threads.length > 0 && (
        <Link
          to={`/app/discuss?ticker=${symbol}`}
          className="block text-center py-2 text-[10px] font-bold uppercase tracking-widest border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
        >
          + Start a Thread about {symbol}
        </Link>
      )}
    </div>
  );
}
