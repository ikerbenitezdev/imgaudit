// Todo lo que el navegador pida a /api/engine/* se reenvía al servidor de análisis (Playwright + Sharp).
const target = process.env.ANALYZER_URL || 'http://localhost:4000';
export default {
  experimental: { proxyTimeout: 180000 }, // el análisis puede tardar más de 30 s
  async rewrites() { return [{ source: '/api/engine/:path*', destination: `${target}/api/:path*` }]; },
};
