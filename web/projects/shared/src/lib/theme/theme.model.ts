/** School appearance shared by the portal and parent app. Colours are #rrggbb. */
export interface Theme {
  primary: string;
  header: string;
  sidebar: string;
  mode: 'light' | 'dark';
}

export const DEFAULT_THEME: Theme = { primary: '#5145b5', header: '#ffffff', sidebar: '#4d44a8', mode: 'light' };

/** Stored themes may predate mode/header settings, or contain invalid JSON values. */
export function normalizeTheme(value: unknown): Theme {
  const t = (value ?? {}) as Partial<Theme>;
  const pick = (v: unknown, fallback: string) =>
    typeof v === 'string' && /^#[0-9a-fA-F]{6}$/.test(v) ? v : fallback;
  return {
    primary: pick(t.primary, DEFAULT_THEME.primary),
    header: pick(t.header, DEFAULT_THEME.header),
    sidebar: pick(t.sidebar, DEFAULT_THEME.sidebar),
    mode: t.mode === 'dark' ? 'dark' : 'light',
  };
}
