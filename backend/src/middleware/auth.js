const jwt = require('jsonwebtoken');
const { query } = require('../config/db');

// Verify JWT and attach user to req
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await query(
      'SELECT id, first_name, last_name, email, role, department, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!rows[0] || !rows[0].is_active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Role-based access guard
const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'You do not have permission to perform this action' });
  }
  next();
};

// Ownership OR admin check
const authorizeOwnerOrAdmin = (getOwnerId) => async (req, res, next) => {
  if (req.user.role === 'admin') return next();
  try {
    const ownerId = await getOwnerId(req);
    if (ownerId !== req.user.id) {
      return res.status(403).json({ error: 'Access denied' });
    }
    next();
  } catch {
    res.status(403).json({ error: 'Access denied' });
  }
};

module.exports = { authenticate, authorize, authorizeOwnerOrAdmin };
