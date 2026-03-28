# ThesisVault — Full-Stack Thesis Submission Platform

A production-ready thesis submission platform built with **Node.js + Express + PostgreSQL** backend and a multi-page HTML/CSS/JS frontend.

---

## Tech Stack

| Layer      | Technology                                      |
|------------|-------------------------------------------------|
| Backend    | Node.js 18+, Express 4, PostgreSQL              |
| Auth       | JWT (jsonwebtoken) + bcryptjs                   |
| File Upload| Multer (local disk / swap for S3 in production) |
| Email      | Nodemailer (any SMTP provider)                  |
| Security   | Helmet, CORS, express-rate-limit                |
| Frontend   | Vanilla HTML/CSS/JS (no framework needed)       |
| Deploy     | Render.com or Railway.app                       |

---

## Project Structure

```
thesisvault-fullstack/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js           # PostgreSQL pool
│   │   │   ├── migrate.js      # Run once: creates all tables
│   │   │   └── seed.js         # Demo data + test accounts
│   │   ├── controllers/
│   │   │   ├── authController.js
│   │   │   ├── thesisController.js
│   │   │   └── otherControllers.js
│   │   ├── middleware/
│   │   │   ├── auth.js         # JWT + role guard
│   │   │   ├── index.js        # Error handler + Multer
│   │   │   └── validate.js     # express-validator helper
│   │   ├── routes/
│   │   │   └── index.js        # All API routes
│   │   ├── utils/
│   │   │   └── email.js        # Email templates
│   │   └── server.js           # Express app entry point
│   ├── uploads/                # Uploaded thesis files (gitignored)
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── css/style.css
│   ├── js/
│   │   ├── api.js              # API client (Auth, Theses, Files, etc.)
│   │   ├── app.js              # Shared UI utilities
│   │   └── sidebar.js          # Nav injection
│   ├── login.html
│   ├── index.html              # Dashboard
│   ├── submit.html             # 5-step submission form
│   ├── submissions.html        # My submissions
│   ├── reviews.html            # Review feedback
│   ├── repository.html         # Search & browse
│   ├── notifications.html
│   ├── users.html              # Admin user management
│   └── settings.html
├── render.yaml                 # One-click Render deploy
├── railway.toml                # Railway deploy config
└── .gitignore
```

---

## Database Schema

```
users              — id, name, email, password_hash, role, department, student_id
theses             — id, student_id, title, abstract, degree_type, status, keywords
thesis_files       — id, thesis_id, file_path, version, is_current
thesis_reviewers   — thesis_id, reviewer_id, role, status
review_comments    — id, thesis_id, reviewer_id, chapter, page_ref, comment_text
deadlines          — id, thesis_id, milestone, due_date, is_complete
notifications      — id, user_id, type, title, message, is_read
audit_log          — id, user_id, action, entity, details
```

---

## API Endpoints

### Auth
| Method | Endpoint                  | Description          |
|--------|---------------------------|----------------------|
| POST   | /api/auth/register        | Create account       |
| POST   | /api/auth/login           | Sign in → JWT token  |
| GET    | /api/auth/me              | Current user profile |
| PATCH  | /api/auth/me              | Update profile       |
| POST   | /api/auth/change-password | Change password      |

### Theses
| Method | Endpoint                        | Role              |
|--------|---------------------------------|-------------------|
| GET    | /api/theses                     | All (role-scoped) |
| POST   | /api/theses                     | Student           |
| GET    | /api/theses/:id                 | All               |
| PATCH  | /api/theses/:id                 | Student (owner)   |
| DELETE | /api/theses/:id                 | Student (draft)   |
| POST   | /api/theses/:id/submit          | Student           |
| PATCH  | /api/theses/:id/status          | Admin/Reviewer    |
| POST   | /api/theses/:id/reviewers       | Admin/Supervisor  |
| GET    | /api/theses/repository          | Public            |

