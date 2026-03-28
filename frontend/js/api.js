// ThesisVault — API client
// Reads API_BASE from meta tag or defaults to same-origin /api

const API_BASE = 'http://localhost:5000/api';

// ── Token helpers ──────────────────────────────────────────────────────────
const getToken = () => localStorage.getItem('tv_token');
const setToken = (t) => localStorage.setItem('tv_token', t);
const clearToken = () => localStorage.removeItem('tv_token');
const getUser = () => JSON.parse(localStorage.getItem('tv_user') || 'null');
const setUser = (u) => localStorage.setItem('tv_user', JSON.stringify(u));

// ── Core fetch wrapper ─────────────────────────────────────────────────────
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });

  if (res.status === 401) {
    clearToken();
    if (!window.location.pathname.includes('login')) {
      window.location.href = 'login.html';
    }
    return;
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok)
    throw { status: res.status, message: data.error || 'Request failed', data };
  return data;
}

// ── Auth ───────────────────────────────────────────────────────────────────
const Auth = {
  async login(email, password) {
    const data = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setToken(data.token);
    setUser(data.user);
    return data;
  },

  async register(payload) {
    const data = await apiFetch('/auth/register', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    setToken(data.token);
    setUser(data.user);
    return data;
  },

  async me() {
    return apiFetch('/auth/me');
  },

  logout() {
    clearToken();
    localStorage.removeItem('tv_user');
    window.location.href = 'login.html';
  },

  isLoggedIn() {
    return !!getToken();
  },
};

// ── Theses ─────────────────────────────────────────────────────────────────
const Theses = {
  list: (params = {}) => apiFetch('/theses?' + new URLSearchParams(params)),
  get: (id) => apiFetch(`/theses/${id}`),
  create: (data) =>
    apiFetch('/theses', { method: 'POST', body: JSON.stringify(data) }),
  update: (id, data) =>
    apiFetch(`/theses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id) => apiFetch(`/theses/${id}`, { method: 'DELETE' }),
  submit: (id) => apiFetch(`/theses/${id}/submit`, { method: 'POST' }),
  updateStatus: (id, status) =>
    apiFetch(`/theses/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  assignReviewer: (id, data) =>
    apiFetch(`/theses/${id}/reviewers`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  repository: (params = {}) =>
    apiFetch('/theses/repository?' + new URLSearchParams(params)),
};

// ── Files ──────────────────────────────────────────────────────────────────
const Files = {
  upload(thesisId, file, file_type = 'main', onProgress) {
    return new Promise((resolve, reject) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('file_type', file_type);

      const xhr = new XMLHttpRequest();
      xhr.open('POST', `${API_BASE}/theses/${thesisId}/files`);
      xhr.setRequestHeader('Authorization', `Bearer ${getToken()}`);

      if (onProgress) {
        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable)
            onProgress(Math.round((e.loaded / e.total) * 100));
        };
      }
      xhr.onload = () => {
        const data = JSON.parse(xhr.responseText);
        xhr.status < 400 ? resolve(data) : reject(data);
      };
      xhr.onerror = () => reject(new Error('Upload failed'));
      xhr.send(formData);
    });
  },
  downloadUrl: (fileId) => `${API_BASE}/files/${fileId}/download`,
};

// ── Comments ───────────────────────────────────────────────────────────────
const Comments = {
  list: (thesisId) => apiFetch(`/theses/${thesisId}/comments`),
  add: (thesisId, data) =>
    apiFetch(`/theses/${thesisId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  resolve: (thesisId, commentId) =>
    apiFetch(`/theses/${thesisId}/comments/${commentId}/resolve`, {
      method: 'PATCH',
    }),
};

// ── Notifications ──────────────────────────────────────────────────────────
const Notifications = {
  list: () => apiFetch('/notifications'),
  markAllRead: () => apiFetch('/notifications/read-all', { method: 'PATCH' }),
  markRead: (id) => apiFetch(`/notifications/${id}/read`, { method: 'PATCH' }),
};

// ── Users (admin) ──────────────────────────────────────────────────────────
const Users = {
  list: (params = {}) => apiFetch('/users?' + new URLSearchParams(params)),
  toggle: (id) => apiFetch(`/users/${id}/toggle`, { method: 'PATCH' }),
};

// ── Dashboard ──────────────────────────────────────────────────────────────
const Dashboard = {
  stats: () => apiFetch('/dashboard'),
};

// ── Guard: redirect if not logged in ──────────────────────────────────────
function requireAuth() {
  if (!Auth.isLoggedIn()) {
    window.location.href = 'login.html';
  }
}

// ── Render current user in sidebar ────────────────────────────────────────
function renderCurrentUser() {
  const user = getUser();
  if (!user) return;
  const nameEl = document.getElementById('sidebar-user-name');
  const roleEl = document.getElementById('sidebar-user-role');
  const initEl = document.getElementById('sidebar-user-initials');
  if (nameEl) nameEl.textContent = `${user.first_name} ${user.last_name}`;
  if (roleEl)
    roleEl.textContent = `${
      user.role.charAt(0).toUpperCase() + user.role.slice(1)
    } · ${user.department || ''}`;
  if (initEl) initEl.textContent = `${user.first_name[0]}${user.last_name[0]}`;
}

document.addEventListener('DOMContentLoaded', () => {
  renderCurrentUser();
  // Logout links
  document.querySelectorAll('[data-action="logout"]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      Auth.logout();
    });
  });
});
