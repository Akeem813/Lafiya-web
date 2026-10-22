import tokensData from './tokens.json';

export type ThemeName = 'light' | 'dark' | 'high-contrast' | 'print';

export interface SemanticTokenGroup {
  surface: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  text: {
    primary: string;
    secondary: string;
    muted: string;
    inverse: string;
  };
  danger: {
    base: string;
    surface: string;
    text: string;
    border: string;
  };
  verified: {
    base: string;
    surface: string;
    text: string;
    border: string;
  };
  warning: {
    base: string;
    surface: string;
    text: string;
    border: string;
  };
}

export const semanticTokens: Record<ThemeName, SemanticTokenGroup> = tokensData.themes;

export function getCssVariablesForTheme(theme: ThemeName): Record<string, string> {
  const t = semanticTokens[theme];
  return {
    '--color-surface-primary': t.surface.primary,
    '--color-surface-secondary': t.surface.secondary,
    '--color-surface-muted': t.surface.muted,
    '--color-surface-inverse': t.surface.inverse,
    '--color-text-primary': t.text.primary,
    '--color-text-secondary': t.text.secondary,
    '--color-text-muted': t.text.muted,
    '--color-text-inverse': t.text.inverse,
    '--color-danger-base': t.danger.base,
    '--color-danger-surface': t.danger.surface,
    '--color-danger-text': t.danger.text,
    '--color-danger-border': t.danger.border,
    '--color-verified-base': t.verified.base,
    '--color-verified-surface': t.verified.surface,
    '--color-verified-text': t.verified.text,
    '--color-verified-border': t.verified.border,
    '--color-warning-base': t.warning.base,
    '--color-warning-surface': t.warning.surface,
    '--color-warning-text': t.warning.text,
    '--color-warning-border': t.warning.border,
  };
}
