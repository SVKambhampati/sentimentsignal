import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '../store/useToast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Check, Eye, EyeOff, AlignCenter, AlignJustify, Sun, Moon, Camera, Trash2, Bell, Shield, Users } from 'lucide-react';
import { getMe, updateProfile, adminListUsers, adminDeleteUser, type AdminUser } from '../api/auth';
import { useAuth } from '../store/useAuth';
import { getFollowers, getFollowing } from '../api/users';
import { usePreferences, applyPreferences } from '../store/usePreferences';
import { useTheme } from '../store/useTheme';
import { staggerContainer, staggerItem } from '../components/PageEnter';
import { Avatar } from '../components/Avatar';

/** Resize an image file to a square base64 JPEG (max 128×128) */
async function resizeToBase64(file: File, maxSize = 128): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const size = Math.min(img.width, img.height, maxSize);
      const canvas = document.createElement('canvas');
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d')!;
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.src = url;
  });
}

const MONO: React.CSSProperties = { fontFamily: '"IBM Plex Mono", monospace' };

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <motion.div variants={staggerItem} className="border-b pb-8" style={{ borderColor: 'var(--border)' }}>
      <h2 className="text-[9px] font-black uppercase tracking-widest mb-5" style={{ color: 'var(--text-muted)', ...MONO }}>
        {title}
      </h2>
      {children}
    </motion.div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between py-2.5 border-b" style={{ borderColor: 'var(--border)' }}>
      <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>{label}</span>
      <span className="text-sm" style={{ color: 'var(--text-primary)', ...MONO }}>{value}</span>
    </div>
  );
}

const ACCENT_PRESETS = [
  { label: 'Cyan',    value: '#22d3ee' },
  { label: 'Blue',    value: '#3b82f6' },
  { label: 'Purple',  value: '#a855f7' },
  { label: 'Orange',  value: '#f97316' },
  { label: 'Rose',    value: '#f43f5e' },
  { label: 'Green',   value: '#22c55e' },
  { label: 'Yellow',  value: '#eab308' },
  { label: 'White',   value: '#f0f0f0' },
];

const TIMEFRAMES = ['1D', '1W', '1M', '3M', '1Y'] as const;

const SECTIONS = [
  { key: 'tickertape', label: 'Ticker Tape' },
  { key: 'movers',     label: 'Top Movers'  },
  { key: 'mostactive', label: 'Most Active' },
  { key: 'trending',   label: 'Trending'    },
] as const;

