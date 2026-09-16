import {
  actOnSeriesWatch,
  getSeriesWatchStatus,
  listSeriesWatchRequests,
  requestSeriesWatch,
  SeriesWatchError,
} from '@server/lib/bookSeriesWatch';
import { UserMutationActorUnauthorizedError } from '@server/lib/userSecurityMutation';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';

const routes = Router();
const identity = z.object({
  serverId: z.number().int().min(0).max(1_000_000_000),
  scope: z.string().min(1).max(256),
  providerId: z
    .string()
    .regex(/^(hc|gr):[1-9]\d*$/)
    .max(32),
});
const handle =
  (fn: (req: Request) => Promise<unknown>) =>
  async (req: Request, res: Response) => {
    try {
      return res.json(await fn(req));
    } catch (error) {
      if (error instanceof z.ZodError)
        return res
          .status(400)
          .json({ message: 'Invalid series watch request.' });
      if (error instanceof UserMutationActorUnauthorizedError)
        return res
          .status(403)
          .json({
            message: 'You do not have permission for this series request.',
          });
      if (error instanceof SeriesWatchError)
        return res.status(error.status).json({ message: error.message });
      return res
        .status(503)
        .json({
          message: 'Series monitoring is unavailable. Try again later.',
        });
    }
  };
routes.get(
  '/requests',
  handle((req) => listSeriesWatchRequests(req.user!))
);
routes.post(
  '/requests/:id/:action',
  handle((req) => {
    const id = z.coerce.number().int().positive().safe().parse(req.params.id);
    const action = z
      .enum(['approve', 'decline', 'stop'])
      .parse(req.params.action);
    return actOnSeriesWatch(req.user!.id, id, action);
  })
);
routes.get(
  '/',
  handle((req) => {
    const target = identity.parse({
      ...req.query,
      serverId: Number(req.query.serverId),
    });
    return getSeriesWatchStatus(target);
  })
);
routes.post(
  '/',
  handle((req) => {
    const body = identity
      .extend({ includeExtras: z.boolean() })
      .strict()
      .parse(req.body);
    if (body.providerId.startsWith('gr:') && !body.includeExtras)
      throw new SeriesWatchError(
        400,
        'This Goodreads catalog requires including extras.'
      );
    return requestSeriesWatch(req.user!.id, body, body.includeExtras);
  })
);
export default routes;
