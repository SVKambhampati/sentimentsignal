const BASE = `${import.meta.env.VITE_API_URL ?? 'http://localhost:5001'}/api/user`;

export interface UserPreferences {
  accent_color: string;
  default_timeframe: '1D' | '1W' | '1M' | '3M' | '1Y';
  density: 'compact' | 'comfortable';
  hidden_sections: string[];
  min_credibility: number;
}

export const DEFAULT_PREFERENCES: UserPreferences = {
  accent_color:      '#22d3ee',
  default_timeframe: '1M',
  density:           'comfortable',
  hidden_sections:   [],
  min_credibility:   0,
};

export async function getPreferences(): Promise<UserPreferences> {
  const res = await fetch(`${BASE}/preferences`, { credentials: 'include' });
  if (!res.ok) return DEFAULT_PREFERENCES;
  return res.json();
}

export async function updatePreferences(patch: Partial<UserPreferences>): Promise<UserPreferences> {
  const res = await fetch(`${BASE}/preferences`, {
    method:      'PUT',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(patch),
  });
  if (!res.ok) throw new Error('Failed to save preferences');
  return res.json();
}

export async function trackClick(ticker: string): Promise<void> {
  await fetch(`${BASE}/track`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify({ ticker }),
  });
}

export async function getPersonalizedFeed(minCredibility = 0) {
  const url = `${BASE}/personalized${minCredibility > 0 ? `?min_credibility=${minCredibility}` : ''}`;
  const res = await fetch(url, { credentials: 'include' });
  if (!res.ok) throw new Error('Failed to load personalized feed');
  return res.json();
}

export interface FeedbackPayload {
  category: 'bug' | 'feature' | 'general';
  message:  string;
  email?:   string;
  rating?:  number;
}

export async function submitFeedback(payload: FeedbackPayload): Promise<{ ok: boolean; id: number }> {
  const res = await fetch(`${BASE}/feedback`, {
    method:      'POST',
    credentials: 'include',
    headers:     { 'Content-Type': 'application/json' },
    body:        JSON.stringify(payload),
  });
  if (!res.ok) throw new Error('Failed to submit feedback');
  return res.json();
}
