// ── JWT authentication middleware
const jwt = require('jsonwebtoken');
const db  = require('../lib/db');

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || 'ch_v2_access_secret_change_in_prod';
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'ch_v2_refresh_secret_change_in_prod';
const ACCESS_TTL  = '15m';
const REFRESH_TTL = '7d';

function signAccess(payload) {
  return jwt.sign(payload, ACCESS_SECRET, { expiresIn: ACCESS_TTL });
}

function signRefresh(payload) {
  return jwt.sign(payload, REFRESH_SECRET, { expiresIn: REFRESH_TTL });
}

function verifyAccess(token) {
  return jwt.verify(token, ACCESS_SECRET);
}

function verifyRefresh(token) {
  return jwt.verify(token, REFRESH_SECRET);
}

// Middleware: require valid JWT
async function requireAuth(req, res, next) {
  const header = req.headers.authorization;
  console.log(`[Auth Debug] ${req.method} ${req.path} - Header: ${header ? 'Present' : 'Missing'}`);
  
  if (!header?.startsWith('Bearer ')) {
    console.log('[Auth Debug] Missing or invalid Bearer header');
    return res.status(401).json({ error: 'Authorization required' });
  }
  const token = header.slice(7);
  try {
    const payload = verifyAccess(token);
    console.log(`[Auth Debug] Token verified for user: ${payload.id}`);

    // Verify user still exists and is active
    const { rows } = await db.query(
      'SELECT id, email, name, role, permissions, is_active FROM admins WHERE id=$1',
      [payload.id]
    );
    if (!rows[0] || !rows[0].is_active) {
      console.log('[Auth Debug] User not found or inactive');
      return res.status(401).json({ error: 'User not found or deactivated' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    console.log(`[Auth Debug] Verification failed: ${err.name} - ${err.message}`);
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired', code: 'TOKEN_EXPIRED' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
}

// Middleware: require admin role
function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

// Middleware: require specific permission (for 'user' role)
function requirePermission(permission) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role === 'admin') return next(); // admin has all permissions
    if (req.user.role === 'viewer') {
      // viewer: only GET requests allowed
      if (req.method !== 'GET') {
        return res.status(403).json({ error: 'Viewers can only read data' });
      }
      return next();
    }
    // user role: check specific permission
    const perms = req.user.permissions || {};
    if (!perms[permission]) {
      return res.status(403).json({ error: `Permission required: ${permission}` });
    }
    next();
  };
}

module.exports = {
  signAccess, signRefresh,
  verifyAccess, verifyRefresh,
  requireAuth, requireAdmin,
  requirePermission,
  // Adapters for router compatibility
  authenticate: () => (req, res, next) => {
    Promise.resolve(requireAuth(req, res, next)).catch(next);
  },
  requireRole: (role) => {
    if (role === 'admin') return requireAdmin;
    return requirePermission(role);
  }
};
