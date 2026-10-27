import type { Config } from 'tailwindcss';

export default {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        azul: { DEFAULT: '#2246C4', oscuro: '#1B389E', suave: '#E3EAFF' },
        turquesa: { DEFAULT: '#20B7A9', oscuro: '#0B776D', suave: '#DBF3F0' },
        carbon: { DEFAULT: '#182333', 2: '#22324A', 3: '#34496A' },
        fondo: '#F7F9FE',
        nube: '#EFF4FF'
      },
      fontFamily: { sans: ['"Plus Jakarta Sans"', 'system-ui', 'sans-serif'] },
      boxShadow: { suave: '0 1px 2px rgba(16,24,40,.04), 0 12px 32px -18px rgba(16,24,40,.18)' }
    }
  },
  plugins: []
} satisfies Config;
