import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown, Minus, BarChart2 } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { compareStocks, type CompareResult } from '../api/stocks';
import { staggerContainer, staggerItem } from '../components/PageEnter';

const MONO: React.CSSProperties = { fontFamily: "'IBM Plex Mono', monospace" };

function sentimentColor(score: number): string {
  if (score >= 0.05)  return 'var(--green)';
  if (score <= -0.05) return 'var(--red)';
  return 'var(--text-muted)';
}

function sentimentLabel(score: number): string {
  if (score >= 0.35)  return 'Strongly Bullish';
  if (score >= 0.05)  return 'Bullish';
  if (score <= -0.35) return 'Strongly Bearish';
  if (score <= -0.05) return 'Bearish';
  return 'Neutral';
}

function SentimentIcon({ score }: { score: number }) {
  if (score >= 0.05)  return <TrendingUp  size={16} style={{ color: 'var(--accent)' }} />;
  if (score <= -0.05) return <TrendingDown size={16} style={{ color: 'var(--red)' }} />;
  return <Minus size={16} style={{ color: 'var(--text-muted)' }} />;
}

interface StockCardProps {
  result: CompareResult;
  rank: number;
}

function StockCard({ result, rank }: StockCardProps) {
  const { ticker, mention_count, avg_sentiment, reddit_mentions } = result;
  const color   = sentimentColor(avg_sentiment);
  const label   = sentimentLabel(avg_sentiment);
  const scoreSign = avg_sentiment >= 0 ? '+' : '';

  return (
    <motion.div
      variants={staggerItem}
      className="border rounded flex flex-col gap-5 p-6"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <span
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: 'var(--text-muted)', ...MONO }}
          >
            #{rank}
          </span>
          <h2
            className="text-3xl font-black mt-0.5 uppercase"
            style={{ color: 'var(--text-primary)', ...MONO }}
          >
            {ticker}
          </h2>
        </div>
        <div
          className="flex items-center gap-1 border px-2 py-1 rounded text-[10px] font-bold uppercase tracking-wider"
          style={{ borderColor: color, color, ...MONO }}
        >
          <SentimentIcon score={avg_sentiment} />
          {label}
        </div>
      </div>

      {/* Divider */}
      <div className="h-px w-full" style={{ backgroundColor: 'var(--border)' }} />

      {/* Sentiment score */}
      <div>
        <span className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
          Avg Sentiment (7d)
        </span>
        <div
          className="text-4xl font-black mt-1"
          style={{ color, ...MONO }}
        >
          {scoreSign}{avg_sentiment.toFixed(4)}
        </div>
        {/* Sentiment bar */}
        <div
          className="mt-2 h-1.5 rounded-full overflow-hidden"
          style={{ backgroundColor: 'var(--bg-elevated)' }}
        >
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(Math.abs(avg_sentiment) * 200, 100)}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 gap-3">
        <div
          className="border rounded p-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
        >
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
            Mentions
          </div>
          <div className="text-2xl font-black mt-0.5" style={{ color: 'var(--text-primary)', ...MONO }}>
            {mention_count}
          </div>
        </div>
        <div
          className="border rounded p-3"
          style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
        >
          <div className="text-[9px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
            Reddit
          </div>
          <div className="text-2xl font-black mt-0.5" style={{ color: 'var(--text-primary)', ...MONO }}>
            {reddit_mentions}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

// Custom Recharts tooltip
function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number; payload: CompareResult }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="border text-[11px] px-3 py-2 rounded"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)', ...MONO }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
      <span style={{ color: 'var(--text-primary)' }}>{payload[0].value}</span>
    </div>
  );
}

function SentimentChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: { value: number }[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  const val = payload[0].value;
  const sign = val >= 0 ? '+' : '';
  return (
    <div
      className="border text-[11px] px-3 py-2 rounded"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)', ...MONO }}
    >
      <span style={{ color: 'var(--text-muted)' }}>{label}: </span>
      <span style={{ color: sentimentColor(val) }}>{sign}{val.toFixed(4)}</span>
    </div>
  );
}

