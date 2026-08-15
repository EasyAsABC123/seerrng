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

export const requestUsesSecureTransport = (req: Request): boolean => {
  const forwardedProtocol = req
    .get('x-forwarded-proto')
    ?.split(',', 1)[0]
    .trim()
    .toLowerCase();

  return req.secure || forwardedProtocol === 'https';
};

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
