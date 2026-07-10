import type { NextFunction, Request, Response } from 'express';

type JsonBody = Parameters<Response['json']>[0];

const cacheableRoutePatterns = [
  /^\/settings\/public$/,
  /^\/settings\/discover$/,
  /^\/discover(?:\/|$)/,
  /^\/search(?:\/|$)/,
  /^\/movie\/\d+/,
  /^\/tv\/\d+/,
  /^\/collection\/\d+/,
  /^\/person\/\d+/,
  /^\/music\/[^/]+/,
  /^\/book\/[^/]+/,
  /^\/author\/[^/]+/,
  /^\/artist\/[^/]+/,
];

const getCacheControl = (path: string, isAuthenticated: boolean) => {
  if (path === '/settings/public') {
    // These values control authentication and media visibility. A stale 304
    // can silently revert the client to old feature flags, so never reuse it.
    return 'no-store, max-age=0';
  }

  if (path === '/settings/discover') {
    return 'private, no-cache, stale-if-error=300';
  }

  if (!isAuthenticated) {
    return undefined;
  }

  if (path.startsWith('/discover') || path.startsWith('/search')) {
    // Catalog feeds change frequently and support seeded refreshes. Keep the
    // browser copy for conditional 304 requests, but validate before reuse.
    return 'private, no-cache, stale-if-error=3600';
  }

  return 'private, max-age=300, stale-while-revalidate=1800, stale-if-error=1800';
};

export const apiResponseCache = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  if (req.method === 'GET' && req.path === '/settings/public') {
    delete req.headers['if-none-match'];
    delete req.headers['if-modified-since'];
  }

  if (
    req.method !== 'GET' ||
    req.headers.authorization ||
    !cacheableRoutePatterns.some((pattern) => pattern.test(req.path))
  ) {
    return next();
  }

  const json = res.json.bind(res);
  res.json = ((body: JsonBody) => {
    if (!res.headersSent && res.statusCode >= 200 && res.statusCode < 300) {
      const cacheControl = getCacheControl(req.path, Boolean(req.user));

      if (cacheControl) {
        res.setHeader('Cache-Control', cacheControl);
        res.setHeader('Vary', 'Cookie, Accept-Encoding');
      }
    }

    return json(body);
  }) as Response['json'];

  return next();
};
