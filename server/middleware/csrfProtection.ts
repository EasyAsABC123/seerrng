import csurf from '@dr.pogodin/csurf';
import type { Request, RequestHandler } from 'express';

const createCsrfProtection = (secure: boolean): RequestHandler =>
  csurf({
    cookie: {
      httpOnly: true,
      sameSite: true,
      secure,
      key: '_csrf',
      path: '/',
    },
  });

// `req.secure` already incorporates X-Forwarded-Proto exactly when (and only
// when) the operator has enabled "Enable Proxy Support" (settings.network.
// trustProxy), which is what puts Express itself into `trust proxy` mode
// (see server/index.ts). Reading the header directly here instead — as this
// function used to — trusted it unconditionally, regardless of whether a
// proxy is actually configured. A request that gets classified "secure"
// while the browser's real connection isn't causes the browser to silently
// refuse to store the resulting Secure-flagged _csrf/XSRF-TOKEN cookies,
// which desyncs CSRF validation on the very next request ("invalid csrf
// token"). Deferring entirely to req.secure keeps this decision consistent
// with the operator's own trust-proxy setting instead of an easily-spoofed,
// unconditionally-trusted header.
export const requestUsesSecureTransport = (req: Request): boolean => req.secure;

export const csrfProtection = (): RequestHandler => {
  const httpProtection = createCsrfProtection(false);
  const httpsProtection = createCsrfProtection(true);

  return (req, res, next) =>
    (requestUsesSecureTransport(req) ? httpsProtection : httpProtection)(
      req,
      res,
      next
    );
};

export default csrfProtection;