### Files, Comments, Notifications, Users
| Method | Endpoint                             | Description            |
|--------|--------------------------------------|------------------------|
| POST   | /api/theses/:id/files                | Upload thesis file     |
| GET    | /api/files/:fileId/download          | Download file          |
| GET    | /api/theses/:id/comments             | List comments          |
| POST   | /api/theses/:id/comments             | Add comment (reviewer) |
| GET    | /api/notifications                   | My notifications       |
| PATCH  | /api/notifications/read-all          | Mark all read          |
| GET    | /api/users                           | Admin: list users      |
| GET    | /api/dashboard                       | Stats summary          |

---

## Local Development Setup

### 1. Prerequisites
- Node.js 18+
- PostgreSQL 14+ running locally (or use a free cloud DB)

### 2. Clone and install
```bash
git clone <your-repo-url>
cd thesisvault-fullstack/backend
npm install
```

### 3. Configure environment
```bash
cp .env.example .env
# Edit .env — fill in DATABASE_URL, JWT_SECRET, SMTP settings
```

### 4. Set up the database
```bash
# Create your database first:
createdb thesisvault

# Run migrations (creates all tables)
npm run migrate

# Seed demo data
npm run seed
```

### 5. Start the server
```bash
npm run dev      # Development (nodemon auto-reload)
npm start        # Production
```

API runs at: `http://localhost:5000`
Health check: `http://localhost:5000/health`

### 6. Open the frontend
Open `frontend/index.html` in a browser (or serve with any static server):
```bash
npx serve frontend
```

---

## Deploy to Render.com (Recommended)

### Option A — Blueprint (automatic)
1. Push this project to a GitHub repo
2. Go to [render.com](https://render.com) → New → Blueprint
3. Connect your GitHub repo — Render will read `render.yaml`
4. It auto-creates: PostgreSQL database + API web service + static frontend
5. After deploy, run migrations:
   ```bash
   # In Render dashboard → your API service → Shell
   npm run migrate
   npm run seed
   ```
6. Add your SMTP env vars in the Render dashboard under your API service

### Option B — Manual
1. Create a **PostgreSQL** database on Render → copy the `DATABASE_URL`
2. Create a **Web Service** → connect repo → root dir: `backend`
   - Build: `npm install`
   - Start: `npm start`
   - Add all env vars from `.env.example`
3. Create a **Static Site** → root dir: `frontend`
   - Update `api-base` meta tag in your HTML to point to your API URL

---

## Deploy to Railway.app

1. Push to GitHub
2. New Project → Deploy from GitHub repo
3. Add a **PostgreSQL** plugin — Railway auto-injects `DATABASE_URL`
4. Set env vars: `JWT_SECRET`, `CLIENT_URL`, SMTP settings
5. Railway reads `railway.toml` automatically
6. After first deploy, open a Railway shell:
   ```bash
   npm run migrate && npm run seed
   ```

---

## Demo Credentials (after seeding)

| Role       | Email                        | Password     |
|------------|------------------------------|--------------|
| Admin      | admin@thesisvault.edu        | Admin@123456 |
| Student    | a.okafor@uni.edu.ng          | Student@123  |
| Supervisor | s.obi@uni.edu.ng             | Super@123    |
| Examiner   | a.nwosu@unilag.edu.ng        | Exam@123     |

---

## Production Checklist

- [ ] Change `JWT_SECRET` to a strong random value
- [ ] Set `NODE_ENV=production`
- [ ] Configure SMTP for real email delivery
- [ ] Set up proper CORS: update `CLIENT_URL`
- [ ] For large file storage, replace Multer disk storage with AWS S3
- [ ] Enable HTTPS (Render/Railway do this automatically)
- [ ] Set up database backups (Render paid plan or pg_dump cron)

---

## Upgrading File Storage to AWS S3

Install: `npm install @aws-sdk/client-s3 multer-s3`

Replace the `storage` config in `middleware/index.js`:
```js
const { S3Client } = require('@aws-sdk/client-s3');
const multerS3 = require('multer-s3');

const s3 = new S3Client({ region: process.env.AWS_REGION });

const storage = multerS3({
  s3,
  bucket: process.env.S3_BUCKET,
  key: (req, file, cb) => cb(null, `theses/${req.user.id}/${uuidv4()}${path.extname(file.originalname)}`),
});
```
Add `AWS_REGION`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `S3_BUCKET` to your `.env`.
