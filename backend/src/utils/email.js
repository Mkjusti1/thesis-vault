const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const FROM = `"ThesisVault" <${process.env.EMAIL_FROM || process.env.SMTP_USER}>`;

// ── Email templates ────────────────────────────────────────────────────────
const templates = {
  welcome: (name) => ({
    subject: 'Welcome to ThesisVault',
    html: `
      <h2>Welcome, ${name}!</h2>
      <p>Your ThesisVault account has been created. You can now submit and track your thesis.</p>
      <p>Login at <a href="${process.env.CLIENT_URL}">${process.env.CLIENT_URL}</a></p>
    `,
  }),

  thesisSubmitted: (student, title) => ({
    subject: `Thesis Submitted: ${title}`,
    html: `
      <h2>Submission Confirmed</h2>
      <p>Hi ${student},</p>
      <p>Your thesis <strong>"${title}"</strong> has been successfully submitted and assigned to your review panel.</p>
      <p>You will be notified when reviewers leave feedback.</p>
    `,
  }),

  reviewerAssigned: (reviewer, title, role) => ({
    subject: `Review Assignment: ${title}`,
    html: `
      <h2>You have been assigned to review a thesis</h2>
      <p>Hi ${reviewer},</p>
      <p>You have been assigned as <strong>${role}</strong> for the thesis:</p>
      <p><em>"${title}"</em></p>
      <p>Please log in to ThesisVault to access the document.</p>
    `,
  }),

  statusChanged: (student, title, status) => ({
    subject: `Thesis Status Update: ${status}`,
    html: `
      <h2>Status Update</h2>
      <p>Hi ${student},</p>
      <p>Your thesis <strong>"${title}"</strong> status has been updated to: <strong>${status}</strong>.</p>
      <p>Log in to ThesisVault to view reviewer feedback.</p>
    `,
  }),

  commentAdded: (student, reviewer, title) => ({
    subject: `New Review Comment on Your Thesis`,
    html: `
      <h2>New Feedback Received</h2>
      <p>Hi ${student},</p>
      <p><strong>${reviewer}</strong> has left a comment on your thesis <em>"${title}"</em>.</p>
      <p>Log in to ThesisVault to read and respond.</p>
    `,
  }),

  deadlineReminder: (user, milestone, dueDate, title) => ({
    subject: `Reminder: ${milestone} due ${dueDate}`,
    html: `
      <h2>Deadline Reminder</h2>
      <p>Hi ${user},</p>
      <p>This is a reminder that <strong>${milestone}</strong> for your thesis <em>"${title}"</em> is due on <strong>${dueDate}</strong>.</p>
    `,
  }),
};

// ── Send email ─────────────────────────────────────────────────────────────
const sendEmail = async (to, templateName, ...args) => {
  if (process.env.NODE_ENV === 'test') return;

  try {
    const { subject, html } = templates[templateName](...args);
    await transporter.sendMail({ from: FROM, to, subject, html });
    console.log(`📧 Email sent [${templateName}] → ${to}`);
  } catch (err) {
    // Non-fatal: log but don't crash the request
    console.error(`Email failed [${templateName}]:`, err.message);
  }
};

module.exports = { sendEmail };
