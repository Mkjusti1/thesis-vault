const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { sendEmail } = require('../utils/email');

const signToken = (userId, role) =>
  jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

// POST /api/auth/register
const register = async (req, res) => {
  const { first_name, last_name, email, password, role = 'student', department, student_id } = req.body;

  const { rows: existing } = await query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.length) return res.status(409).json({ error: 'Email already registered' });

  const password_hash = await bcrypt.hash(password, 12);

  const { rows } = await query(
    `INSERT INTO users (first_name, last_name, email, password_hash, role, department, student_id, is_verified)
     VALUES ($1, $2, $3, $4, $5, $6, $7, FALSE)
     RETURNING id, first_name, last_name, email, role, department, student_id, created_at`,
    [first_name, last_name, email, password_hash, role, department, student_id || null]
  );

  const user = rows[0];
  const token = signToken(user.id, user.role);

  await sendEmail(email, 'welcome', first_name);

  res.status(201).json({ token, user });
};

// POST /api/auth/login
const login = async (req, res) => {
  const { email, password } = req.body;

  const { rows } = await query(
    'SELECT id, first_name, last_name, email, password_hash, role, department, is_active FROM users WHERE email = $1',
    [email]
  );

  const user = rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid email or password' });
  if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

  // Update last_login
  await query('UPDATE users SET last_login = NOW() WHERE id = $1', [user.id]);

  const { password_hash, ...safeUser } = user;
  const token = signToken(user.id, user.role);

  res.json({ token, user: safeUser });
};

// GET /api/auth/me
const me = async (req, res) => {
  const { rows } = await query(
    `SELECT id, first_name, last_name, email, role, department, student_id, orcid, phone, avatar_url, is_verified, last_login, created_at
     FROM users WHERE id = $1`,
    [req.user.id]
  );
  res.json(rows[0]);
};

// PATCH /api/auth/me
const updateMe = async (req, res) => {
  const { first_name, last_name, department, phone, orcid } = req.body;
  const { rows } = await query(
    `UPDATE users SET first_name=$1, last_name=$2, department=$3, phone=$4, orcid=$5
     WHERE id=$6
     RETURNING id, first_name, last_name, email, role, department, phone, orcid, updated_at`,
    [first_name, last_name, department, phone, orcid, req.user.id]
  );
  res.json(rows[0]);
};

// POST /api/auth/change-password
const changePassword = async (req, res) => {
  const { current_password, new_password } = req.body;

  const { rows } = await query('SELECT password_hash FROM users WHERE id = $1', [req.user.id]);
  const valid = await bcrypt.compare(current_password, rows[0].password_hash);
  if (!valid) return res.status(400).json({ error: 'Current password is incorrect' });

  const hash = await bcrypt.hash(new_password, 12);
  await query('UPDATE users SET password_hash = $1 WHERE id = $2', [hash, req.user.id]);

  res.json({ message: 'Password updated successfully' });
};

module.exports = { register, login, me, updateMe, changePassword };
