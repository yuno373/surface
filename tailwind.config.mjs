/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './public/static/app.js',
    './src/index.tsx',
  ],
  theme: { extend: {} },
  plugins: [],
  corePlugins: { preflight: false },
}
