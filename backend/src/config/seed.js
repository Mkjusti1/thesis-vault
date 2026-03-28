require('dotenv').config();
const bcrypt = require('bcryptjs');
const { query } = require('./db');

const seed = async () => {
  console.log('🌱 Seeding database...');

  const hash = (pw) => bcrypt.hash(pw, 12);

  // ── USERS ──
  const [admin, student1, student2, supervisor1, supervisor2, examiner1] =
    await Promise.all([
      hash('Admin@123456'),
      hash('Student@123'),
      hash('Student@123'),
      hash('Super@123'),
      hash('Super@123'),
      hash('Exam@123'),
    ]);

  await query(
    `
    INSERT INTO users (first_name, last_name, email, password_hash, role, department, student_id, is_verified)
    VALUES
      ('Admin',   'ThesisVault',  'admin@thesisvault.edu',      $1, 'admin',      'Administration',  NULL,              TRUE),
      ('Adaora',  'Okafor',       'a.okafor@uni.edu.ng',        $2, 'student',    'Computer Science','PHD/CS/2023/0047',TRUE),
      ('Chidi',   'Eze',          'c.eze@uni.edu.ng',           $3, 'student',    'Computer Science','PHD/CS/2023/0052',TRUE),
      ('Samuel',  'Obi',          's.obi@uni.edu.ng',           $4, 'supervisor', 'Computer Science', NULL,             TRUE),
      ('Ngozi',   'Eze',          'n.eze@uni.edu.ng',           $5, 'supervisor', 'Biochemistry',     NULL,             TRUE),
      ('Amina',   'Nwosu',        'a.nwosu@unilag.edu.ng',      $6, 'examiner',   'External',         NULL,             TRUE)
    ON CONFLICT (email) DO NOTHING;
  `,
    [admin, student1, student2, supervisor1, supervisor2, examiner1]
  );

  // ── Get user IDs ──
  const { rows: users } = await query(
    `SELECT id, email, role FROM users ORDER BY created_at`
  );
  const byEmail = Object.fromEntries(users.map((u) => [u.email, u.id]));

  const studentId = byEmail['a.okafor@uni.edu.ng'];
  const student2Id = byEmail['c.eze@uni.edu.ng'];
  const supId = byEmail['s.obi@uni.edu.ng'];
  const examId = byEmail['a.nwosu@unilag.edu.ng'];

  // ── THESES ──
  await query(
    `
    INSERT INTO theses (student_id, title, abstract, degree_type, department, keywords, status, version, submitted_at)
    VALUES
      ($1,
       'AI-Driven Urban Traffic Optimization Using Reinforcement Learning',
       'This thesis investigates the application of reinforcement learning algorithms to real-time urban traffic management systems, with field trials conducted in Lagos and Abuja metropolitan areas. We demonstrate a 34% reduction in average vehicle delay using our proposed DQN-PPO hybrid model.',
       'PhD', 'Computer Science',
       ARRAY['Machine Learning','Traffic Systems','Urban AI','Reinforcement Learning','DQN'],
       'under_review', 2, NOW() - INTERVAL '27 days'),
      ($2,
       'Machine Learning in Climate Modelling',
       'An exploration of transformer-based architectures applied to long-range climate prediction across West Africa, integrating ERA5 reanalysis data and station observations.',
       'PhD', 'Computer Science',
       ARRAY['Machine Learning','Climate','Transformers','Weather Prediction'],
       'submitted', 1, NOW() - INTERVAL '2 hours')
    ON CONFLICT DO NOTHING;
  `,
    [studentId, student2Id]
  );

  // ── Get thesis IDs ──
  const { rows: theses } = await query(`SELECT id, student_id FROM theses`);
  const thesis1 = theses.find((t) => t.student_id === studentId)?.id;

  if (thesis1) {
    // ── REVIEWERS ──
    await query(
      `
  INSERT INTO thesis_reviewers (thesis_id, reviewer_id, role, status, due_date)
  VALUES
    ($1, $2, 'supervisor',       'approved',     NOW() + INTERVAL '10 days'),
    ($1, $3, 'external_examiner','in_review',    NOW() + INTERVAL '7 days')
  ON CONFLICT DO NOTHING;
`,
      [thesis1, supId, examId]
    );

    // ── COMMENTS ──
    await query(
      `
      INSERT INTO review_comments (thesis_id, reviewer_id, chapter, page_ref, comment_text)
      VALUES
        ($1, $2, 'Chapter 1–5', NULL,    'Excellent work overall. The literature review is comprehensive and the methodology is well-justified. Chapter 4 is particularly strong.'),
        ($1, $2, 'Chapter 3',   'p. 47', 'Minor note: please ensure Figure 3.2 has a proper caption referencing the data source.'),
        ($1, $3, 'Chapter 5',   'p. 112','I have some questions about the scalability claims — the dataset used may not be representative of all urban contexts.')
      ON CONFLICT DO NOTHING;
    `,
      [thesis1, supId, examId]
    );

    // ── DEADLINES ──
    await query(
      `
      INSERT INTO deadlines (thesis_id, milestone, due_date, is_complete)
      VALUES
        ($1, 'Ethics Form Submission',  NOW()::date + 5,  FALSE),
        ($1, 'Examiner Review Due',     NOW()::date + 7,  FALSE),
        ($1, 'Final Submission',        NOW()::date + 18, FALSE)
      ON CONFLICT DO NOTHING;
    `,
      [thesis1]
    );

    // ── NOTIFICATIONS ──
    await query(
      `
      INSERT INTO notifications (user_id, type, title, message, link)
      VALUES
        ($1, 'review_comment', 'Supervisor approved Chapter 4',
         'Prof. Samuel Obi approved Chapter 4 of your thesis with minor notes.', '/reviews'),
        ($1, 'deadline',       'Ethics form due in 5 days',
         'Your ethics clearance form for AI-Driven Urban Traffic is due March 18.', '/submit'),
        ($1, 'review_comment', 'Dr. Nwosu left 3 comments',
         'Dr. Amina Nwosu left new comments on your thesis.', '/reviews'),
        ($1, 'status_change',  'Thesis under review',
         'Your thesis has been forwarded to the examiner panel.', '/submissions')
      ON CONFLICT DO NOTHING;
    `,
      [studentId]
    );
  }

  console.log('✅ Seed complete. Demo credentials:');
  console.log('   Admin:      admin@thesisvault.edu  / Admin@123456');
  console.log('   Student:    a.okafor@uni.edu.ng    / Student@123');
  console.log('   Supervisor: s.obi@uni.edu.ng       / Super@123');
  console.log('   Examiner:   a.nwosu@unilag.edu.ng  / Exam@123');
  process.exit(0);
};

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