export function Compare() {
  const [input, setInput]   = useState('');
  const [tickers, setTickers] = useState<string[]>([]);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ['compare', tickers],
    queryFn: () => compareStocks(tickers),
    enabled: tickers.length > 0,
  });

  const handleCompare = () => {
    const parsed = input
      .split(/[,\s]+/)
      .map((t) => t.toUpperCase().trim())
      .filter(Boolean)
      .slice(0, 3);
    if (parsed.length > 0) setTickers(parsed);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleCompare();
  };

  const hasData = data && data.length > 0;

  // Recharts data
  const sentimentChartData = hasData
    ? data.map((r) => ({ ...r, score: r.avg_sentiment }))
    : [];
  const mentionChartData = hasData
    ? data.map((r) => ({ ...r, mentions: r.mention_count }))
    : [];

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="show"
      className="mx-auto max-w-screen-xl px-5 py-8 space-y-10"
    >
      {/* Page header */}
      <motion.div variants={staggerItem} className="space-y-1">
        <div className="flex items-center gap-2">
          <BarChart2 size={14} style={{ color: 'var(--green)' }} />
          <span
            className="text-[9px] font-black uppercase tracking-widest"
            style={{ color: 'var(--accent)', ...MONO }}
          >
            Stock Compare
          </span>
        </div>
        <h1
          className="text-2xl font-black uppercase"
          style={{ color: 'var(--text-primary)', ...MONO }}
        >
          Side-by-Side Comparison
        </h1>
        <p className="text-[12px]" style={{ color: 'var(--text-muted)' }}>
          Compare sentiment, mentions, and Reddit activity for up to 3 tickers over the last 7 days.
        </p>
      </motion.div>

      {/* Input row */}
      <motion.div variants={staggerItem} className="space-y-1.5">
        <div className="flex gap-3 flex-wrap">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. AAPL, MSFT, GOOGL"
            className="flex-1 min-w-[200px] border rounded px-4 py-2.5 text-[12px] outline-none focus:border-[var(--accent)] transition-colors bg-transparent"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
            maxLength={30}
          />
          <button
            onClick={handleCompare}
            disabled={isLoading || isFetching}
            className="border px-5 py-2.5 text-[11px] font-black uppercase tracking-widest transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', ...MONO }}
          >
            {isLoading || isFetching ? 'Loading...' : 'Compare'}
          </button>
        </div>
        <p className="text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>
          Up to 3 tickers
        </p>
      </motion.div>

      {/* Error */}
      {error && (
        <motion.div
          variants={staggerItem}
          className="border rounded p-4 text-[11px]"
          style={{ borderColor: 'var(--red)', color: 'var(--red)', backgroundColor: 'var(--red-dim)', ...MONO }}
        >
          Failed to load comparison data. Check the tickers and try again.
        </motion.div>
      )}

      {/* Empty / no results */}
      {!isLoading && !isFetching && hasData && data.every((r) => r.mention_count === 0) && (
        <motion.div
          variants={staggerItem}
          className="border rounded p-6 text-center text-[12px]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
        >
          No mentions found for the selected tickers in the last 7 days.
        </motion.div>
      )}

      {/* Cards grid */}
      {hasData && (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className={`grid gap-4 ${data.length === 1 ? 'grid-cols-1 max-w-sm' : data.length === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'}`}
        >
          {data.map((result, i) => (
            <StockCard key={result.ticker} result={result} rank={i + 1} />
          ))}
        </motion.div>
      )}

      {/* Charts */}
      {hasData && data.length > 1 && (
        <motion.div
          variants={staggerContainer}
          initial="initial"
          animate="animate"
          className="grid gap-6 grid-cols-1 lg:grid-cols-2"
        >
          {/* Sentiment chart */}
          <motion.div
            variants={staggerItem}
            className="border rounded p-5 space-y-4"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            <div>
              <span
                className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: 'var(--text-muted)', ...MONO }}
              >
                Avg Sentiment Score (7d)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={sentimentChartData} barSize={36} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="ticker"
                  tick={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => v.toFixed(2)}
                />
                <Tooltip content={<SentimentChartTooltip />} cursor={{ fill: 'var(--bg-elevated)' }} />
                <Bar dataKey="score" radius={[3, 3, 0, 0]}>
                  {sentimentChartData.map((entry) => (
                    <Cell
                      key={entry.ticker}
                      fill={sentimentColor(entry.score)}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Mention count chart */}
          <motion.div
            variants={staggerItem}
            className="border rounded p-5 space-y-4"
            style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
          >
            <div>
              <span
                className="text-[9px] font-black uppercase tracking-widest"
                style={{ color: 'var(--text-muted)', ...MONO }}
              >
                Mention Count (7d)
              </span>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={mentionChartData} barSize={36} margin={{ top: 4, right: 4, left: -16, bottom: 0 }}>
                <XAxis
                  dataKey="ticker"
                  tick={{ fontSize: 10, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fontFamily: "'JetBrains Mono', monospace", fill: 'var(--text-muted)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--bg-elevated)' }} />
                <Bar dataKey="mentions" radius={[3, 3, 0, 0]}>
                  {mentionChartData.map((entry) => (
                    <Cell
                      key={entry.ticker}
                      fill="var(--accent)"
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </motion.div>
      )}

      {/* Prompt when nothing searched yet */}
      {tickers.length === 0 && (
        <motion.div
          variants={staggerItem}
          className="flex flex-col items-center justify-center py-24 text-center"
        >
          <div className="text-4xl mb-4">⚡</div>
          <p className="text-[13px] font-bold tracking-widest uppercase mb-2" style={{ color: 'var(--text-primary)', ...MONO }}>
            Compare Stocks
          </p>
          <p className="text-[12px] max-w-xs" style={{ color: 'var(--text-muted)', ...MONO }}>
            Enter 2–3 tickers above separated by commas.<br />
            e.g. <span style={{ color: 'var(--accent)' }}>AAPL, MSFT, GOOGL</span>
          </p>
        </motion.div>
      )}
    </motion.div>
  );
}
