/**
 * FIRA Design System Tokens
 *
 * Single source of truth for colors, spacing, typography, radii, and shadows.
 * Compatible with Tailwind's theme.extend shape (v3 config) and exported as
 * CSS custom properties via theme.css for Tailwind v4's @theme directive.
 */

const colors = {
  primary: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7c3aed',
    800: '#6b21a8',
    900: '#581c87',
    950: '#3b0764',
  },
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
    950: '#0a0a0a',
  },
  // Semantic tokens — the actual values used throughout FIRA's dark theme
  background: {
    DEFAULT: '#0a0a0a',
    card: '#141414',
    elevated: '#1a1a1a',
  },
  text: {
    primary: '#fafafa',
    secondary: '#d4d4d4',
    muted: '#a3a3a3',
  },
  accent: {
    DEFAULT: '#a855f7',
    dim: '#7c3aed',
    glow: '#c084fc',
  },
};

const fontSize = {
  xs: ['0.75rem', { lineHeight: '1rem' }],
  sm: ['0.875rem', { lineHeight: '1.25rem' }],
  base: ['1rem', { lineHeight: '1.5rem' }],
  lg: ['1.125rem', { lineHeight: '1.75rem' }],
  xl: ['1.25rem', { lineHeight: '1.75rem' }],
  '2xl': ['1.5rem', { lineHeight: '2rem' }],
  '3xl': ['1.875rem', { lineHeight: '2.25rem' }],
  '4xl': ['2.25rem', { lineHeight: '2.5rem' }],
};

const borderRadius = {
  sm: '0.25rem',
  md: '0.5rem',
  lg: '0.75rem',
  xl: '1rem',
  full: '9999px',
};

const boxShadow = {
  sm: '0 1px 2px 0 rgba(0, 0, 0, 0.4)',
  md: '0 4px 6px -1px rgba(0, 0, 0, 0.5), 0 2px 4px -2px rgba(0, 0, 0, 0.4)',
  lg: '0 10px 15px -3px rgba(0, 0, 0, 0.6), 0 4px 6px -4px rgba(0, 0, 0, 0.4)',
};

// ponytail: spacing left as Tailwind default 4px scale — no override needed.
// If a custom scale emerges, add it here.
const spacing = {};

module.exports = {
  colors,
  fontSize,
  borderRadius,
  boxShadow,
  spacing,
};
