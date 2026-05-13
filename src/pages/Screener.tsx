import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Filter, TrendingUp, TrendingDown, Minus, Plus } from 'lucide-react';
import { screenStocks, type ScreenerParams, type ScreenerResult } from '../api/stocks';
import { staggerContainer, staggerItem } from '../components/PageEnter';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

type SentimentFilter = 'all' | 'bullish' | 'bearish';
type SortBy = 'mentions' | 'sentiment' | 'credibility';

function sentimentColor(score: number): string {
  if (score >= 0.05)  return 'var(--green)';
  if (score <= -0.05) return 'var(--red)';
  return 'var(--text-muted)';
}

function ScoreBar({ score }: { score: number }) {
  // Map -1..+1 to 0..100% width, pivot at 50%
  const clamped = Math.max(-1, Math.min(1, score));
  const color = sentimentColor(score);

  if (clamped >= 0) {
    // Positive: bar goes right from center
    return (
      <div className="relative h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            left: '50%',
            width: `${clamped * 50}%`,
            backgroundColor: color,
          }}
        />
        <div className="absolute top-0 left-1/2 h-full w-px" style={{ backgroundColor: 'var(--border)' }} />
      </div>
    );
  } else {
    // Negative: bar goes left from center
    return (
      <div className="relative h-1.5 w-full rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
        <div
          className="absolute top-0 h-full rounded-full"
          style={{
            right: '50%',
            width: `${Math.abs(clamped) * 50}%`,
            backgroundColor: color,
          }}
        />
        <div className="absolute top-0 left-1/2 h-full w-px" style={{ backgroundColor: 'var(--border)' }} />
      </div>
    );
  }
}

function SentimentBadge({ label }: { label: ScreenerResult['sentiment_label'] }) {
  const color =
    label === 'Bullish' ? 'var(--accent)' :
    label === 'Bearish' ? 'var(--red)' :
    'var(--text-muted)';
  const Icon =
    label === 'Bullish' ? TrendingUp :
    label === 'Bearish' ? TrendingDown :
    Minus;

  return (
    <span
      className="inline-flex items-center gap-1 border px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider"
      style={{ borderColor: color, color, ...MONO }}
    >
      <Icon size={10} />
      {label}
    </span>
  );
}

