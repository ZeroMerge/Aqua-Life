/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // AquaLife system transitioned to a premium Apple-like palette
        'al-white': '#ffffff',
        'al-off-white': '#f5f5f7',
        'al-light-gray': '#e5e5ea',
        'al-mid-gray': '#8e8e93',
        'al-dark-gray': '#3a3a3c',
        'al-near-black': '#1c1c1e',
        'al-black': '#000000',

        // Apple iOS Blue
        'al-blue': '#007aff',
        'al-blue-hover': '#005deb',
        'al-blue-muted': '#e5f1ff',

        // Apple Status Indicators
        'al-safe': '#34c759',
        'al-warning': '#ff9500',
        'al-critical': '#ff3b30',
      },
      fontFamily: {
        // DM Sans set as the primary font
        sans: [
          '"DM Sans"',
          '-apple-system',
          'BlinkMacSystemFont',
          '"Segoe UI"',
          'Roboto',
          'sans-serif'
        ],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'Monaco',
          'Consolas',
          'monospace'
        ],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        DEFAULT: '12px',
        'sm': '6px',
        'md': '8px',
        'lg': '12px',
        'xl': '16px',
        '2xl': '20px',
        '3xl': '24px',
        'full': '9999px',
      },
      boxShadow: {
        'sm': '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
        'DEFAULT': '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px -1px rgba(0, 0, 0, 0.1)',
        'md': '0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05)',
        'lg': '0 10px 15px -3px rgba(0, 0, 0, 0.05), 0 4px 6px -4px rgba(0, 0, 0, 0.05)',
        'xl': '0 20px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.05)',
        '2xl': '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
        'none': 'none',
      },
    },
  },
  plugins: [],
};