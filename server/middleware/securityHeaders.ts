export const buildContentSecurityPolicy = (
  nodeEnv = process.env.NODE_ENV
): string => {
  const development = nodeEnv === 'development';

  return [
    "default-src 'self'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    `script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''}`,
    "script-src-attr 'none'",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    `connect-src 'self' https://plex.tv https://*.plex.tv${development ? ' ws: wss:' : ''}`,
    "media-src 'self' blob:",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "frame-src 'none'",
  ].join('; ');
};

export const SECURITY_RESPONSE_HEADERS = {
  'Content-Security-Policy': buildContentSecurityPolicy(),
  'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
  'Origin-Agent-Cluster': '?1',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Referrer-Policy': 'same-origin',
  'Strict-Transport-Security': 'max-age=31536000',
  'X-Content-Type-Options': 'nosniff',
  'X-DNS-Prefetch-Control': 'off',
  'X-Frame-Options': 'DENY',
  'X-Permitted-Cross-Domain-Policies': 'none',
} as const;

const securityHeaders: Middleware = (_req, res, next) => {
  for (const [name, value] of Object.entries(SECURITY_RESPONSE_HEADERS)) {
    res.setHeader(name, value);
  }
  res.removeHeader('X-Powered-By');
  next();
};

export default securityHeaders;
