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

  jwt.verify(token, process.env.JWT_SECRET || 'supersecret_pronunciation_ai_key', (err, decoded: any) => {
    if (err) {
       res.status(403).json({ error: 'Invalid or expired token' });
       return;
    }
    const userRoleId = Number(decoded?.roleId || decoded?.role_id || decoded?.role || 4);
    req.user = {
      id: Number(decoded?.id),
      roleId: userRoleId,
      email: decoded?.email || '',
      username: decoded?.username || ''
    };
    next();
  });
};

export const requireRole = (allowedRoles: number[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
       res.status(401).json({ error: 'Unauthorized' });
       return;
    }
    const userRole = Number(req.user.roleId || (req.user as any).role_id);
    if (!allowedRoles.includes(userRole)) {
       res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
       return;
    }
    next();
  };
};