export function Profile() {
  const navigate    = useNavigate();
  const { email, username: storedUsername, first_name: storedFirstName, last_name: storedLastName,
          bio: storedBio, avatar_url: storedAvatar, is_admin: isAdmin, setProfile, logout, isLoggedIn } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const prefs       = usePreferences();
  const qc          = useQueryClient();
  const { theme, toggleTheme } = useTheme();

  const loggedIn = isLoggedIn();
  const { toast } = useToast();

  useEffect(() => {
    if (!loggedIn) navigate('/auth');
  }, [loggedIn, navigate]);

  const { data: me } = useQuery({
    queryKey: ['me'],
    queryFn: getMe,
    enabled: loggedIn,
  });

  const { data: adminUsers, isLoading: adminUsersLoading } = useQuery<AdminUser[]>({
    queryKey: ['admin-users'],
    queryFn: adminListUsers,
    enabled: loggedIn && isAdmin,
    staleTime: 30_000,
  });

  const { mutate: deleteUser } = useMutation({
    mutationFn: (uid: number) => adminDeleteUser(uid),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-users'] });
      toast('User deleted', 'success');
    },
    onError: () => toast('Failed to delete user', 'error'),
  });

  const myId = me?.id ?? null;

  const { data: myFollowers } = useQuery({
    queryKey: ['followers', myId],
    queryFn: () => getFollowers(myId!),
    enabled: !!myId,
  });

  const { data: myFollowing } = useQuery({
    queryKey: ['following', myId],
    queryFn: () => getFollowing(myId!),
    enabled: !!myId,
  });

  // Hydrate store AND local form state from server on first load
  // (catches names/bio/avatar set via other devices or sessions)
  useEffect(() => {
    if (me) {
      setProfile({
        username:   me.username,
        first_name: me.first_name,
        last_name:  me.last_name,
        bio:        me.bio,
        avatar_url: me.avatar_url,
      });
      // Sync form inputs so they show the server-authoritative values
      setFirstName(me.first_name ?? '');
      setLastName(me.last_name ?? '');
      setBio(me.bio ?? '');
    }
  }, [me]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Profile info form ────────────────────────────────────────────────────
  const [firstName, setFirstName] = useState(storedFirstName ?? '');
  const [lastName,  setLastName]  = useState(storedLastName ?? '');
  const [bio,       setBio]       = useState(storedBio ?? '');
  const [infoMsg,   setInfoMsg]   = useState('');

  const { mutate: saveInfo, isPending: savingInfo } = useMutation({
    mutationFn: () => updateProfile({ first_name: firstName.trim(), last_name: lastName.trim(), bio: bio.trim() }),
    onSuccess: (data) => {
      setProfile({ first_name: data.first_name, last_name: data.last_name, bio: data.bio });
      qc.invalidateQueries({ queryKey: ['me'] });
      setInfoMsg('Profile updated!');
      setTimeout(() => setInfoMsg(''), 3000);
      toast('Profile updated!', 'success');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to update';
      setInfoMsg(msg);
      toast(msg, 'error');
    },
  });

  // ── Avatar upload ────────────────────────────────────────────────────────
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError, setAvatarError]         = useState('');

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarUploading(true);
    setAvatarError('');
    try {
      const base64 = await resizeToBase64(file);
      const data = await updateProfile({ avatar_url: base64 });
      setProfile({ avatar_url: data.avatar_url });
      toast('Photo updated!', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to upload photo.';
      setAvatarError(msg);
      toast(msg, 'error');
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function removeAvatar() {
    setAvatarUploading(true);
    setAvatarError('');
    try {
      const data = await updateProfile({ avatar_url: null });
      setProfile({ avatar_url: data.avatar_url });
      toast('Photo removed', 'success');
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
        ?? 'Failed to remove photo.';
      setAvatarError(msg);
      toast(msg, 'error');
    } finally {
      setAvatarUploading(false);
    }
  }

  // ── Username form ────────────────────────────────────────────────────────
  const [newUsername, setNewUsername] = useState('');
  const [usernameMsg, setUsernameMsg] = useState('');

  const { mutate: saveUsername, isPending: savingUsername } = useMutation({
    mutationFn: () => updateProfile({ username: newUsername.trim() }),
    onSuccess: (data) => {
      setProfile({ username: data.username });
      qc.invalidateQueries({ queryKey: ['me'] });
      setNewUsername('');
      setUsernameMsg('Username updated!');
      setTimeout(() => setUsernameMsg(''), 3000);
      toast('Username updated!', 'success');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to update';
      setUsernameMsg(msg);
      toast(msg, 'error');
    },
  });

  // ── Password form ────────────────────────────────────────────────────────
  const [currentPw, setCurrentPw]   = useState('');
  const [newPw,     setNewPw]       = useState('');
  const [pwMsg,     setPwMsg]       = useState('');

  const { mutate: savePassword, isPending: savingPassword } = useMutation({
    mutationFn: () => updateProfile({ current_password: currentPw, new_password: newPw }),
    onSuccess: () => {
      setCurrentPw(''); setNewPw('');
      setPwMsg('Password updated!');
      setTimeout(() => setPwMsg(''), 3000);
      toast('Password updated!', 'success');
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Failed to update';
      setPwMsg(msg);
      toast(msg, 'error');
    },
  });

  // ── Preferences helpers ──────────────────────────────────────────────────
  const [customColor, setCustomColor] = useState(prefs.accent_color);

  async function setPref(patch: Parameters<typeof prefs.set>[0]) {
    await prefs.set(patch);
    applyPreferences({ ...prefs, ...patch });
  }

  function toggleSection(key: string) {
    const next = prefs.hidden_sections.includes(key)
      ? prefs.hidden_sections.filter(s => s !== key)
      : [...prefs.hidden_sections, key];
    setPref({ hidden_sections: next });
  }

  if (!loggedIn) return null;

  const displayName = storedUsername ?? me?.username ?? '—';
  const memberSince = me?.created_at
    ? new Date(me.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
    : '—';

  return (
    <motion.div
      className="max-w-lg mx-auto space-y-8 py-4"
      variants={staggerContainer}
      initial="hidden"
      animate="show"
    >
      {/* Page header */}
      <motion.div variants={staggerItem} className="border-b-2 pb-3" style={{ borderColor: 'var(--text-primary)' }}>
        <h1 className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)', ...MONO }}>
          Profile &amp; Settings
        </h1>
      </motion.div>

      {/* Avatar + name */}
      <motion.div variants={staggerItem} className="flex items-center gap-5">
        {/* Avatar with upload overlay */}
        <div className="relative group shrink-0">
          <Avatar
            name={storedUsername ?? me?.username ?? email?.split('@')[0] ?? '?'}
            avatarUrl={storedAvatar}
            size={64}
          />
          {/* Hidden file input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFile}
          />
          {/* Upload overlay on hover */}
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={avatarUploading}
            className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
            style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            title="Change photo"
          >
            <Camera className="h-5 w-5 text-white" />
          </button>
        </div>

        <div>
          {(storedFirstName || storedLastName) && (
            <p className="text-lg font-black" style={{ color: 'var(--text-primary)', ...MONO }}>
              {[storedFirstName, storedLastName].filter(Boolean).join(' ')}
            </p>
          )}
          <p className={storedFirstName ? 'text-xs' : 'text-lg font-black'}
             style={{ color: storedFirstName ? 'var(--text-muted)' : 'var(--text-primary)', ...MONO }}>
            @{storedUsername ?? me?.username ?? '—'}
          </p>
          <p className="text-[10px] mt-0.5" style={{ color: 'var(--text-muted)', ...MONO }}>
            {myFollowers?.length ?? 0} followers · {myFollowing?.length ?? 0} following
          </p>
          {avatarError && (
            <p className="text-[10px] mt-0.5 uppercase tracking-widest" style={{ color: 'var(--red)', ...MONO }}>
              {avatarError}
            </p>
          )}
          <div className="flex items-center gap-2 mt-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={avatarUploading}
              className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)] disabled:opacity-40"
              style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
            >
              {avatarUploading ? 'Uploading…' : 'Change Photo'}
            </button>
            {storedAvatar && (
              <button
                onClick={removeAvatar}
                disabled={avatarUploading}
                className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 border transition-colors hover:border-[var(--red)] hover:text-[var(--red)] disabled:opacity-40"
                style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
              >
                <Trash2 className="h-3 w-3" />
              </button>
            )}
          </div>
        </div>
      </motion.div>

      {/* ── Account info ─────────────────────────────────────────────────── */}
      <Section title="Account">
        <Field label="Email"        value={email ?? '—'} />
        <Field label="Username"     value={storedUsername ?? me?.username ?? 'Not set'} />
        <Field label="Member since" value={memberSince} />
      </Section>

      {/* ── Profile Info ─────────────────────────────────────────────────── */}
      <Section title="Profile Info">
        <div className="space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={firstName}
              onChange={e => setFirstName(e.target.value)}
              placeholder="First name"
              maxLength={100}
              className="flex-1 border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
            />
            <input
              type="text"
              value={lastName}
              onChange={e => setLastName(e.target.value)}
              placeholder="Last name"
              maxLength={100}
              className="flex-1 border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
              style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
            />
          </div>
          <textarea
            value={bio}
            onChange={e => setBio(e.target.value)}
            placeholder="Short bio — tell people who you are (max 500 chars)"
            maxLength={500}
            rows={3}
            className="w-full border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)] resize-none"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)' }}
          />
          <div className="flex items-center justify-between">
            {infoMsg && (
              <p className="text-[10px] uppercase tracking-widest"
                style={{ color: infoMsg === 'Profile updated!' ? 'var(--accent)' : 'var(--red)', ...MONO }}>
                {infoMsg}
              </p>
            )}
            <button
              onClick={() => saveInfo()}
              disabled={savingInfo}
              className="ml-auto px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-40"
              style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
            >
              {savingInfo ? 'Saving...' : 'Save Info'}
            </button>
          </div>
        </div>
      </Section>

      {/* ── Change username ───────────────────────────────────────────────── */}
      <Section title="Change Username">
        <div className="space-y-3">
          <input
            type="text"
            value={newUsername}
            onChange={e => setNewUsername(e.target.value)}
            placeholder="New username (min. 3 chars)"
            className="w-full border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }}
          />
          {usernameMsg && (
            <p className="text-[10px] uppercase tracking-widest"
              style={{ color: usernameMsg === 'Username updated!' ? 'var(--accent)' : 'var(--red)', ...MONO }}>
              {usernameMsg}
            </p>
          )}
          <button
            onClick={() => saveUsername()}
            disabled={savingUsername || newUsername.trim().length < 3}
            className="px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}
          >
            {savingUsername ? 'Saving...' : 'Save Username'}
          </button>
        </div>
      </Section>

      {/* ── Change password ───────────────────────────────────────────────── */}
      <Section title="Change Password">
        <div className="space-y-3">
          <input type="password" value={currentPw} onChange={e => setCurrentPw(e.target.value)}
            placeholder="Current password"
            className="w-full border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }} />
          <input type="password" value={newPw} onChange={e => setNewPw(e.target.value)}
            placeholder="New password (min. 8 chars)"
            className="w-full border px-3 py-2.5 text-sm bg-transparent outline-none transition-colors focus:border-[var(--accent)]"
            style={{ borderColor: 'var(--border)', color: 'var(--text-primary)', ...MONO }} />
          {pwMsg && (
            <p className="text-[10px] uppercase tracking-widest"
              style={{ color: pwMsg === 'Password updated!' ? 'var(--accent)' : 'var(--red)', ...MONO }}>
              {pwMsg}
            </p>
          )}
          <button onClick={() => savePassword()}
            disabled={savingPassword || !currentPw || newPw.length < 8}
            className="px-5 py-2 text-[10px] font-black uppercase tracking-widest transition-colors disabled:opacity-40"
            style={{ backgroundColor: 'var(--accent)', color: 'var(--bg-page)', ...MONO }}>
            {savingPassword ? 'Saving...' : 'Update Password'}
          </button>
        </div>
      </Section>

      {/* ══ PREFERENCES ════════════════════════════════════════════════════ */}

      {/* ── Appearance / Theme ─────────────────────────────────────────────── */}
      <Section title="Appearance">
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map(t => (
            <button
              key={t}
              onClick={() => { if (theme !== t) toggleTheme(); }}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded border transition-colors"
              style={{
                borderColor:     theme === t ? 'var(--accent)' : 'var(--border)',
                backgroundColor: theme === t ? 'var(--accent-dim)' : 'transparent',
                color:           theme === t ? 'var(--accent)' : 'var(--text-muted)',
              }}
            >
              {t === 'light' ? <Sun size={14} /> : <Moon size={14} />}
              <span className="text-[11px] font-bold capitalize" style={MONO}>{t}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Accent colour ──────────────────────────────────────────────────── */}
      <Section title="Accent Color">
        <div className="flex flex-wrap gap-2 mb-3">
          {ACCENT_PRESETS.map(p => (
            <button key={p.value} title={p.label}
              onClick={() => { setCustomColor(p.value); setPref({ accent_color: p.value }); }}
              className="relative h-7 w-7 rounded-full transition-transform hover:scale-110 focus:outline-none"
              style={{ backgroundColor: p.value, boxShadow: prefs.accent_color === p.value ? `0 0 0 2px var(--bg-page), 0 0 0 4px ${p.value}` : undefined }}
            >
              {prefs.accent_color === p.value && <Check size={12} className="absolute inset-0 m-auto" style={{ color: '#000' }} />}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-full shrink-0 border" style={{ backgroundColor: customColor, borderColor: 'var(--border)' }} />
          <input type="text" value={customColor} onChange={e => setCustomColor(e.target.value)}
            onBlur={() => { if (/^#[0-9a-fA-F]{6}$/.test(customColor)) setPref({ accent_color: customColor }); }}
            maxLength={7} placeholder="#22c55e"
            className="flex-1 bg-transparent border rounded px-2 py-1 text-[11px] outline-none focus:border-[var(--accent)]"
            style={{ ...MONO, borderColor: 'var(--border)', color: 'var(--text-primary)' }} />
          <button onClick={() => { if (/^#[0-9a-fA-F]{6}$/.test(customColor)) setPref({ accent_color: customColor }); }}
            className="text-[10px] font-bold uppercase tracking-widest px-2 py-1 rounded"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', ...MONO }}>Set</button>
        </div>
      </Section>

      {/* ── Default chart timeframe ─────────────────────────────────────────── */}
      <Section title="Default Chart Timeframe">
        <div className="flex gap-1.5">
          {TIMEFRAMES.map(tf => (
            <button key={tf} onClick={() => setPref({ default_timeframe: tf })}
              className="flex-1 py-1.5 rounded text-[11px] font-bold transition-colors"
              style={{ ...MONO,
                backgroundColor: prefs.default_timeframe === tf ? 'var(--accent)' : 'var(--bg-elevated)',
                color:           prefs.default_timeframe === tf ? '#000'          : 'var(--text-muted)' }}>
              {tf}
            </button>
          ))}
        </div>
      </Section>

      {/* ── Density ────────────────────────────────────────────────────────── */}
      <Section title="Layout Density">
        <div className="flex gap-2">
          {(['comfortable', 'compact'] as const).map(d => (
            <button key={d} onClick={() => setPref({ density: d })}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded border transition-colors"
              style={{
                borderColor:     prefs.density === d ? 'var(--accent)' : 'var(--border)',
                backgroundColor: prefs.density === d ? 'var(--accent-dim)' : 'transparent',
                color:           prefs.density === d ? 'var(--accent)' : 'var(--text-muted)',
              }}>
              {d === 'comfortable' ? <AlignCenter size={14} /> : <AlignJustify size={14} />}
              <span className="text-[11px] font-bold capitalize" style={MONO}>{d}</span>
            </button>
          ))}
        </div>
      </Section>

      {/* ── Credibility filter ─────────────────────────────────────────────── */}
      <Section title={`Source Credibility Filter — min ${prefs.min_credibility}`}>
        <input type="range" min={0} max={100} step={10}
          value={prefs.min_credibility}
          onChange={e => setPref({ min_credibility: Number(e.target.value) })}
          className="w-full" style={{ accentColor: 'var(--accent)' }} />
        <div className="flex justify-between mt-1">
          <span className="text-[9px]" style={{ ...MONO, color: 'var(--text-muted)' }}>All sources</span>
          <span className="text-[9px]" style={{ ...MONO, color: 'var(--text-muted)' }}>Top-tier only</span>
        </div>
        <p className="text-[10px] mt-1.5" style={{ color: 'var(--text-muted)' }}>
          {prefs.min_credibility === 0
            ? 'Showing articles from all sources'
            : `Only showing sources with credibility ≥ ${prefs.min_credibility}`}
        </p>
      </Section>

      {/* ── Dashboard sections ─────────────────────────────────────────────── */}
      <Section title="Dashboard Sections">
        <div className="flex flex-col gap-2">
          {SECTIONS.map(({ key, label }) => {
            const hidden = prefs.hidden_sections.includes(key);
            return (
              <button key={key} onClick={() => toggleSection(key)}
                className="flex items-center justify-between px-3 py-2 rounded border transition-colors"
                style={{
                  borderColor:     hidden ? 'var(--border)' : 'var(--accent)',
                  backgroundColor: hidden ? 'var(--bg-elevated)' : 'var(--accent-dim)',
                  color:           hidden ? 'var(--text-muted)' : 'var(--accent)',
                }}>
                <span className="text-[11px] font-bold uppercase tracking-widest" style={MONO}>{label}</span>
                {hidden ? <EyeOff size={13} /> : <Eye size={13} />}
              </button>
            );
          })}
        </div>
      </Section>

      {/* ── Quick Links ────────────────────────────────────────────────────── */}
      <Section title="Quick Links">
        <Link
          to="/app/alerts"
          className="inline-flex items-center gap-2 px-4 py-2.5 border transition-colors hover:border-[var(--accent)] hover:text-[var(--accent)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}
        >
          <Bell size={13} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Price Alerts</span>
        </Link>
      </Section>

      {/* ── Admin Panel ────────────────────────────────────────────────────── */}
      {isAdmin && (
        <Section title="Admin Panel">
          <div className="flex items-center gap-2 mb-4">
            <Shield size={13} style={{ color: 'var(--accent)' }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--accent)', ...MONO }}>
              Admin Access
            </span>
          </div>
          <div className="flex items-center gap-2 mb-3">
            <Users size={12} style={{ color: 'var(--text-muted)' }} />
            <span className="text-[10px] uppercase tracking-widest" style={{ color: 'var(--text-muted)', ...MONO }}>
              {adminUsers ? `${adminUsers.length} users` : 'Loading…'}
            </span>
          </div>
          {adminUsersLoading && (
            <p className="text-[10px]" style={{ color: 'var(--text-muted)', ...MONO }}>Loading users…</p>
          )}
          {adminUsers && (
            <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-none">
              {adminUsers.map(u => (
                <div
                  key={u.id}
                  className="flex items-center justify-between px-3 py-2 border"
                  style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-elevated)' }}
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-bold truncate" style={{ color: 'var(--text-primary)', ...MONO }}>
                      {u.username ? `@${u.username}` : '—'}
                      {u.is_admin && (
                        <span className="ml-1.5 text-[9px] uppercase tracking-widest px-1 py-px" style={{ color: 'var(--accent)', border: '1px solid var(--accent)' }}>admin</span>
                      )}
                    </p>
                    <p className="text-[9px] truncate" style={{ color: 'var(--text-muted)', ...MONO }}>{u.email}</p>
                  </div>
                  {!u.is_admin && (
                    <button
                      onClick={() => {
                        if (confirm(`Delete ${u.email}?`)) deleteUser(u.id);
                      }}
                      className="ml-3 p-1 shrink-0 transition-colors hover:text-[var(--red)]"
                      style={{ color: 'var(--text-muted)' }}
                      title="Delete user"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </Section>
      )}

      {/* ── Session ────────────────────────────────────────────────────────── */}
      <Section title="Session">
        <button onClick={async () => { await logout(); navigate('/'); }}
          className="px-5 py-2 text-[10px] font-black uppercase tracking-widest border transition-colors hover:border-[var(--red)] hover:text-[var(--red)]"
          style={{ borderColor: 'var(--border)', color: 'var(--text-muted)', ...MONO }}>
          Sign Out
        </button>
      </Section>

    </motion.div>
  );
}
