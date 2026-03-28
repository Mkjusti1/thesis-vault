const path = require('path');
const { query, getClient } = require('../config/db');
const { sendEmail } = require('../utils/email');

// ── Helpers ────────────────────────────────────────────────────────────────
const createNotification = async (userId, type, title, message, link = null) => {
  await query(
    `INSERT INTO notifications (user_id, type, title, message, link) VALUES ($1,$2,$3,$4,$5)`,
    [userId, type, title, message, link]
  );
};

// GET /api/theses  (list — scoped to role)
const listTheses = async (req, res) => {
  const { role, id: userId } = req.user;
  const { status, department, degree_type, search, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let conditions = [];
  let params = [];
  let i = 1;

  // Role scoping
  if (role === 'student') {
    conditions.push(`t.student_id = $${i++}`);
    params.push(userId);
  } else if (role === 'supervisor' || role === 'examiner') {
    conditions.push(`tr.reviewer_id = $${i++}`);
    params.push(userId);
  }

  if (status)      { conditions.push(`t.status = $${i++}`);      params.push(status); }
  if (department)  { conditions.push(`t.department = $${i++}`);  params.push(department); }
  if (degree_type) { conditions.push(`t.degree_type = $${i++}`); params.push(degree_type); }
  if (search)      {
    conditions.push(`(t.title ILIKE $${i} OR t.abstract ILIKE $${i})`);
    params.push(`%${search}%`); i++;
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  const join = (role === 'supervisor' || role === 'examiner')
    ? 'JOIN thesis_reviewers tr ON tr.thesis_id = t.id'
    : '';

  const sql = `
    SELECT t.*,
           u.first_name, u.last_name, u.email AS student_email,
           COUNT(*) OVER() AS total_count
    FROM theses t
    ${join}
    JOIN users u ON u.id = t.student_id
    ${where}
    ORDER BY t.updated_at DESC
    LIMIT $${i} OFFSET $${i + 1}
  `;
  params.push(limit, offset);

  const { rows } = await query(sql, params);
  const total = rows[0]?.total_count || 0;

  res.json({
    data: rows,
    pagination: { page: +page, limit: +limit, total: +total, pages: Math.ceil(total / limit) },
  });
};

// GET /api/theses/:id
const getThesis = async (req, res) => {
  const { rows } = await query(
    `SELECT t.*,
            u.first_name, u.last_name, u.email AS student_email, u.student_id AS student_number
     FROM theses t
     JOIN users u ON u.id = t.student_id
     WHERE t.id = $1`,
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Thesis not found' });

  // Attach files, reviewers, comments, deadlines
  const [files, reviewers, comments, deadlines] = await Promise.all([
    query(`SELECT * FROM thesis_files WHERE thesis_id = $1 ORDER BY uploaded_at DESC`, [req.params.id]),
    query(
      `SELECT tr.*, u.first_name, u.last_name, u.email, u.role AS user_role, u.department
       FROM thesis_reviewers tr JOIN users u ON u.id = tr.reviewer_id
       WHERE tr.thesis_id = $1`, [req.params.id]
    ),
    query(
      `SELECT rc.*, u.first_name, u.last_name, u.role AS reviewer_role
       FROM review_comments rc JOIN users u ON u.id = rc.reviewer_id
       WHERE rc.thesis_id = $1 ORDER BY rc.created_at ASC`, [req.params.id]
    ),
    query(`SELECT * FROM deadlines WHERE thesis_id = $1 ORDER BY due_date ASC`, [req.params.id]),
  ]);

  res.json({
    ...rows[0],
    files: files.rows,
    reviewers: reviewers.rows,
    comments: comments.rows,
    deadlines: deadlines.rows,
  });
};

// POST /api/theses  — create draft
const createThesis = async (req, res) => {
  const { title, abstract, degree_type, department, academic_year, language, keywords } = req.body;

  const { rows } = await query(
    `INSERT INTO theses (student_id, title, abstract, degree_type, department, academic_year, language, keywords, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'draft')
     RETURNING *`,
    [req.user.id, title, abstract, degree_type, department, academic_year || '2025-2026', language || 'English', keywords || []]
  );

  res.status(201).json(rows[0]);
};

// PATCH /api/theses/:id  — update
const updateThesis = async (req, res) => {
  const { title, abstract, degree_type, department, keywords, is_public, embargo_until } = req.body;

  const { rows } = await query(
    `UPDATE theses SET title=$1, abstract=$2, degree_type=$3, department=$4,
                       keywords=$5, is_public=$6, embargo_until=$7
     WHERE id=$8 AND student_id=$9
     RETURNING *`,
    [title, abstract, degree_type, department, keywords, is_public, embargo_until, req.params.id, req.user.id]
  );

  if (!rows[0]) return res.status(404).json({ error: 'Thesis not found or not yours' });
  res.json(rows[0]);
};

// POST /api/theses/:id/submit
const submitThesis = async (req, res) => {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    const { rows: thesis } = await client.query(
      `UPDATE theses SET status='submitted', submitted_at=NOW(), version=version+1
       WHERE id=$1 AND student_id=$2 AND status IN ('draft','revision_required')
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    if (!thesis[0]) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Thesis cannot be submitted in its current state' });
    }

    await client.query('COMMIT');

    // Notify student
    await createNotification(req.user.id, 'status_change', 'Thesis submitted',
      `Your thesis "${thesis[0].title}" has been submitted successfully.`, '/submissions');

    await sendEmail(req.user.email, 'thesisSubmitted',
      `${req.user.first_name} ${req.user.last_name}`, thesis[0].title);

    res.json(thesis[0]);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// POST /api/theses/:id/reviewers  — assign reviewer
const assignReviewer = async (req, res) => {
  const { reviewer_id, role, due_date } = req.body;

  const { rows: reviewer } = await query(
    'SELECT id, first_name, last_name, email FROM users WHERE id=$1 AND role IN ($2,$3,$4)',
    [reviewer_id, 'supervisor', 'examiner', 'admin']
  );
  if (!reviewer[0]) return res.status(404).json({ error: 'Reviewer not found' });

  const { rows } = await query(
    `INSERT INTO thesis_reviewers (thesis_id, reviewer_id, role, due_date)
     VALUES ($1,$2,$3,$4)
     ON CONFLICT (thesis_id, reviewer_id) DO UPDATE SET role=$3, due_date=$4
     RETURNING *`,
    [req.params.id, reviewer_id, role, due_date || null]
  );

  // Get thesis title for notification
  const { rows: thesis } = await query('SELECT title FROM theses WHERE id=$1', [req.params.id]);

  await createNotification(reviewer_id, 'assignment',
    'New thesis review assignment',
    `You have been assigned as ${role} for: "${thesis[0]?.title}".`,
    `/reviews/${req.params.id}`
  );

  await sendEmail(reviewer[0].email, 'reviewerAssigned',
    reviewer[0].first_name, thesis[0]?.title, role);

  res.status(201).json(rows[0]);
};

// PATCH /api/theses/:id/status  — admin/reviewer update status
const updateStatus = async (req, res) => {
  const { status } = req.body;
  const allowed = ['under_review', 'revision_required', 'approved', 'rejected', 'archived'];
  if (!allowed.includes(status)) return res.status(400).json({ error: 'Invalid status' });

  const { rows } = await query(
    `UPDATE theses SET status=$1, ${status === 'approved' ? 'approved_at=NOW(),' : ''}
     updated_at=NOW()
     WHERE id=$2 RETURNING *, student_id`,
    [status, req.params.id]
  );
  if (!rows[0]) return res.status(404).json({ error: 'Thesis not found' });

  await createNotification(rows[0].student_id, 'status_change',
    `Thesis ${status.replace('_', ' ')}`,
    `Your thesis status has been updated to: ${status}.`,
    '/submissions'
  );

  res.json(rows[0]);
};

// DELETE /api/theses/:id  — only drafts
const deleteThesis = async (req, res) => {
  const { rows } = await query(
    `DELETE FROM theses WHERE id=$1 AND student_id=$2 AND status='draft' RETURNING id`,
    [req.params.id, req.user.id]
  );
  if (!rows[0]) return res.status(400).json({ error: 'Only draft theses can be deleted' });
  res.json({ message: 'Thesis deleted' });
};

// GET /api/theses/repository  — public approved theses
const getRepository = async (req, res) => {
  const { search, department, degree_type, page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;

  let params = [];
  let conditions = [`t.status = 'approved'`, `t.is_public = TRUE`];
  let i = 1;

  if (department) { conditions.push(`t.department = $${i++}`); params.push(department); }
  if (degree_type){ conditions.push(`t.degree_type = $${i++}`); params.push(degree_type); }
  if (search) {
    conditions.push(`(t.title ILIKE $${i} OR t.abstract ILIKE $${i} OR $${i} = ANY(t.keywords))`);
    params.push(`%${search}%`); i++;
  }

  const where = `WHERE ${conditions.join(' AND ')}`;

  const { rows } = await query(`
    SELECT t.id, t.title, t.abstract, t.degree_type, t.department, t.keywords,
           t.academic_year, t.approved_at,
           u.first_name, u.last_name,
           COUNT(*) OVER() AS total_count
    FROM theses t JOIN users u ON u.id = t.student_id
    ${where}
    ORDER BY t.approved_at DESC
    LIMIT $${i} OFFSET $${i + 1}
  `, [...params, limit, offset]);

  const total = rows[0]?.total_count || 0;
  res.json({
    data: rows,
    pagination: { page: +page, limit: +limit, total: +total, pages: Math.ceil(total / limit) },
  });
};

module.exports = {
  listTheses, getThesis, createThesis, updateThesis,
  submitThesis, assignReviewer, updateStatus, deleteThesis, getRepository,
};
