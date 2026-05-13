import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { X, Plus, Globe, Lock, Pencil, Trash2, Check, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getWatchlistLists, createWatchlistList, updateWatchlistList,
  deleteWatchlistList, addToList, removeFromList,
  type WatchlistList, type WatchlistItem,
} from '../api/watchlist';
import { getStockDetail, searchStocks, type SearchResult } from '../api/stocks';
import { useAuth } from '../store/useAuth';
import { staggerContainer, staggerItem } from '../components/PageEnter';

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

// ── Pixel art helpers ─────────────────────────────────────────────────────────

/** Renders a pixel-art sprite from a string array.
 *  Each char: A = accent, W = white, K = dark, R = red, . = transparent */
function PixelSprite({ rows, scale = 4 }: { rows: string[]; scale?: number }) {
  const palette: Record<string, string> = {
    A: 'var(--accent)',
    W: '#f0f0f0',
    K: '#1a1a1a',
    R: 'var(--red)',
    G: '#888',
    Y: '#eab308',
    B: '#3b82f6',
  };
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${rows[0].length}, ${scale}px)`,
        imageRendering: 'pixelated',
        gap: 0,
      }}
    >
      {rows.map((row, y) =>
        row.split('').map((ch, x) => (
          <div
            key={`${y}-${x}`}
            style={{
              width: scale,
              height: scale,
              backgroundColor: palette[ch] ?? 'transparent',
            }}
          />
        ))
      )}
    </div>
  );
}

// Rocket sprite (11 wide × 16 tall)
const ROCKET_PIXELS = [
  '....A......',
  '...AAA.....',
  '...AAA.....',
  '..AAAAA....',
  '..AWAWA....',
  '..AAAAA....',
  '..AAAAA....',
  '.AAAAAAA...',
  '.AWWWWWA...',
  '.AWWWWWA...',
  '..AAAAA....',
  '.AA.AAA.A..',
  'AA..YYY..AA',
  'A...YYY...A',
  '....YYY....',
  '....YY.....',
];

// Sad chart ghost (13 wide × 14 tall)
const GHOST_PIXELS = [
  '....AAAAA....',
  '...AAAAAAA...',
  '..AWAW.WAWA..',
  '..AAAAAAAAAA.',
  '..AAAAAAAAAA.',
  '..AAAAAAAAAA.',
  '...AAAAAAAAA.',
  '...AA.AA.AAA.',
  '....A...A....',
  '..GGGGGGGGG..',
  '.GA.......AG.',
  '.GA..GGGGGAG.',
  '.GAGGGG....G.',
  '.GGGGGGGGGGG.',
];

// ── Empty state: no lists at all ──────────────────────────────────────────────

function EmptyWatchlists({
  creating,
  newListName,
  setNewListName,
  onSubmit,
}: {
  creating: boolean;
  newListName: string;
  setNewListName: (v: string) => void;
  onSubmit: () => void;
}) {
  const messages = [
    'NO POSITIONS DETECTED',
    'PORTFOLIO: VOID',
    'ALLOCATION: NULL',
    'GAINZ: UNDEFINED',
  ];
  const [msgIdx, setMsgIdx] = useState(0);
  const [showForm, setShowForm] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setMsgIdx(i => (i + 1) % messages.length), 1400);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  function handleCreate() {
    if (!showForm) { setShowForm(true); setTimeout(() => inputRef.current?.focus(), 50); return; }
    if (newListName.trim()) onSubmit();
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className="flex flex-col items-center py-20 space-y-8"
    >
      {/* Animated rocket */}
      <motion.div
        animate={{ y: [-8, 8, -8] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        <PixelSprite rows={ROCKET_PIXELS} scale={5} />
      </motion.div>

      {/* Retro terminal box */}
      <div
        className="border-2 px-8 py-6 text-center space-y-3 max-w-sm w-full"
        style={{ borderColor: 'var(--accent)', backgroundColor: 'var(--bg-surface)' }}
      >
        {/* Scanline title */}
        <div className="flex items-center gap-2 justify-center">
          <span style={{ color: 'var(--accent)', ...MONO }} className="text-[9px] font-black">▶</span>
          <span style={{ color: 'var(--accent)', ...MONO }} className="text-[10px] font-black uppercase tracking-widest">
            WATCHLIST.EXE
          </span>
        </div>

        <div className="border-t" style={{ borderColor: 'var(--border)' }} />

        {/* Cycling status message */}
        <AnimatePresence mode="wait">
          <motion.p
            key={msgIdx}
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="text-[11px] font-black"
            style={{ color: 'var(--text-muted)', ...MONO }}
          >
            {messages[msgIdx]}
            <BlinkCursor />
          </motion.p>
        </AnimatePresence>

        <p className="text-xs leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          You have zero watchlists. That's fine.
          <br />
          Even Warren Buffett started somewhere.
        </p>

        {/* Inline name input — appears once user clicks create */}
        <AnimatePresence>
          {showForm && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden"
            >
              <input
                ref={inputRef}
                type="text"
                value={newListName}
                onChange={e => setNewListName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newListName.trim()) onSubmit();
                  if (e.key === 'Escape') { setShowForm(false); setNewListName(''); }
                }}
                placeholder="e.g. Tech Growth, Dividend…"
                maxLength={100}
                className="w-full border px-3 py-2 text-xs bg-transparent outline-none transition-colors focus:border-[var(--accent)] text-center"
                style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={handleCreate}
          disabled={creating || (showForm && !newListName.trim())}
          className="w-full py-2.5 text-[10px] font-black uppercase tracking-widest transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
        >
          {creating ? '[ CREATING… ]' : showForm ? '[ LAUNCH IT ]' : '[ + CREATE FIRST LIST ]'}
        </button>
      </div>

      {/* Pixel stars */}
      <PixelStars />
    </motion.div>
  );
}

// ── Empty state: list exists but has no stocks ────────────────────────────────

function EmptyList({ listName }: { listName: string }) {
  return (
    <motion.div
      key={listName}
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
      className="flex flex-col items-center py-16 space-y-6"
    >
      {/* Ghost */}
      <motion.div
        animate={{ y: [-5, 5, -5], rotate: [-2, 2, -2] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <PixelSprite rows={GHOST_PIXELS} scale={4} />
      </motion.div>

      <div className="text-center space-y-2 max-w-xs">
        <p className="text-xs font-black uppercase tracking-widest"
           style={{ color: 'var(--accent)', ...MONO }}>
          ▸ {listName} <BlinkCursor />
        </p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)', ...MONO }}>
          THIS LIST IS EMPTIER THAN
        </p>
        <p className="text-[11px]" style={{ color: 'var(--text-muted)', ...MONO }}>
          A MEME STOCK AFTER EARNINGS
        </p>
        <p className="text-[10px] mt-3" style={{ color: 'var(--text-muted)' }}>
          Search for a stock above and add it to your list.
        </p>
      </div>

      {/* Tiny flatline chart */}
      <FlatlineChart />
    </motion.div>
  );
}

// ── Decorative helpers ────────────────────────────────────────────────────────

function BlinkCursor() {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setInterval(() => setVisible(v => !v), 530);
    return () => clearInterval(t);
  }, []);
  return (
    <span style={{ opacity: visible ? 1 : 0, color: 'var(--accent)', ...MONO }}>█</span>
  );
}

function PixelStars() {
  const stars = Array.from({ length: 12 }, (_, i) => ({
    x: (i * 73 + 11) % 100,
    y: (i * 47 + 5) % 40,
    delay: i * 0.3,
    size: i % 3 === 0 ? 4 : 2,
  }));
  return (
    <div className="relative w-64 h-10 opacity-50">
      {stars.map((s, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: `${s.x}%`,
            top: `${s.y * 2.5}%`,
            width: s.size,
            height: s.size,
            backgroundColor: 'var(--accent)',
          }}
          animate={{ opacity: [0.2, 1, 0.2] }}
          transition={{ duration: 1.5 + (i % 4) * 0.4, repeat: Infinity, delay: s.delay }}
        />
      ))}
    </div>
  );
}

function FlatlineChart() {
  return (
    <div className="flex items-end gap-px opacity-60">
      {[8, 14, 10, 16, 13, 11, 15, 9, 12, 4, 2, 2, 2, 2, 2, 2, 2, 2].map((h, i) => (
        <motion.div
          key={i}
          style={{ width: 6, backgroundColor: i >= 10 ? 'var(--red)' : 'var(--accent)' }}
          initial={{ height: 0 }}
          animate={{ height: h * 2 }}
          transition={{ duration: 0.4, delay: i * 0.04, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
        />
      ))}
    </div>
  );
}

// ── Stock card inside a named list ────────────────────────────────────────────

function StockCard({ item, listId }: { item: WatchlistItem; listId: number }) {
  const qc = useQueryClient();
  const { data: detail } = useQuery({
    queryKey: ['stock', item.ticker],
    queryFn: () => getStockDetail(item.ticker),
    staleTime: 60_000,
  });

  const { mutate: remove, isPending } = useMutation({
    mutationFn: () => removeFromList(listId, item.ticker),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist-lists'] }),
  });

  const up = (detail?.change_pct ?? 0) >= 0;

  return (
    <motion.div
      layout
      variants={staggerItem}
      exit={{ opacity: 0, scale: 0.95 }}
      whileHover={{ y: -3, transition: { duration: 0.12 } }}
      whileTap={{ scale: 0.98 }}
      className="border p-4 group relative"
      style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-surface)' }}
    >
      <button
        onClick={() => remove()}
        disabled={isPending}
        className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:text-[var(--red)]"
        style={{ color: 'var(--text-muted)' }}
        title="Remove from list"
      >
        <X className="h-3.5 w-3.5" />
      </button>

      <Link to={`/app/stock/${item.ticker}`} className="block">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-sm font-black" style={{ color: 'var(--text-primary)', ...MONO }}>
            {item.ticker}
          </span>
          {detail?.name && (
            <span className="text-[10px] truncate" style={{ color: 'var(--text-muted)', ...MONO }}>
              {detail.name}
            </span>
          )}
        </div>

        <div className="flex items-end justify-between">
          <span className="text-xl font-black tabular-nums" style={{ color: 'var(--text-primary)', ...MONO }}>
            {detail?.price != null ? `$${detail.price.toFixed(2)}` : '—'}
          </span>
          {detail?.change_pct != null && (
            <span className="text-[11px] font-bold tabular-nums"
              style={{ color: up ? 'var(--green)' : 'var(--red)', ...MONO }}>
              {up ? '▲' : '▼'} {Math.abs(detail.change_pct).toFixed(2)}%
            </span>
          )}
        </div>

        {detail?.sentiment?.overall != null && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>Sentiment</span>
              <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
                {Math.round(detail.sentiment.overall * 100)}
              </span>
            </div>
            <div className="h-[3px] rounded-full overflow-hidden" style={{ backgroundColor: 'var(--bg-elevated)' }}>
              <motion.div
                className="h-full rounded-full"
                style={{
                  backgroundColor: detail.sentiment.overall >= 0.6
                    ? 'var(--accent)'
                    : detail.sentiment.overall >= 0.4 ? '#d97706' : 'var(--red)',
                }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(detail.sentiment.overall * 100)}%` }}
                transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
              />
            </div>
          </div>
        )}
      </Link>
    </motion.div>
  );
}