function SkeletonRows() {
  return (
    <>
      {Array.from({ length: 8 }).map((_, i) => (
        <tr key={i} className="border-b" style={{ borderColor: 'var(--border)' }}>
          {Array.from({ length: 6 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div
                className="h-3 rounded animate-pulse"
                style={{
                  backgroundColor: 'var(--bg-elevated)',
                  width: j === 0 ? '60px' : j === 4 ? '80px' : '100%',
                }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
}

export function Screener() {
  const [days, setDays]                   = useState<1 | 7 | 30>(7);
  const [sentimentFilter, setSentimentFilter] = useState<SentimentFilter>('all');
  const [minMentions, setMinMentions]     = useState(1);
  const [minCredibility, setMinCredibility] = useState(0);
  const [sortBy, setSortBy]               = useState<SortBy>('mentions');

  // "committed" params — only updated when Screen button is clicked
  const [params, setParams] = useState<ScreenerParams>({
    days: 7,
    sort_by: 'mentions',
    min_mentions: 1,
    min_credibility: 0,
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['screener', params],
    queryFn: () => screenStocks(params),
    staleTime: 60_000,
  });

  function handleScreen() {
    const nextParams: ScreenerParams = {
      days,
      min_mentions: minMentions,
      min_credibility: minCredibility,
      sort_by: sortBy,
    };
    if (sentimentFilter === 'bullish') {
      nextParams.min_sentiment = 0.05;
      nextParams.max_sentiment = 1.0;
    } else if (sentimentFilter === 'bearish') {
      nextParams.min_sentiment = -1.0;
      nextParams.max_sentiment = -0.05;
    }
    setParams(nextParams);
  }

  const results = data ?? [];
  const loading = isLoading || isFetching;

  return (
    <motion.div
      variants={staggerContainer}
      initial="initial"
      animate="animate"
      className="mx-auto max-w-screen-xl px-5 py-8 space-y-8"
    >
      {/* Page header */}
      <motion.div variants={staggerItem} className="space-y-1">
        <div className="flex items-center gap-2">
          <Filter size={14} style={{ color: 'var(--accent)' }} />
          <span
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: 'var(--accent)', ...MONO }}
          >
            Stock Screener
          </span>
        </div>
        <h1
          className="text-2xl font-black uppercase"
          style={{ color: 'var(--text-primary)', ...MONO }}
        >
          Screen by Sentiment
        </h1>
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Filter stocks by sentiment score, mention volume, and source credibility.
        </p>
      </motion.div>

      {/* Filter controls */}
      <motion.div
        variants={staggerItem}
        className="border rounded p-4 space-y-4"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
      >
        <div className="flex flex-wrap gap-6 items-end">

          {/* Time window */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              Time Window
            </span>
            <div className="flex gap-1">
              {([1, 7, 30] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDays(d)}
                  className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors"
                  style={{
                    borderColor: days === d ? 'var(--accent)' : 'var(--border)',
                    color: days === d ? 'var(--accent)' : 'var(--text-muted)',
                    backgroundColor: days === d ? 'var(--bg-elevated)' : 'transparent',
                    ...MONO,
                  }}
                >
                  {d === 1 ? '1D' : d === 7 ? '7D' : '30D'}
                </button>
              ))}
            </div>
          </div>

          {/* Sentiment filter */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              Sentiment
            </span>
            <div className="flex gap-1 flex-wrap">
              {(
                [
                  { value: 'all', label: 'All' },
                  { value: 'bullish', label: 'Bullish (> 0.05)' },
                  { value: 'bearish', label: 'Bearish (< -0.05)' },
                ] as { value: SentimentFilter; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSentimentFilter(value)}
                  className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors"
                  style={{
                    borderColor: sentimentFilter === value ? 'var(--accent)' : 'var(--border)',
                    color: sentimentFilter === value ? 'var(--accent)' : 'var(--text-muted)',
                    backgroundColor: sentimentFilter === value ? 'var(--bg-elevated)' : 'transparent',
                    ...MONO,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Min mentions */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              Min Mentions
            </span>
            <input
              type="number"
              min={1}
              value={minMentions}
              onChange={(e) => setMinMentions(Math.max(1, parseInt(e.target.value) || 1))}
              className="w-20 border rounded px-2.5 py-1 text-[12px] outline-none focus:border-[var(--accent)] transition-colors bg-transparent"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
            />
          </div>

          {/* Min credibility */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              Min Credibility
            </span>
            <div className="flex gap-1">
              {[0, 40, 60, 80].map((c) => (
                <button
                  key={c}
                  onClick={() => setMinCredibility(c)}
                  className="px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors"
                  style={{
                    borderColor: minCredibility === c ? 'var(--accent)' : 'var(--border)',
                    color: minCredibility === c ? 'var(--accent)' : 'var(--text-muted)',
                    backgroundColor: minCredibility === c ? 'var(--bg-elevated)' : 'transparent',
                    ...MONO,
                  }}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* Sort by */}
          <div className="space-y-1.5">
            <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              Sort By
            </span>
            <div className="flex gap-1">
              {(
                [
                  { value: 'mentions', label: 'Mentions' },
                  { value: 'sentiment', label: 'Sentiment' },
                  { value: 'credibility', label: 'Credibility' },
                ] as { value: SortBy; label: string }[]
              ).map(({ value, label }) => (
                <button
                  key={value}
                  onClick={() => setSortBy(value)}
                  className="px-3 py-1 text-[10px] font-bold uppercase tracking-widest border transition-colors"
                  style={{
                    borderColor: sortBy === value ? 'var(--accent)' : 'var(--border)',
                    color: sortBy === value ? 'var(--accent)' : 'var(--text-muted)',
                    backgroundColor: sortBy === value ? 'var(--bg-elevated)' : 'transparent',
                    ...MONO,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Screen button */}
          <button
            onClick={handleScreen}
            disabled={loading}
            className="border px-5 py-2 text-[11px] font-black uppercase tracking-widest transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed self-end"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', ...MONO }}
          >
            {loading ? 'Screening...' : 'Screen'}
          </button>
        </div>
      </motion.div>

      {/* Results table */}
      <motion.div variants={staggerItem}>
        <div className="border rounded overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full">
            <thead>
              <tr
                className="border-b text-left"
                style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
              >
                {['Ticker', 'Sentiment', 'Score', 'Mentions', 'Credibility', 'Action'].map((col) => (
                  <th
                    key={col}
                    className="px-4 py-2.5 text-[9px] font-black uppercase tracking-widest"
                    style={{ color: 'var(--text-muted)', ...MONO }}
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading && <SkeletonRows />}

              {!loading && results.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <p
                      className="text-[12px] font-bold uppercase tracking-widest"
                      style={{ color: 'var(--text-muted)', ...MONO }}
                    >
                      No stocks match your filters. Try relaxing the criteria.
                    </p>
                  </td>
                </tr>
              )}

              {!loading && results.map((row, i) => (
                <motion.tr
                  key={row.ticker}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="border-b transition-colors hover:bg-[var(--bg-elevated)]"
                  style={{ borderColor: 'var(--border)' }}
                >
                  {/* Ticker */}
                  <td className="px-4 py-3">
                    <Link
                      to={`/app/stock/${row.ticker}`}
                      className="text-[13px] font-black uppercase transition-colors hover:text-[var(--accent)]"
                      style={{ color: 'var(--text-primary)', ...MONO }}
                    >
                      {row.ticker}
                    </Link>
                  </td>

                  {/* Sentiment badge */}
                  <td className="px-4 py-3">
                    <SentimentBadge label={row.sentiment_label} />
                  </td>

                  {/* Score bar */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 min-w-[120px]">
                      <div className="flex-1">
                        <ScoreBar score={row.avg_sentiment} />
                      </div>
                      <span
                        className="text-[10px] font-bold shrink-0 w-14 text-right"
                        style={{ color: sentimentColor(row.avg_sentiment), ...MONO }}
                      >
                        {row.avg_sentiment >= 0 ? '+' : ''}{row.avg_sentiment.toFixed(4)}
                      </span>
                    </div>
                  </td>

                  {/* Mention count */}
                  <td className="px-4 py-3">
                    <span
                      className="text-[12px] font-bold"
                      style={{ color: 'var(--text-primary)', ...MONO }}
                    >
                      {row.mention_count.toLocaleString()}
                    </span>
                  </td>

                  {/* Credibility */}
                  <td className="px-4 py-3">
                    <span
                      className="text-[12px] font-bold"
                      style={{ color: 'var(--text-secondary)', ...MONO }}
                    >
                      {row.avg_credibility.toFixed(1)}
                    </span>
                  </td>

                  {/* Action */}
                  <td className="px-4 py-3">
                    <Link
                      to="/app/watchlists"
                      title="Add to Watchlist"
                      className="inline-flex items-center gap-1 border px-2.5 py-1 text-[9px] font-bold uppercase tracking-widest transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
                    >
                      <Plus size={10} />
                      Watch
                    </Link>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && results.length > 0 && (
          <p
            className="mt-2 text-[10px]"
            style={{ color: 'var(--text-muted)', ...MONO }}
          >
            {results.length} stock{results.length !== 1 ? 's' : ''} matched
          </p>
        )}
      </motion.div>
    </motion.div>
  );
}
