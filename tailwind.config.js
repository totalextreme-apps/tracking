/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
    './lib/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      fontFamily: {
        mono: ['SpaceMono', 'monospace'],
      },
      colors: {
        crt: {
          scanline: 'rgba(0, 0, 0, 0.1)',
          glow: '#00ff88',
          grail: '#ffd700',
        },
      },
    },
  },
  plugins: [],
};
