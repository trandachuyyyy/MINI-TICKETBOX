/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#16121f',
        panel: '#1f1a2c',
        velvet: '#2a1f3d',
        amber: '#f4a33c',
        coral: '#ef5d60',
        mist: '#cabfe0',
      },
      fontFamily: {
        display: ['var(--font-display)'],
        mono: ['var(--font-mono)'],
        body: ['var(--font-body)'],
      },
      backgroundImage: {
        spotlight:
          'radial-gradient(60% 50% at 50% 0%, rgba(244,163,60,0.18) 0%, rgba(22,18,31,0) 70%)',
      },
    },
  },
  plugins: [],
};
