const router = require('express').Router();
const { body, param } = require('express-validator');

const { authenticate, authorize } = require('../middleware/auth');
const { upload } = require('../middleware/index');
const auth   = require('../controllers/authController');
const thesis = require('../controllers/thesisController');
const other  = require('../controllers/otherControllers');

// Validation helper
const validate = require('../middleware/validate');

// ── AUTH ───────────────────────────────────────────────────────────────────
router.post('/auth/register', [
  body('email').isEmail().normalizeEmail(),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('first_name').notEmpty().trim(),
  body('last_name').notEmpty().trim(),
  validate,
], auth.register);

router.post('/auth/login', [
  body('email').isEmail().normalizeEmail(),
  body('password').notEmpty(),
  validate,
], auth.login);

router.get('/auth/me',              authenticate, auth.me);
router.patch('/auth/me',            authenticate, auth.updateMe);
router.post('/auth/change-password',authenticate, auth.changePassword);

// ── THESES ─────────────────────────────────────────────────────────────────
router.get('/theses',            authenticate, thesis.listTheses);
router.post('/theses',           authenticate, authorize('student'), [
  body('title').notEmpty().trim(),
  body('abstract').notEmpty(),
  body('degree_type').isIn(['PhD','MPhil','MSc_Research','Professional_Doctorate']),
  body('department').notEmpty(),
  validate,
], thesis.createThesis);

router.get('/theses/repository', thesis.getRepository);  // public endpoint

router.get('/theses/:id',        authenticate, thesis.getThesis);
router.patch('/theses/:id',      authenticate, authorize('student'), thesis.updateThesis);
router.delete('/theses/:id',     authenticate, authorize('student'), thesis.deleteThesis);

router.post('/theses/:id/submit',    authenticate, authorize('student'),                         thesis.submitThesis);
router.patch('/theses/:id/status',   authenticate, authorize('admin','supervisor','examiner'),   thesis.updateStatus);
router.post('/theses/:id/reviewers', authenticate, authorize('admin','supervisor'), [
  body('reviewer_id').isUUID(),
  body('role').notEmpty(),
  validate,
], thesis.assignReviewer);

// ── FILES ──────────────────────────────────────────────────────────────────
router.post('/theses/:id/files',     authenticate, upload.single('file'), other.uploadFile);
router.get('/files/:fileId/download',authenticate, other.downloadFile);

// ── COMMENTS ──────────────────────────────────────────────────────────────
router.get('/theses/:id/comments',   authenticate, other.getComments);
router.post('/theses/:id/comments',  authenticate, authorize('supervisor','examiner','admin'), [
  body('comment_text').notEmpty(),
  validate,
], other.addComment);
router.patch('/theses/:id/comments/:commentId/resolve', authenticate, other.resolveComment);

// ── REVIEWER STATUS ────────────────────────────────────────────────────────
router.patch('/theses/:id/my-review-status', authenticate, authorize('supervisor','examiner'), [
  body('status').isIn(['pending','in_review','approved','revision_required','rejected']),
  validate,
], other.updateReviewerStatus);

// ── DEADLINES ──────────────────────────────────────────────────────────────
router.post('/theses/:id/deadlines',         authenticate, authorize('admin','supervisor'), other.createDeadline);
router.patch('/deadlines/:deadlineId/complete', authenticate, other.completeDeadline);

// ── NOTIFICATIONS ──────────────────────────────────────────────────────────
router.get('/notifications',              authenticate, other.getNotifications);
router.patch('/notifications/read-all',   authenticate, other.markAllRead);
router.patch('/notifications/:id/read',   authenticate, other.markOneRead);

// ── USERS (admin) ──────────────────────────────────────────────────────────
router.get('/users',              authenticate, authorize('admin'), other.listUsers);
router.patch('/users/:id/toggle', authenticate, authorize('admin'), other.toggleUserActive);

// ── DASHBOARD ──────────────────────────────────────────────────────────────
router.get('/dashboard', authenticate, other.getDashboardStats);

module.exports = router;
