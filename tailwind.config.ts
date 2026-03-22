import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      keyframes: {
        'mm-bar-slide': {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(400%)' },
        },
        'mm-thinking-dots': {
          '0%, 100%': { opacity: '0.35' },
          '50%': { opacity: '1' },
        },
      },
      animation: {
        'mm-bar-slide': 'mm-bar-slide 1.75s ease-in-out infinite',
        'mm-thinking-dots': 'mm-thinking-dots 1.1s ease-in-out infinite',
      },
      colors: {
        background: '#0a0a08',
        surface: '#1a1a18',
        border: '#2d2d2a',
        accent: '#e8ff47',
        text: '#f5f5f3',
        muted: '#888885',
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
