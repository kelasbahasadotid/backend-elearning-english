import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    roleId: number;
    email: string;
    username: string;
  };
}

export const authenticateToken = (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
     res.status(401).json({ error: 'Access token required' });
     return;
  }

  jwt.verify(token, process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key', (err, decoded) => {
    if (err) {
       res.status(403).json({ error: 'Invalid or expired token' });
       return;
    }
    req.user = decoded as AuthRequest['user'];
    next();
  });
};

export const requireRole = (allowedRoles: number[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
       res.status(401).json({ error: 'Unauthorized' });
       return;
    }
    if (!allowedRoles.includes(req.user.roleId)) {
       res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
       return;
    }
    next();
  };
};
