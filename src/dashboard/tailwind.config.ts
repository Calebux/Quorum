import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        quorum: {
          violet: '#8b5cf6',
          blue:   '#3b82f6',
        },
      },
    },
  },
  plugins: [],
};

export default config;
