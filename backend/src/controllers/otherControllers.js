const path = require('path');
const fs   = require('fs');
const { query } = require('../config/db');
const { sendEmail } = require('../utils/email');

// ══════════════════════════════════════════════════════════════════════
// REVIEW COMMENTS
// ══════════════════════════════════════════════════════════════════════

// GET /api/theses/:id/comments
const getComments = async (req, res) => {
  const { rows } = await query(
    `SELECT rc.*, u.first_name, u.last_name, u.role AS reviewer_role
     FROM review_comments rc
     JOIN users u ON u.id = rc.reviewer_id
     WHERE rc.thesis_id = $1
     ORDER BY rc.created_at ASC`,
    [req.params.id]
  );
  res.json(rows);
};

// POST /api/theses/:id/comments
const addComment = async (req, res) => {
  const { chapter, page_ref, comment_text, parent_id } = req.body;

  const { rows } = await query(
    `INSERT INTO review_comments (thesis_id, reviewer_id, chapter, page_ref, comment_text, parent_id)
     VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
    [req.params.id, req.user.id, chapter, page_ref, comment_text, parent_id || null]
  );

  // Notify student
  const { rows: thesis } = await query(
    `SELECT t.title, t.student_id, u.email, u.first_name
     FROM theses t JOIN users u ON u.id = t.student_id WHERE t.id = $1`,
    [req.params.id]
  );
  if (thesis[0]) {
    await query(
      `INSERT INTO notifications (user_id, type, title, message, link)
       VALUES ($1,'review_comment','New review comment','${req.user.first_name} ${req.user.last_name} left a comment on your thesis.','/reviews/${req.params.id}')`,
      [thesis[0].student_id]
    );
    await sendEmail(thesis[0].email, 'commentAdded',
      thesis[0].first_name,
      `${req.user.first_name} ${req.user.last_name}`,
      thesis[0].title
    );
  }

  res.status(201).json(rows[0]);
};

// PATCH /api/comments/:commentId/resolve
const resolveComment = async (req, res) => {
  const { rows } = await query(
    `UPDATE review_comments SET is_resolved = TRUE WHERE id = $1 AND thesis_id = $2 RETURNING *`,
    [req.params.commentId, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Comment not found' });
  res.json(rows[0]);
};

// PATCH /api/theses/:id/reviewers/:reviewerId/status
const updateReviewerStatus = async (req, res) => {
  const { status } = req.body;
  const { rows } = await query(
    `UPDATE thesis_reviewers SET status=$1, reviewed_at=NOW()
     WHERE thesis_id=$2 AND reviewer_id=$3
     RETURNING *`,
    [status, req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Assignment not found' });
  res.json(rows[0]);
};

// ══════════════════════════════════════════════════════════════════════
// FILE UPLOAD / DOWNLOAD
// ══════════════════════════════════════════════════════════════════════

// POST /api/theses/:id/files
const uploadFile = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { file_type = 'main' } = req.body;

  // Mark previous files of same type as not current
  await query(
    `UPDATE thesis_files SET is_current=FALSE WHERE thesis_id=$1 AND file_type=$2`,
    [req.params.id, file_type]
  );

  // Get version number
  const { rows: ver } = await query(
    `SELECT COALESCE(MAX(version),0)+1 AS next FROM thesis_files WHERE thesis_id=$1 AND file_type=$2`,
    [req.params.id, file_type]
  );

  const { rows } = await query(
    `INSERT INTO thesis_files (thesis_id, file_type, original_name, stored_name, file_path, mime_type, file_size, version, is_current)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,TRUE) RETURNING *`,
    [
      req.params.id, file_type, req.file.originalname, req.file.filename,
      req.file.path, req.file.mimetype, req.file.size, ver.rows[0].next,
    ]
  );

  res.status(201).json(rows[0]);
};

// GET /api/files/:fileId/download
const downloadFile = async (req, res) => {
  const { rows } = await query(`SELECT * FROM thesis_files WHERE id = $1`, [req.params.fileId]);
  if (!rows[0]) return res.status(404).json({ error: 'File not found' });

  const filePath = rows[0].file_path;
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found on disk' });

  res.download(filePath, rows[0].original_name);
};

// ══════════════════════════════════════════════════════════════════════
// DEADLINES
// ══════════════════════════════════════════════════════════════════════

// POST /api/theses/:id/deadlines
const createDeadline = async (req, res) => {
  const { milestone, due_date } = req.body;
  const { rows } = await query(
    `INSERT INTO deadlines (thesis_id, milestone, due_date, created_by) VALUES ($1,$2,$3,$4) RETURNING *`,
    [req.params.id, milestone, due_date, req.user.id]
  );
  res.status(201).json(rows[0]);
};

// PATCH /api/deadlines/:deadlineId/complete
const completeDeadline = async (req, res) => {
  const { rows } = await query(
    `UPDATE deadlines SET is_complete=TRUE, completed_at=NOW() WHERE id=$1 RETURNING *`,
    [req.params.deadlineId]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Deadline not found' });
  res.json(rows[0]);
};

// ══════════════════════════════════════════════════════════════════════
// NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════

// GET /api/notifications
const getNotifications = async (req, res) => {
  const { rows } = await query(
    `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50`,
    [req.user.id]
  );
  const unread = rows.filter(n => !n.is_read).length;
  res.json({ data: rows, unread });
};

// PATCH /api/notifications/read-all
const markAllRead = async (req, res) => {
  await query(
    `UPDATE notifications SET is_read = TRUE WHERE user_id = $1 AND is_read = FALSE`,
    [req.user.id]
  );
  res.json({ message: 'All notifications marked as read' });
};

// PATCH /api/notifications/:id/read
const markOneRead = async (req, res) => {
  await query(
    `UPDATE notifications SET is_read = TRUE WHERE id = $1 AND user_id = $2`,
    [req.params.id, req.user.id]
  );
  res.json({ message: 'Notification marked as read' });
};

// ══════════════════════════════════════════════════════════════════════
// USERS (admin management)
// ══════════════════════════════════════════════════════════════════════

// GET /api/users
const listUsers = async (req, res) => {
  const { role, department, search, page = 1, limit = 30 } = req.query;
  const offset = (page - 1) * limit;
  let params = [], cond = [], i = 1;

  if (role)       { cond.push(`role = $${i++}`);                     params.push(role); }
  if (department) { cond.push(`department ILIKE $${i++}`);           params.push(`%${department}%`); }
  if (search)     { cond.push(`(first_name||' '||last_name ILIKE $${i} OR email ILIKE $${i})`); params.push(`%${search}%`); i++; }

  const where = cond.length ? `WHERE ${cond.join(' AND ')}` : '';

  const { rows } = await query(
    `SELECT id, first_name, last_name, email, role, department, student_id, is_active, is_verified, last_login, created_at,
            COUNT(*) OVER() AS total_count
     FROM users ${where}
     ORDER BY created_at DESC LIMIT $${i} OFFSET $${i+1}`,
    [...params, limit, offset]
  );

  res.json({
    data: rows,
    pagination: { page: +page, limit: +limit, total: +(rows[0]?.total_count || 0), pages: Math.ceil((rows[0]?.total_count || 0) / limit) },
  });
};

// PATCH /api/users/:id/toggle-active
const toggleUserActive = async (req, res) => {
  const { rows } = await query(
    `UPDATE users SET is_active = NOT is_active WHERE id = $1 RETURNING id, first_name, last_name, email, is_active`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'User not found' });
  res.json(rows[0]);
};

// ══════════════════════════════════════════════════════════════════════
// DASHBOARD STATS (admin)
// ══════════════════════════════════════════════════════════════════════

const getDashboardStats = async (req, res) => {
  const { rows: stats } = await query(`
    SELECT
      COUNT(*) FILTER (WHERE status != 'archived')  AS total_submissions,
      COUNT(*) FILTER (WHERE status IN ('submitted','under_review')) AS under_review,
      COUNT(*) FILTER (WHERE status = 'approved')  AS approved,
      COUNT(*) FILTER (WHERE status = 'revision_required') AS revisions_due
    FROM theses
  `);

  const { rows: recent } = await query(`
    SELECT t.id, t.title, t.status, t.department, t.submitted_at,
           u.first_name, u.last_name
    FROM theses t JOIN users u ON u.id = t.student_id
    ORDER BY t.updated_at DESC LIMIT 10
  `);

  const { rows: deadlines } = await query(`
    SELECT d.*, t.title AS thesis_title, u.first_name, u.last_name
    FROM deadlines d
    JOIN theses t ON t.id = d.thesis_id
    JOIN users u ON u.id = t.student_id
    WHERE d.is_complete = FALSE AND d.due_date >= CURRENT_DATE
    ORDER BY d.due_date ASC LIMIT 10
  `);

  res.json({ stats: stats[0], recent_submissions: recent, upcoming_deadlines: deadlines });
};

module.exports = {
  getComments, addComment, resolveComment, updateReviewerStatus,
  uploadFile, downloadFile,
  createDeadline, completeDeadline,
  getNotifications, markAllRead, markOneRead,
  listUsers, toggleUserActive,
  getDashboardStats,
};
