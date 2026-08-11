import type { Config } from 'tailwindcss';

export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: '#12212e',
          soft: '#41586b',
          faint: '#7d92a3',
        },
        surface: {
          DEFAULT: '#ffffff',
          sunk: '#f4f7fa',
          line: '#dde5ec',
        },
        brand: {
          50: '#eef6ff',
          100: '#d9ebff',
          500: '#2f7fd4',
          600: '#1f63ad',
          700: '#1a4f8a',
        },
        good: '#1c7a52',
        warn: '#8a5a00',
        warnbg: '#fdf5e3',
      },
      fontFamily: {
        sans: ['ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        xl: '0.875rem',
      },
    },
  },
  plugins: [],
} satisfies Config;