// ── Stock search + add ────────────────────────────────────────────────────────

function AddStockSearch({ listId }: { listId: number }) {
  const [query, setQuery]   = useState('');
  const [open, setOpen]     = useState(false);
  const [debQ, setDebQ]     = useState('');
  const [errMsg, setErrMsg] = useState('');
  const containerRef        = useRef<HTMLDivElement>(null);
  const qc                  = useQueryClient();

  // 300 ms debounce
  useEffect(() => {
    const t = setTimeout(() => setDebQ(query.trim().toUpperCase()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const { data: suggestions, isLoading: searching } = useQuery({
    queryKey: ['search', debQ],
    queryFn: () => searchStocks(debQ),
    enabled: debQ.length >= 1,
    staleTime: 30_000,
  });

  const { mutate: add, isPending } = useMutation({
    mutationFn: (ticker: string) => addToList(listId, ticker),
    onSuccess: () => {
      setQuery('');
      setOpen(false);
      setErrMsg('');
      qc.invalidateQueries({ queryKey: ['watchlist-lists'] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Already in list';
      setErrMsg(msg);
      setTimeout(() => setErrMsg(''), 2500);
    },
  });

  const hasSuggestions = (suggestions?.length ?? 0) > 0;
  const noResults = !searching && debQ.length >= 1 && suggestions?.length === 0;
  const showDropdown = open && debQ.length >= 1;

  return (
    <div ref={containerRef} className="relative">
      <div
        className="flex items-center gap-2 border px-3 py-2 transition-colors focus-within:border-[var(--accent)]"
        style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
      >
        <motion.div
          animate={searching ? { rotate: 360 } : { rotate: 0 }}
          transition={searching ? { duration: 1, repeat: Infinity, ease: 'linear' } : {}}
        >
          <Search className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
        </motion.div>
        <input
          type="text"
          value={query}
          onChange={e => { setQuery(e.target.value); setOpen(true); setErrMsg(''); }}
          onFocus={() => setOpen(true)}
          onKeyDown={e => {
            if (e.key === 'Enter' && debQ && suggestions?.[0]) add(suggestions[0].symbol);
            if (e.key === 'Escape') setOpen(false);
          }}
          placeholder="Search and add stock (e.g. Apple, NVDA…)"
          className="flex-1 bg-transparent text-sm outline-none"
          style={{ color: 'var(--text-primary)', ...MONO }}
          autoComplete="off"
        />
        {errMsg && (
          <span className="text-[9px] font-bold shrink-0" style={{ color: 'var(--red)', ...MONO }}>
            {errMsg}
          </span>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 right-0 top-full z-50 mt-0.5 border shadow-xl overflow-hidden max-h-64 overflow-y-auto"
            style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
          >
            {hasSuggestions && suggestions!.map((s: SearchResult, i) => (
              <motion.button
                key={s.symbol}
                initial={{ opacity: 0, x: -4 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.025 }}
                onClick={() => add(s.symbol)}
                disabled={isPending}
                className="flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors hover:bg-[var(--bg-elevated)] disabled:opacity-50"
              >
                <span className="font-black text-sm w-14 shrink-0"
                      style={{ color: 'var(--accent)', ...MONO }}>
                  {s.symbol}
                </span>
                {s.name && (
                  <span className="truncate text-xs flex-1" style={{ color: 'var(--text-muted)' }}>
                    {s.name}
                  </span>
                )}
                <Plus className="h-3.5 w-3.5 shrink-0" style={{ color: 'var(--text-muted)' }} />
              </motion.button>
            ))}
            {noResults && (
              <div className="px-4 py-3 text-xs text-center" style={{ color: 'var(--text-muted)', ...MONO }}>
                No results for "{debQ}"
              </div>
            )}
            {searching && !hasSuggestions && (
              <div className="px-4 py-3 text-xs text-center animate-pulse"
                   style={{ color: 'var(--text-muted)', ...MONO }}>
                Searching…
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── List tab (sidebar item) ───────────────────────────────────────────────────

function ListTab({
  wl, active, onSelect, onRename, onDelete, onTogglePublic,
}: {
  wl: WatchlistList;
  active: boolean;
  onSelect: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
  onTogglePublic: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(wl.name);

  // Keep draft in sync if name changes externally (e.g. after a rename refetch)
  useEffect(() => {
    if (!editing) setDraft(wl.name);
  }, [wl.name, editing]);

  function commitRename() {
    const trimmed = draft.trim();
    if (trimmed && trimmed !== wl.name) onRename(trimmed);
    setEditing(false);
  }

  function startEditing(e: React.MouseEvent) {
    e.stopPropagation();
    setDraft(wl.name);   // always start from the latest server name
    setEditing(true);
  }

  return (
    <div
      className="flex items-center gap-2 px-3 py-2 cursor-pointer group border-b transition-colors"
      style={{
        borderColor: 'var(--border)',
        backgroundColor: active ? 'var(--bg-elevated)' : 'transparent',
        borderLeft: active ? '2px solid var(--accent)' : '2px solid transparent',
      }}
      onClick={onSelect}
    >
      {editing ? (
        <input
          autoFocus
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditing(false); }}
          className="flex-1 bg-transparent text-xs outline-none border-b"
          style={{ borderColor: 'var(--accent)', color: 'var(--text-primary)', ...MONO }}
          onClick={e => e.stopPropagation()}
        />
      ) : (
        <span className="flex-1 text-xs font-bold truncate" style={{ color: active ? 'var(--text-primary)' : 'var(--text-muted)', ...MONO }}>
          {wl.name}
        </span>
      )}

      <span className="text-[9px] shrink-0" style={{ color: 'var(--text-muted)', ...MONO }}>
        {wl.items.length}
      </span>

      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
           onClick={e => e.stopPropagation()}>
        <button
          onClick={onTogglePublic}
          title={wl.is_public ? 'Make private' : 'Make public'}
          className="p-1 transition-colors hover:text-[var(--accent)]"
          style={{ color: 'var(--text-muted)' }}
        >
          {wl.is_public ? <Globe className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
        </button>
        <button
          onClick={startEditing}
          className="p-1 transition-colors hover:text-[var(--accent)]"
          style={{ color: 'var(--text-muted)' }}
          title="Rename"
        >
          <Pencil className="h-3 w-3" />
        </button>
        <button
          onClick={onDelete}
          className="p-1 transition-colors hover:text-[var(--red)]"
          style={{ color: 'var(--text-muted)' }}
          title="Delete list"
        >
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    </div>
  );
}

// ── Main Watchlists page ──────────────────────────────────────────────────────

export function Watchlists() {
  const { isLoggedIn, email } = useAuth();
  const qc = useQueryClient();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [newListName, setNewListName] = useState('');
  const [showSidebarCreate, setShowSidebarCreate] = useState(false);
  const sidebarInputRef = useRef<HTMLInputElement>(null);

  const { data: lists, isLoading, isError, refetch } = useQuery({
    queryKey: ['watchlist-lists'],
    queryFn: getWatchlistLists,
    enabled: isLoggedIn(),
    retry: 1,
  });

  // Auto-select first list when data loads or activeId is stale
  const effectiveActiveId = activeId ?? lists?.[0]?.id ?? null;
  const activeList = lists?.find(wl => wl.id === effectiveActiveId) ?? null;

  const { mutate: createList, isPending: creating } = useMutation({
    mutationFn: () => createWatchlistList(newListName.trim()),
    onSuccess: (created) => {
      // Optimistically add to cache so activeList resolves immediately
      qc.setQueryData<WatchlistList[]>(['watchlist-lists'], (old = []) => [
        ...old,
        { ...created, items: [] },
      ]);
      setNewListName('');
      setShowSidebarCreate(false);
      setActiveId(created.id);
      // Then sync with server
      qc.invalidateQueries({ queryKey: ['watchlist-lists'] });
    },
  });

  const { mutate: renameList } = useMutation({
    mutationFn: ({ id, name }: { id: number; name: string }) => updateWatchlistList(id, { name }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist-lists'] }),
  });

  const { mutate: togglePublic } = useMutation({
    mutationFn: ({ id, is_public }: { id: number; is_public: boolean }) =>
      updateWatchlistList(id, { is_public }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['watchlist-lists'] }),
  });

  const { mutate: deleteList } = useMutation({
    mutationFn: (id: number) => deleteWatchlistList(id),
    onSuccess: (_, deletedId) => {
      if (effectiveActiveId === deletedId) setActiveId(null);
      qc.invalidateQueries({ queryKey: ['watchlist-lists'] });
    },
  });

  function openSidebarCreate() {
    setShowSidebarCreate(true);
    setTimeout(() => sidebarInputRef.current?.focus(), 50);
  }

  function cancelSidebarCreate() {
    setShowSidebarCreate(false);
    setNewListName('');
  }

  if (!isLoggedIn()) {
    return (
      <div className="py-20 text-center">
        <p className="text-[10px] font-black uppercase tracking-widest mb-6"
          style={{ color: 'var(--text-muted)', ...MONO }}>
          Sign in to use watchlists
        </p>
        <Link
          to="/auth"
          className="inline-flex items-center gap-2 px-6 py-3 text-[10px] font-black uppercase tracking-widest transition-colors"
          style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
        >
          <Plus className="h-3 w-3" />
          Create Account / Sign In
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] as [number, number, number, number] }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 pb-3 mb-6"
           style={{ borderColor: 'var(--text-primary)' }}>
        <div>
          <h1 className="text-[10px] font-black uppercase tracking-widest"
              style={{ color: 'var(--text-primary)', ...MONO }}>
            Watchlists
          </h1>
          <p className="text-[9px] mt-0.5" style={{ color: 'var(--text-muted)', ...MONO }}>
            {email}
          </p>
        </div>
        {/* Only show header button when lists already exist (sidebar has its own create row) */}
        {lists && lists.length > 0 && (
          <button
            onClick={openSidebarCreate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest transition-colors"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
          >
            <Plus className="h-3 w-3" />
            New List
          </button>
        )}
      </div>

      {isLoading && (
        <div className="flex gap-6">
          <div className="w-52 space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-10 animate-pulse rounded"
                   style={{ backgroundColor: 'var(--bg-surface)' }} />
            ))}
          </div>
          <div className="flex-1 grid grid-cols-2 sm:grid-cols-3 gap-4">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="h-32 animate-pulse rounded"
                   style={{ backgroundColor: 'var(--bg-surface)' }} />
            ))}
          </div>
        </div>
      )}

      {isError && (
        <div className="py-16 text-center space-y-4">
          <p className="text-[10px] font-black uppercase tracking-widest"
             style={{ color: 'var(--red)', ...MONO }}>
            Failed to load watchlists
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            The server may still be starting up. Try again in a moment.
          </p>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 text-[10px] font-black uppercase tracking-widest border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
          >
            Retry
          </button>
        </div>
      )}

      {!isLoading && !isError && lists && lists.length === 0 && (
        <EmptyWatchlists
          creating={creating}
          newListName={newListName}
          setNewListName={setNewListName}
          onSubmit={() => { if (newListName.trim()) createList(); }}
        />
      )}

      {!isLoading && !isError && lists && lists.length > 0 && (
        <div className="flex gap-6">
          {/* Sidebar: list tabs + inline create row */}
          <div className="w-52 shrink-0 border self-start" style={{ borderColor: 'var(--border)' }}>
            {lists.map(wl => (
              <ListTab
                key={wl.id}
                wl={wl}
                active={wl.id === effectiveActiveId}
                onSelect={() => setActiveId(wl.id)}
                onRename={name => renameList({ id: wl.id, name })}
                onDelete={() => deleteList(wl.id)}
                onTogglePublic={() => togglePublic({ id: wl.id, is_public: !wl.is_public })}
              />
            ))}

            {/* Inline create row — lives at the bottom of the sidebar */}
            <AnimatePresence>
              {showSidebarCreate ? (
                <motion.div
                  key="create-input"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.15 }}
                  className="overflow-hidden border-t"
                  style={{ borderColor: 'var(--border)' }}
                >
                  <div className="px-2 py-2 space-y-1.5">
                    <input
                      ref={sidebarInputRef}
                      type="text"
                      value={newListName}
                      onChange={e => setNewListName(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' && newListName.trim()) createList();
                        if (e.key === 'Escape') cancelSidebarCreate();
                      }}
                      placeholder="List name…"
                      maxLength={100}
                      className="w-full border px-2 py-1.5 text-xs bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => newListName.trim() && createList()}
                        disabled={creating || !newListName.trim()}
                        className="flex-1 flex items-center justify-center gap-1 py-1 text-[9px] font-black uppercase tracking-widest transition-colors disabled:opacity-40"
                        style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
                      >
                        <Check className="h-3 w-3" />
                        {creating ? 'Creating…' : 'Create'}
                      </button>
                      <button
                        onClick={cancelSidebarCreate}
                        className="px-2 py-1 border transition-colors hover:border-[var(--red)] hover:text-[var(--red)]"
                        style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ) : (
                <motion.button
                  key="create-btn"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  onClick={openSidebarCreate}
                  className="w-full flex items-center gap-2 px-3 py-2 text-[10px] font-bold border-t transition-colors hover:text-[var(--accent)] hover:bg-[var(--bg-elevated)]"
                  style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
                >
                  <Plus className="h-3 w-3" />
                  New list
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          {/* Main area: selected list content */}
          <div className="flex-1 min-w-0 space-y-5">
            {activeList && (
              <>
                {/* List meta */}
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-black" style={{ color: 'var(--text-primary)', ...MONO }}>
                    {activeList.name}
                  </h2>
                  <span className="text-[9px] px-1.5 py-0.5 border"
                    style={{
                      borderColor: activeList.is_public ? 'var(--accent)' : 'var(--border)',
                      color: activeList.is_public ? 'var(--accent)' : 'var(--text-muted)',
                      ...MONO,
                    }}>
                    {activeList.is_public ? 'Public' : 'Private'}
                  </span>
                  <span className="text-[9px]" style={{ color: 'var(--text-muted)', ...MONO }}>
                    {activeList.items.length} stocks
                  </span>
                </div>

                <AddStockSearch listId={activeList.id} />

                {activeList.items.length === 0 ? (
                  <EmptyList listName={activeList.name} />
                ) : (
                  <motion.div
                    className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="show"
                    key={activeList.id}
                  >
                    <AnimatePresence>
                      {activeList.items.map(item => (
                        <StockCard key={item.ticker} item={item} listId={activeList.id} />
                      ))}
                    </AnimatePresence>
                  </motion.div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </motion.div>
  );
}
