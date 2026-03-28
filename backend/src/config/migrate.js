require('dotenv').config();
const { query } = require('./db');

const migrate = async () => {
  console.log('🔄 Running database migrations...');

  // ── ENUMS ──────────────────────────────────────────────────────────────────
  await query(`
    DO $$ BEGIN
      CREATE TYPE user_role   AS ENUM ('student','supervisor','examiner','admin');
      CREATE TYPE degree_type AS ENUM ('PhD','MPhil','MSc_Research','Professional_Doctorate');
      CREATE TYPE thesis_status AS ENUM (
        'draft','submitted','under_review','revision_required',
        'approved','rejected','archived'
      );
      CREATE TYPE review_status AS ENUM ('pending','in_review','approved','revision_required','rejected');
      CREATE TYPE notif_type   AS ENUM ('review_comment','status_change','deadline','assignment','system');
    EXCEPTION WHEN duplicate_object THEN null;
    END $$;
  `);

  // ── USERS ──────────────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      first_name    VARCHAR(100) NOT NULL,
      last_name     VARCHAR(100) NOT NULL,
      email         VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role          user_role NOT NULL DEFAULT 'student',
      department    VARCHAR(150),
      student_id    VARCHAR(50) UNIQUE,
      orcid         VARCHAR(50),
      phone         VARCHAR(30),
      avatar_url    TEXT,
      is_verified   BOOLEAN NOT NULL DEFAULT FALSE,
      is_active     BOOLEAN NOT NULL DEFAULT TRUE,
      last_login    TIMESTAMPTZ,
      created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── THESES ─────────────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS theses (
      id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      student_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title           TEXT NOT NULL,
      abstract        TEXT NOT NULL,
      degree_type     degree_type NOT NULL,
      department      VARCHAR(150) NOT NULL,
      academic_year   VARCHAR(20) NOT NULL DEFAULT '2025-2026',
      language        VARCHAR(50) NOT NULL DEFAULT 'English',
      keywords        TEXT[],
      status          thesis_status NOT NULL DEFAULT 'draft',
      version         INTEGER NOT NULL DEFAULT 1,
      is_public       BOOLEAN NOT NULL DEFAULT TRUE,
      embargo_until   DATE,
      submitted_at    TIMESTAMPTZ,
      approved_at     TIMESTAMPTZ,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── THESIS FILES ───────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS thesis_files (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thesis_id    UUID NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
      file_type    VARCHAR(50) NOT NULL DEFAULT 'main',
      original_name VARCHAR(255) NOT NULL,
      stored_name  VARCHAR(255) NOT NULL,
      file_path    TEXT NOT NULL,
      mime_type    VARCHAR(100),
      file_size    BIGINT,
      version      INTEGER NOT NULL DEFAULT 1,
      is_current   BOOLEAN NOT NULL DEFAULT TRUE,
      uploaded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── REVIEWERS (assignment) ─────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS thesis_reviewers (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thesis_id    UUID NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
      reviewer_id  UUID NOT NULL REFERENCES users(id),
      role         VARCHAR(50) NOT NULL,   -- 'supervisor','internal_examiner','external_examiner','ethics'
      status       review_status NOT NULL DEFAULT 'pending',
      assigned_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reviewed_at  TIMESTAMPTZ,
      due_date     DATE,
      UNIQUE(thesis_id, reviewer_id)
    );
  `);

  // ── REVIEW COMMENTS ────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS review_comments (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thesis_id    UUID NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
      reviewer_id  UUID NOT NULL REFERENCES users(id),
      chapter      VARCHAR(100),
      page_ref     VARCHAR(50),
      comment_text TEXT NOT NULL,
      is_resolved  BOOLEAN NOT NULL DEFAULT FALSE,
      parent_id    UUID REFERENCES review_comments(id),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── DEADLINES ──────────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS deadlines (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      thesis_id    UUID NOT NULL REFERENCES theses(id) ON DELETE CASCADE,
      milestone    VARCHAR(200) NOT NULL,
      due_date     DATE NOT NULL,
      is_complete  BOOLEAN NOT NULL DEFAULT FALSE,
      completed_at TIMESTAMPTZ,
      created_by   UUID REFERENCES users(id),
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── NOTIFICATIONS ──────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS notifications (
      id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type         notif_type NOT NULL DEFAULT 'system',
      title        VARCHAR(255) NOT NULL,
      message      TEXT NOT NULL,
      link         TEXT,
      is_read      BOOLEAN NOT NULL DEFAULT FALSE,
      created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── AUDIT LOG ──────────────────────────────────────────────────────────────
  await query(`
    CREATE TABLE IF NOT EXISTS audit_log (
      id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id    UUID REFERENCES users(id),
      action     VARCHAR(100) NOT NULL,
      entity     VARCHAR(100),
      entity_id  UUID,
      details    JSONB,
      ip_address VARCHAR(45),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  // ── INDEXES ────────────────────────────────────────────────────────────────
  await query(`CREATE INDEX IF NOT EXISTS idx_theses_student ON theses(student_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_theses_status ON theses(status);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_theses_dept ON theses(department);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_reviewers_thesis ON thesis_reviewers(thesis_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_reviewers_reviewer ON thesis_reviewers(reviewer_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_comments_thesis ON review_comments(thesis_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifs_user ON notifications(user_id);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_notifs_unread ON notifications(user_id, is_read);`);
  await query(`CREATE INDEX IF NOT EXISTS idx_files_thesis ON thesis_files(thesis_id);`);

  // ── UPDATED_AT TRIGGER ────────────────────────────────────────────────────
  await query(`
    CREATE OR REPLACE FUNCTION set_updated_at()
    RETURNS TRIGGER AS $$
    BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
    $$ LANGUAGE plpgsql;
  `);
  for (const tbl of ['users', 'theses', 'review_comments']) {
    await query(`
      DROP TRIGGER IF EXISTS trg_${tbl}_updated ON ${tbl};
      CREATE TRIGGER trg_${tbl}_updated
        BEFORE UPDATE ON ${tbl}
        FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    `);
  }

  console.log('✅ Migrations complete.');
  process.exit(0);
};

migrate().catch(err => { console.error('Migration failed:', err); process.exit(1); });
