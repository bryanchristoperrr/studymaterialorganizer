/**
 * Membungkus controller async agar promise rejection diteruskan ke
 * errorHandler global (Express 4 tidak melakukannya secara otomatis).
 */
import type { NextFunction, Request, RequestHandler, Response } from 'express';

type AsyncController = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<void>;

export function asyncHandler(fn: AsyncController): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
