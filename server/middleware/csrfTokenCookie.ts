import type { RequestHandler } from 'express';

export const csrfTokenCookie = (secure: boolean): RequestHandler =>
  function setCsrfTokenCookie(req, res, next) {
    // The browser client reads this cookie to populate X-XSRF-TOKEN. Without
    // an explicit root path, a token issued while rendering a nested page is
    // scoped to that page directory and disappears after client navigation.
    res.cookie('XSRF-TOKEN', req.csrfToken(), {
      path: '/',
      sameSite: true,
      secure,
    });
    next();
  };

export default csrfTokenCookie;
