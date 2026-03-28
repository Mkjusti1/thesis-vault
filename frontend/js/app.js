// ThesisVault shared utilities

// Toast notification
function showToast(message, icon = '✓') {
  let toast = document.getElementById('tv-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'tv-toast';
    toast.className = 'toast';
    toast.innerHTML = `<span class="toast-icon" id="toast-icon"></span><span id="toast-msg"></span>`;
    document.body.appendChild(toast);
  }
  document.getElementById('toast-icon').textContent = icon;
  document.getElementById('toast-msg').textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// Mark nav active
function setActiveNav() {
  const page = location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('.nav-item').forEach(el => {
    const href = el.getAttribute('href') || '';
    if (href === page || (page === 'index.html' && href === 'index.html')) {
      el.classList.add('active');
    }
  });
}

// Upload zone drag & drop
function initUploadZone(zoneId, inputId, listId) {
  const zone = document.getElementById(zoneId);
  const input = document.getElementById(inputId);
  const list = document.getElementById(listId);
  if (!zone) return;

  zone.addEventListener('click', () => input && input.click());
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.style.borderColor = 'var(--gold)'; });
  zone.addEventListener('dragleave', () => zone.style.borderColor = '');
  zone.addEventListener('drop', e => {
    e.preventDefault();
    zone.style.borderColor = '';
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files, list);
  });
  if (input) input.addEventListener('change', () => handleFiles(input.files, list));
}

function handleFiles(files, list) {
  if (!list) return;
  Array.from(files).forEach(f => {
    const size = f.size > 1048576 ? (f.size/1048576).toFixed(1)+' MB' : (f.size/1024).toFixed(0)+' KB';
    const row = document.createElement('div');
    row.className = 'file-row';
    row.innerHTML = `
      <div class="file-icon" style="background:#e6f1fb;">
        <svg width="14" height="14" fill="none" stroke="#185fa5" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/></svg>
      </div>
      <span class="file-name">${f.name}</span>
      <span class="file-size">${size}</span>
      <span class="badge badge-green" style="font-size:10.5px;">Uploaded</span>
    `;
    list.prepend(row);
  });
  showToast('File uploaded successfully');
}

// Filter chips
function initFilters() {
  document.querySelectorAll('.filter-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const group = chip.closest('.filter-row');
      group && group.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  setActiveNav();
  initFilters();
});
