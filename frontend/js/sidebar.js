// Sidebar HTML – injected into every page
function renderSidebar() {
  return `
  <aside class="sidebar">
    <div class="sidebar-logo">
      <div class="logo-mark">Thesis<span>Vault</span></div>
      <div class="logo-sub">Submission Portal</div>
    </div>

    <div class="nav-section">
      <div class="nav-section-label">Main</div>
      <a class="nav-item" href="index.html">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
        Dashboard
      </a>
      <a class="nav-item" href="submissions.html">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
        My Submissions
        <span class="nav-badge">2</span>
      </a>
      <a class="nav-item" href="submit.html">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17,8 12,3 7,8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
        Submit Thesis
      </a>
      <a class="nav-item" href="reviews.html">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>
        Reviews
        <span class="nav-badge">3</span>
      </a>
    </div>

    <div class="nav-section">
      <div class="nav-section-label">Repository</div>
      <a class="nav-item" href="repository.html">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Search Theses
      </a>
      <a class="nav-item" href="submissions.html">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
        All Submissions
      </a>
    </div>

    <div class="nav-section">
      <div class="nav-section-label">Admin</div>
      <a class="nav-item" href="users.html">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
        Manage Users
      </a>
      <a class="nav-item" href="notifications.html">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
        Notifications
        <span class="nav-badge">5</span>
      </a>
      <a class="nav-item" href="settings.html">
        <svg fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/></svg>
        Settings
      </a>
    </div>

    <div class="sidebar-footer">
      <div class="user-chip">
        <div class="user-avatar">AO</div>
        <div>
          <div class="user-name">Adaora Okafor</div>
          <div class="user-role">PhD Candidate</div>
        </div>
      </div>
    </div>
  </aside>`;
}

document.addEventListener('DOMContentLoaded', () => {
  const placeholder = document.getElementById('sidebar-placeholder');
  if (placeholder) placeholder.outerHTML = renderSidebar();
});
